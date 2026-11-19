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

export function authorizeRoles(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: ${roles.join(" or ")} role required`,
      });
    }

    return next();
  };
}

export const verifyCustomer = requireRole("customer");
export const verifyOwner = requireRole("owner");
export const verifyAdmin = requireRole("admin");

export function verifyOwnerOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  if (req.user.role !== "owner" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied: owner or admin role required",
    });
  }

  return next();
}
