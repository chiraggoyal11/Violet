const jwt = require('jsonwebtoken');

module.exports = function userJwt(req, res, next) {
    const header = req.header('Authorization');

    if (!header) {
        return res.status(401).json({
            success: false,
            msg: 'Authorization denied'
        });
    }

    const token = header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : header.trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            msg: 'Authorization denied'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.jwtSecret);
        if (!decoded?.user?.id) {
            return res.status(401).json({
                success: false,
                msg: 'Invalid token'
            });
        }
        req.user = decoded.user;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            msg: 'Token is not valid'
        });
    }
};
