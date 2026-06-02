exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Access denied' });
    next();
  };
};

exports.requireEmployee = () => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (req.user.userType !== 'employee') return res.status(403).json({ message: 'Employee access only' });
    next();
  };
};

exports.requireDeptScope = () => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    if (req.user.role === 'department_admin') {
      req.deptFilter = { assignedDepartment: req.user.department };
      return next();
    }
    return res.status(403).json({ message: 'Insufficient permissions for department scope' });
  };
};