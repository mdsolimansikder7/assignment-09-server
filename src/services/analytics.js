const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PAID_STATUSES = ["paid", "succeeded"];
const CHART_MONTHS = 12;

function roundMoney(value) {
  return Math.round((value || 0) * 100) / 100;
}

function periodIndex(period) {
  return period.year * 12 + (period.month - 1);
}

function mergeMonthly(bookingRows, paymentRows) {
  const periods = new Map();

  const ensure = (row) => {
    const key = `${row._id.year}-${row._id.month}`;
    if (!periods.has(key)) {
      periods.set(key, {
        year: row._id.year,
        month: MONTH_NAMES[row._id.month - 1],
        bookings: 0,
        revenue: 0,
      });
    }
    return periods.get(key);
  };

  bookingRows.forEach((row) => {
    ensure(row).bookings = row.bookings;
  });

  paymentRows.forEach((row) => {
    ensure(row).revenue = roundMoney(row.revenue);
  });

  return [...periods.values()]
    .sort((a, b) => periodIndex(a) - periodIndex(b))
    .map((period) => ({
      month: period.month,
      year: period.year,
      bookings: period.bookings,
      revenue: period.revenue,
    }));
}

function monthlyRangeSort() {
  return [
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    { $limit: CHART_MONTHS },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ];
}

async function getMonthlyBookings(db) {
  return db
    .collection("bookings")
    .aggregate([
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          bookings: { $sum: 1 },
        },
      },
      ...monthlyRangeSort(),
    ])
    .toArray();
}

async function getMonthlyPayments(db, match = {}) {
  return db
    .collection("payments")
    .aggregate([
      { $match: { status: { $in: PAID_STATUSES }, ...match } },
      {
        $group: {
          _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" } },
          revenue: { $sum: "$amount" },
        },
      },
      ...monthlyRangeSort(),
    ])
    .toArray();
}

export async function getAdminAnalytics(db) {
  const [totalUsers, totalEquipment, totalBookings, pendingApprovals, completedRentals] =
    await Promise.all([
      db.collection("users").countDocuments({}),
      db.collection("equipment").countDocuments({}),
      db.collection("bookings").countDocuments({}),
      db.collection("equipment").countDocuments({ status: "pending" }),
      db.collection("bookings").countDocuments({ bookingStatus: "completed" }),
    ]);

  const [revenueRow] = await db
    .collection("payments")
    .aggregate([
      { $match: { status: { $in: PAID_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  const [bookingRows, paymentRows] = await Promise.all([
    getMonthlyBookings(db),
    getMonthlyPayments(db),
  ]);

  return {
    totalUsers,
    totalEquipment,
    totalBookings,
    pendingApprovals,
    completedRentals,
    totalRevenue: roundMoney(revenueRow?.total),
    monthly: mergeMonthly(bookingRows, paymentRows),
  };
}

export async function getOwnerAnalytics(db, ownerEmail) {
  const [totalEquipment, completedRentals] = await Promise.all([
    db.collection("equipment").countDocuments({ "owner.email": ownerEmail }),
    db.collection("bookings").countDocuments({
      ownerEmail,
      bookingStatus: "completed",
    }),
  ]);

  const [earningsRow] = await db
    .collection("payments")
    .aggregate([
      { $match: { ownerEmail, status: { $in: PAID_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  const monthly = await getMonthlyPayments(db, { ownerEmail });

  return {
    totalEquipment,
    completedRentals,
    totalEarnings: roundMoney(earningsRow?.total),
    monthly: monthly.map((row) => ({
      month: MONTH_NAMES[row._id.month - 1],
      year: row._id.year,
      earnings: roundMoney(row.revenue),
    })),
  };
}

export async function getCustomerAnalytics(db, customerEmail) {
  const [totalBookings, completedRentals, activeRentals] = await Promise.all([
    db.collection("bookings").countDocuments({ "customer.email": customerEmail }),
    db.collection("bookings").countDocuments({
      "customer.email": customerEmail,
      bookingStatus: "completed",
    }),
    db.collection("bookings").countDocuments({
      "customer.email": customerEmail,
      bookingStatus: "active",
    }),
  ]);

  const [spentRow] = await db
    .collection("payments")
    .aggregate([
      { $match: { customerEmail, status: { $in: PAID_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  const monthly = await getMonthlyPayments(db, { customerEmail });

  return {
    totalBookings,
    activeRentals,
    completedRentals,
    totalSpent: roundMoney(spentRow?.total),
    monthly: monthly.map((row) => ({
      month: MONTH_NAMES[row._id.month - 1],
      year: row._id.year,
      spending: roundMoney(row.revenue),
    })),
  };
}
