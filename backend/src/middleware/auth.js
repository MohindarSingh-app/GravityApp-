const jwt = require("jsonwebtoken");

/**
 * Verify JWT token from Authorization header
 * Usage: router.get("/protected", auth, controller)
 */
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, app }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * Role-based access control
 * Usage: router.delete("/user/:id", auth, allowRoles("superadmin"), controller)
 */
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied: insufficient role" });
    }
    next();
  };
};

module.exports = { auth, allowRoles };
