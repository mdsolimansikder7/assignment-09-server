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

/**
 * Shapes a raw MongoDB booking document for API responses.
 */
export function serializeBooking(booking) {
  if (!booking) return null;

  const customer = booking.customer || {};

  return {
    id: booking._id.toString(),
    equipmentId: booking.equipmentId.toString(),
    equipmentName: booking.equipmentName,
    customer: {
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
    },
    ownerEmail: booking.ownerEmail,
    startDate: booking.startDate,
    endDate: booking.endDate,
    quantity: booking.quantity,
    totalAmount: booking.totalAmount,
    deliveryAddress: booking.deliveryAddress,
    notes: booking.notes || "",
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.bookingStatus,
    stripeSessionId: booking.stripeSessionId || null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
