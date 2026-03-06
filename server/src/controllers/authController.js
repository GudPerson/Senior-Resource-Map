import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { env } from 'hono/adapter';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, or, sql, ilike } from 'drizzle-orm';

const getSecret = (c) => env(c).JWT_SECRET || 'seniorcare-secret-key';

async function generateToken(user, c) {
    return await sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            name: user.name,
            subregionId: user.subregionId,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
        },
        getSecret(c)
    );
}

function setAuthCookie(c, token) {
    setCookie(c, 'sc_token', token, {
        httpOnly: true,
        secure: env(c).NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/',
    });
}

export const register = async (c) => {
    try {
        const body = await c.req.json();
        const { email, password, name } = body;
        let { username } = body;

        if (!email || !password || !name) {
            return c.json({ error: 'Email, password, and name are required' }, 400);
        }

        const db = getDb(env(c));

        // Auto-generate username from email if not provided
        if (!username) {
            const baseUsername = email.split('@')[0];
            let finalUsername = baseUsername;
            let counter = 1;
            while (true) {
                const [existing] = await db.select().from(users).where(eq(users.username, finalUsername));
                if (!existing) break;
                finalUsername = `${baseUsername}${counter++}`;
            }
            username = finalUsername;
        }

        // Check if email already exists
        const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
        if (existingEmail) {
            return c.json({ error: 'Email already exists' }, 400);
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [user] = await db.insert(users).values({
            username,
            email,
            passwordHash,
            name,
            role: 'standard'
        }).returning();

        const token = await generateToken(user, c);
        setAuthCookie(c, token);

        return c.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Registration Error:', err);
        return c.json({ error: err.message || 'Registration failed' }, 500);
    }
};

export const login = async (c) => {
    try {
        const body = await c.req.json();
        const { username, email, password, isPartnerLogin } = body;

        const loginId = username || email;
        if (!loginId || !password) {
            return c.json({ error: 'Username/email and password are required' }, 400);
        }

        const db = getDb(env(c));
        const isEmail = loginId.includes('@');

        // Try exact match first
        let [user] = await db.select().from(users).where(
            isEmail ? eq(users.email, loginId) : eq(users.username, loginId)
        );

        // Fallback: case-insensitive lookup
        if (!user) {
            [user] = await db.select().from(users).where(
                isEmail ? eq(users.email, loginId.toLowerCase()) : eq(users.username, loginId)
            );
        }

        // Last resort: fetch by lowercase comparison
        if (!user) {
            const allUsers = await db.select().from(users);
            user = allUsers.find(u =>
                isEmail
                    ? u.email.toLowerCase() === loginId.toLowerCase()
                    : u.username.toLowerCase() === loginId.toLowerCase()
            );
        }

        if (!user) return c.json({ error: 'Invalid credentials' }, 401);

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

        if (isPartnerLogin === true) {
            const adminRoles = ['super_admin', 'regional_admin', 'partner'];
            if (!adminRoles.includes(user.role)) {
                return c.json({ error: 'This login page is for Partners and Admins only.' }, 403);
            }
        }

        const token = await generateToken(user, c);
        setAuthCookie(c, token);
        return c.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role,
                subregionId: user.subregionId
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        return c.json({ error: err.message || 'Login failed' }, 500);
    }
};

export const me = async (c) => {
    const token = getCookie(c, 'sc_token');
    if (!token) return c.json({ user: null });

    try {
        const user = await verify(token, getSecret(c));
        return c.json({ user });
    } catch {
        return c.json({ user: null });
    }
};

export const logout = (c) => {
    deleteCookie(c, 'sc_token', { path: '/' });
    return c.json({ success: true });
};

export const googleAuth = async (c) => {
    try {
        const body = await c.req.json();
        const { credential } = body;
        if (!credential) return c.json({ error: 'No credential provided' }, 400);

        // Verify with Google's native REST endpoint instead of heavy google-auth-library
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const payload = await response.json();

        if (!response.ok || !payload || payload.aud !== env(c).VITE_GOOGLE_CLIENT_ID) {
            return c.json({ error: 'Invalid Google token' }, 401);
        }

        const { email, name } = payload;
        const db = getDb(env(c));

        let [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            const dummyPassword = crypto.getRandomValues(new Uint8Array(16)).join('');
            const passwordHash = await bcrypt.hash(dummyPassword, 10);

            const baseUsername = email.split('@')[0];
            let finalUsername = baseUsername;
            let counter = 1;

            while (true) {
                const [existing] = await db.select().from(users).where(eq(users.username, finalUsername));
                if (!existing) break;
                finalUsername = `${baseUsername}${counter++}`;
            }

            [user] = await db.insert(users).values({
                username: finalUsername,
                email,
                name: name || baseUsername,
                passwordHash,
                role: 'standard'
            }).returning();
        }

        const token = await generateToken(user, c);
        setAuthCookie(c, token);
        return c.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role,
                subregionId: user.subregionId
            }
        });

    } catch (err) {
        console.error('Google Auth Error:', err);
        return c.json({ error: 'Google authentication failed' }, 500);
    }
};
