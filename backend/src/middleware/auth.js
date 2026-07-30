const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.sub, {
      include: [{
        model: Role,
        include: [{ model: Permission }],
      }],
    });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!user.active) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    req.permissions = (user.Role && user.Role.Permissions ? user.Role.Permissions : []).map((permission) => permission.name);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
