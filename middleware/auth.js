import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
    const token = req.cookies?.sc_token;

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET || 'seniorcare-secret-key');
        req.user = user;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

export function optionalAuth(req, res, next) {
    const token = req.cookies?.sc_token;
    if (token) {
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET || 'seniorcare-secret-key');
        } catch {
            // Ignore token verification errors for optional auth
        }
    }
    next();
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
