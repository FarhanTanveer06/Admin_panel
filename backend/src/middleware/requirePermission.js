module.exports = function requirePermission(permissionName) {
  return function middleware(req, res, next) {
    const permissions = Array.isArray(req.permissions) ? req.permissions : [];

    if (!permissions.includes(permissionName)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
};
