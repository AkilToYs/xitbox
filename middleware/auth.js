const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'change-this-secret-in-prod';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ success: false, message: 'Token talab qilinadi' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ success: false, message: 'Token not valid' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token yaroqsiz yoki muddati o/tgan' });
  }
}

function requireRole(minRole) {
  // roleHierarchy higher number -> more privileges
  const roleHierarchy = { 'warehouse': 1, 'seller': 2, 'admin': 3, 'superadmin': 4 };
  return (req, res, next) => {
    if (!req.user || !req.user.role) return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
    const userLevel = roleHierarchy[req.user.role] || 0;
    const required = roleHierarchy[minRole] || 0;
    if (userLevel < required) {
      return res.status(403).json({ success: false, message: 'Yetarli huquq yo\'q' });
    }
    next();
  };
}

// Новая функция для использования в маршруте проверки токена
function verifyTokenForRoute(req, res) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ success: false, message: 'Token talab qilinadi' });
  }
  const parts = auth.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ success: false, message: 'Token not valid' });
  }
  const token = parts[1];
  try {
    const payload = jwt.verify(token, SECRET);
    return res.json({ success: true, valid: true, user: payload });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token yaroqsiz yoki muddati o/tgan' });
  }
}

module.exports = { verifyToken, requireRole, SECRET, verifyTokenForRoute };