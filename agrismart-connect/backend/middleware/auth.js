// ============================================================
// Authentication & Authorization middleware
// ============================================================
const { verifyToken } = require('../config/jwt');

// Verifies the JWT in the Authorization header and attaches
// req.user = { id, role }
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token missing.' });
    }

    const decoded = verifyToken(token);
    req.user = decoded; // { id, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// Restricts access to specific roles. Usage: authorize('farmer', 'admin')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// Optional auth: attaches req.user if a valid token is present,
// but does not block the request if absent (used for public marketplace
// endpoints that behave slightly differently for logged-in users).
function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      req.user = verifyToken(token);
    }
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
}

module.exports = { authenticate, authorize, optionalAuth };
