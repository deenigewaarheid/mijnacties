const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ error: 'Authenticatie vereist' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Ongeldige of verlopen token' });
        }
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    });
}

module.exports = { authenticateToken };
