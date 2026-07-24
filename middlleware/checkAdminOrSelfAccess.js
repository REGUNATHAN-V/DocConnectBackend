// middleware/checkAdminOrSelfAccess.js
const checkAdminOrSelfAccess = () => {
  return (req, res, next) => {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.userId;
    const currentUserRole = req.user.role;

    console.log("Target User ID:", targetUserId);
    console.log("Current User ID:", currentUserId);
    console.log("Current User Role:", currentUserRole);

    // Allow if admin
    if (currentUserRole === 3) {
      console.log("Access granted: User is admin");
      return next();
    }

    // Allow if editing own profile
    if ( currentUserId === targetUserId) {
      console.log("Access granted: User editing own profile");
      return next();
    }

    console.log("Access denied: Forbidden");
    return res.status(403).json({ message: "Forbidden: You can only edit your own profile" });
  };
};

module.exports = checkAdminOrSelfAccess;
