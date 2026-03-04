import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const getSecret = () => process.env.JWT_SECRET || 'seniorcare-secret-key';

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            name: user.name,
            subregionId: user.subregionId
        },
        getSecret(),
        { expiresIn: '7d' }
    );
}

function setAuthCookie(res, token) {
    res.cookie('sc_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
}

/**
 * Public registration is now disabled. 
 * Use userController.createUser for managed registration.
 */
export const register = async (req, res) => {
    res.status(403).json({ error: 'Public registration is disabled. Please contact an administrator.' });
};

export const login = async (req, res) => {
    try {
        const { username, email, password, isPartnerLogin } = req.body;

        // Support both username and email for login
        const loginId = username || email;
        const [user] = await db.select().from(users).where(
            loginId.includes('@') ? eq(users.email, loginId) : eq(users.username, loginId)
        );

        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        // Logic for specialized login pages
        if (isPartnerLogin === true) {
            const adminRoles = ['super_admin', 'regional_admin', 'partner'];
            if (!adminRoles.includes(user.role)) {
                return res.status(403).json({ error: 'This login page is for Partners and Admins only.' });
            }
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.json({
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
        res.status(500).json({ error: 'Login failed' });
    }
};

export const me = (req, res) => {
    const token = req.cookies?.sc_token;
    if (!token) return res.json({ user: null });

    try {
        const user = jwt.verify(token, getSecret());
        res.json({ user });
    } catch {
        res.json({ user: null });
    }
};

export const logout = (req, res) => {
    res.clearCookie('sc_token');
    res.json({ success: true });
};

const client = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'No credential provided' });

        const ticket = await client.verifyIdToken({
            id_token: credential, // Fix case sensitivity if needed, ticket usually has idToken or credential
            audience: process.env.VITE_GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) return res.status(401).json({ error: 'Invalid Google token' });

        const { email, name } = payload;

        let [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(dummyPassword, 10);

            const baseUsername = email.split('@')[0];
            let finalUsername = baseUsername;
            let counter = 1;

            // Uniqueness check for Google generated username
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
                role: 'standard' // Default for Google Sign-in
            }).returning();
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.status(200).json({
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
        res.status(500).json({ error: 'Google authentication failed' });
    }
};
