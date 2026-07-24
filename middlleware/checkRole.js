// Only allow users with specified roles to continue
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
      // console.log("Checking user role:", req.user);
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        console.log("User role type:", typeof req.user.role, "Value:", req.user.role);

        return res.status(403).json({ message: "Access denied: insufficient role" });
      }
      next();
    };
  };

  
  
  module.exports = checkRole;
  