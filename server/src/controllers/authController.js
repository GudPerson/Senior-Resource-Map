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
        { id: user.id, email: user.email, role: user.role, name: user.name },
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

export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password and name are required' });
        }
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        const passwordHash = await bcrypt.hash(password, 12);

        const [user] = await db.insert(users).values({
            email, passwordHash, name, role: req.body.role === 'partner' ? 'partner' : 'user'
        }).returning({
            id: users.id, email: users.email, name: users.name, role: users.role
        });

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.status(201).json({ user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password, isPartnerLogin } = req.body;
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        if (isPartnerLogin === true && user.role === 'user') {
            return res.status(403).json({ error: 'This login page is for Partners and Admins only.' });
        }
        if (isPartnerLogin === false && user.role !== 'user') {
            return res.status(403).json({ error: 'This login page is for Registered Users only.' });
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
        console.error(err);
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
            idToken: credential,
            audience: process.env.VITE_GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) return res.status(401).json({ error: 'Invalid Google token' });

        const { email, name } = payload;

        // Find existing user
        let [user] = await db.select().from(users).where(eq(users.email, email));

        if (!user) {
            // Create user
            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(dummyPassword, 10);

            [user] = await db.insert(users).values({
                email,
                name: name || email.split('@')[0],
                passwordHash,
                role: 'user'
            }).returning();
        }

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.status(200).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    } catch (err) {
        console.error('Google Auth Error:', err);
        res.status(500).json({ error: 'Google authentication failed' });
    }
};
