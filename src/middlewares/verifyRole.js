function requireRole(role) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied: ${role} role required`,
      });
    }

    return next();
  };
}

// All three run after verifyToken.
export const verifyCustomer = requireRole("customer");
export const verifyOwner = requireRole("owner");
export const verifyAdmin = requireRole("admin");
