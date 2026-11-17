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

/**
 * Shapes a raw MongoDB equipment document for API responses.
 */
export function serializeEquipment(item) {
  if (!item) return null;

  const owner = item.owner || {};

  return {
    id: item._id.toString(),
    name: item.name,
    description: item.description,
    category: item.category,
    location: item.location,
    rentalPrice: item.rentalPrice,
    rentalType: item.rentalType,
    availableQuantity: item.availableQuantity,
    condition: item.condition || "",
    brand: item.brand || "",
    model: item.model || "",
    image: item.image || "",
    terms: item.terms || "",
    status: item.status,
    owner: {
      name: owner.name || "",
      email: owner.email || "",
      photo: owner.photo || "",
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Shapes a raw MongoDB favorite document for API responses.
 */
export function serializeFavorite(favorite) {
  if (!favorite) return null;

  return {
    id: favorite._id.toString(),
    equipmentId: favorite.equipmentId.toString(),
    createdAt: favorite.createdAt,
  };
}
