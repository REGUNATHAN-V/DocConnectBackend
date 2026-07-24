const jwt = require("jsonwebtoken");
const BlacklistedToken = require("../models/BlacklistedToken");

const authMiddleware = async (req, res, next) => {
  console.log("🔐 Auth Middleware Triggered");

  const authHeader = req.headers.authorization;
  console.log("checkung",authHeader)
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ error: "Token has been revoked" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log( req.user)
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", message: "Please login again." });
    }
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = authMiddleware;
