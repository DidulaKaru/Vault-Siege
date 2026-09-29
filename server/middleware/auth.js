const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret';

function issueToken(payload, options = {}) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...options });
}

function authenticateToken(expectedType) {
    return (req, res, next) => {
        const authorization = req.headers.authorization;
        const token = authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : null;

        if (!token) {
            return res.status(401).json({ message: 'Authorization token required.' });
        }

        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (payload.type !== expectedType) {
                return res.status(403).json({ message: 'Invalid authorization scope.' });
            }

            req.auth = payload;
            return next();
        } catch (error) {
            return res.status(401).json({ message: 'Invalid or expired authorization token.' });
        }
    };
}

module.exports = { authenticateToken, issueToken };