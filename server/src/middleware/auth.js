import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'seniorcare-secret-key';

/**
 * Basic authentication middleware to verify JWT
 */
export function authenticateToken(req, res, next) {
    const token = req.cookies?.sc_token;

    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

/**
 * Optional authentication middleware for Guest/Public views
 */
export function optionalAuth(req, res, next) {
    const token = req.cookies?.sc_token;
    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch {
            // Ignore token verification errors for optional auth
        }
    }
    // If not user, we can assume guest
    if (!req.user) {
        req.user = { role: 'guest' };
    }
    next();
}

/**
 * Role-based authorization middleware
 * Supports 3-tier hierarchy: super_admin > regional_admin > partner > standard > guest
 */
export function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const { role, subregionId } = req.user;

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Tiered logic: super_admin always clears
        if (role === 'super_admin') return next();

        // Scope enforcement for regional_admin and partner
        if (role === 'regional_admin' || role === 'partner') {
            if (!subregionId) {
                return res.status(403).json({ error: 'Account missing required scope (subregion_id)' });
            }
            // Attach a standard filter object to the request for easy use in controllers
            req.subregionScope = subregionId;
        }

        next();
    };
}

/**
 * Legacy admin check, updated for super_admin
 */
export function isAdmin(req, res, next) {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Requires admin privileges' });
    }
    next();
}
