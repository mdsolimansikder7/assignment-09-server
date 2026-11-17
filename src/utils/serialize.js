/**
 * Shapes a raw MongoDB user document for API responses.
 */
export function serializeUser(user) {
  if (!user) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    photo: user.photo || "",
    phone: user.phone || "",
    address: user.address || "",
    role: user.role || "customer",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
