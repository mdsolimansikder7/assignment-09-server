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
    averageRating: typeof item.averageRating === "number" ? item.averageRating : 0,
    reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : 0,
    owner: {
      name: owner.name || "",
      email: owner.email || "",
      photo: owner.photo || "",
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function serializeFavorite(favorite) {
  if (!favorite) return null;

  return {
    id: favorite._id.toString(),
    equipmentId: favorite.equipmentId.toString(),
    createdAt: favorite.createdAt,
  };
}

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
    transactionId: booking.transactionId || "",
    paidAt: booking.paidAt || null,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

export function serializeReview(review) {
  if (!review) return null;

  return {
    id: review._id.toString(),
    equipmentId: review.equipmentId?.toString?.() || "",
    bookingId: review.bookingId?.toString?.() || "",
    userEmail: review.userEmail || "",
    userName: review.userName || "",
    userAvatar: review.userAvatar || "",
    rating: review.rating,
    comment: review.comment || "",
    createdAt: review.createdAt || null,
    updatedAt: review.updatedAt || null,
  };
}
