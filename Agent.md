# AGENTS.md — Equipment Rental Platform (Backend / Server)

This file tells the AI coding agent how to build the **server side only** of the Equipment Rental Platform. Do NOT touch or create any frontend code in this repo. Follow the phases in order and do not skip ahead.

---

## 1. Project Summary

A rental marketplace where **Owners** list equipment, **Customers** browse, book and pay (Stripe), and **Admins** approve equipment and manage the platform.

- Roles: `customer`, `owner`, `admin`
- Backend must be production-safe: **no CORS / 404 / 504 errors**, no crash on cold start.
- Frontend (separate repo): Next.js App Router + BetterAuth. This server only exposes a REST API.

## 2. Tech Stack

- Node.js + Express.js
- JavaScript (ES Modules, `"type": "module"` in package.json). Do NOT use TypeScript.
- MongoDB (official `mongodb` driver)
- `jsonwebtoken`, `cookie-parser`, `cors`, `dotenv`
- `stripe`
- `node-cron` (optional feature)
- `nodemailer` (optional feature)
- `zod` for request validation (recommended; works fine in plain JavaScript)

## 3. Folder Structure

```
server/
├── src/
│   ├── config/        # db.js, stripe.js, env.js
│   ├── middlewares/   # verifyToken, verifyCustomer, verifyOwner, verifyAdmin, errorHandler, notFound
│   ├── routes/        # auth, users, equipment, favorites, bookings, payments, analytics
│   ├── controllers/   # one file per route group
│   ├── services/      # availability, pricing, email, analytics helpers
│   ├── jobs/          # cron jobs
│   ├── utils/
│   ├── app.js         # express app (no listen)
│   └── index.js       # listen + db connect
├── .env               # never commit
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## 4. Environment Variables (never hardcode, never commit)

```
PORT=5000
MONGODB_URI=
DB_NAME=
JWT_SECRET=
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NODE_ENV=development
EMAIL_USER=
EMAIL_PASS=
```

- Provide `.env.example` with empty values.
- `.env` must be in `.gitignore` from the first commit.
- MongoDB credentials only via `MONGODB_URI`.

## 5. Database Collections

**users**
`name, email (unique), photo, phone, address, role (default "customer"), createdAt, updatedAt`

**equipment**
`name, description, category, location, rentalPrice, rentalType ("daily"|"weekly"|"monthly"), availableQuantity, condition, brand, model, image, terms, status ("pending"|"approved"|"rejected"), owner: { name, email, photo }, createdAt, updatedAt`

**favorites**
`userEmail, equipmentId, createdAt` (unique on userEmail + equipmentId)

**bookings**
`equipmentId, equipmentName, customer: { name, email, phone }, ownerEmail, startDate, endDate, quantity, totalAmount, deliveryAddress, notes, paymentStatus ("unpaid"|"paid"|"failed"), bookingStatus ("pending"|"confirmed"|"active"|"completed"|"cancelled"), stripeSessionId, createdAt`

**payments**
`bookingId, customerEmail, ownerEmail, amount, currency, transactionId, stripeSessionId, status, paidAt`

Create indexes: `users.email` unique, `favorites (userEmail, equipmentId)` unique, `equipment.status`, `equipment.category`, `equipment.owner.email`, `bookings.customer.email`, `bookings.ownerEmail`.

## 6. Authentication and Authorization

The frontend handles register/login/Google (BetterAuth). The backend:

1. `POST /api/auth/jwt` — receives the user's email, upserts the user in `users` (Google users and new users default to `customer`), issues a JWT, and sets it as an **httpOnly, secure, sameSite** cookie (also return it in the body only if the frontend needs a Bearer fallback).
2. `POST /api/auth/logout` — clears the cookie.
3. JWT payload contains only `email`. **Always read the role from the database inside the middleware.** Never trust a role sent by the client.

### Middlewares (Challenge 2 — required, exact names)

- `verifyToken` — read the token from the cookie or the `Authorization: Bearer` header, verify it, attach `req.user`. Return `401` if missing/invalid.
- `verifyCustomer` — runs after `verifyToken`; requires role `customer`. `403` otherwise.
- `verifyOwner` — requires role `owner`. `403` otherwise.
- `verifyAdmin` — requires role `admin`. `403` otherwise.

Resource ownership checks: an owner can only edit/delete their own equipment; a customer can only see their own bookings and favorites.

## 7. API Endpoints

### Auth
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/jwt` | public |
| POST | `/api/auth/logout` | public |

### Users
| Method | Path | Access |
|---|---|---|
| GET | `/api/users/me` | any logged-in |
| PATCH | `/api/users/me` | any logged-in (name, photo, phone, address only) |
| GET | `/api/users` | admin |
| PATCH | `/api/users/:id/role` | admin (customer/owner/admin) |
| DELETE | `/api/users/:id` | admin |

### Equipment
| Method | Path | Access |
|---|---|---|
| GET | `/api/equipment` | public — approved only, with search/filter/sort/pagination |
| GET | `/api/equipment/featured` | public — 6 approved items using `limit(6)` |
| GET | `/api/equipment/categories` | public |
| GET | `/api/equipment/:id` | logged-in |
| POST | `/api/equipment` | owner — status forced to `pending` |
| GET | `/api/equipment/owner/mine` | owner |
| PATCH | `/api/equipment/:id` | owner (own) or admin |
| DELETE | `/api/equipment/:id` | owner (own) or admin |
| GET | `/api/admin/equipment` | admin — all statuses |
| PATCH | `/api/admin/equipment/:id/status` | admin — approve/reject |

### Search / Filter / Sort (Challenge 1 — must be server-side)

`GET /api/equipment` query params:
- `search` — regex, case-insensitive on `name`, `category` and `location`
- `category`, `rentalType`
- `minPrice`, `maxPrice`
- `availability` — `available` means `availableQuantity > 0`
- `sort` — `price_asc`, `price_desc`, `newest`
- `page`, `limit` (default 9, so a 3-column grid fills evenly)

Response shape: `{ data, total, page, totalPages }`. Escape regex special characters in `search`.

### Favorites (customer)
| Method | Path |
|---|---|
| POST | `/api/favorites` |
| GET | `/api/favorites` |
| DELETE | `/api/favorites/:equipmentId` |

### Bookings
| Method | Path | Access |
|---|---|---|
| POST | `/api/bookings/checkout` | customer — validate, check availability, calculate total, create pending booking, create Stripe Checkout session, return `url` |
| GET | `/api/bookings/mine` | customer (paginated) |
| GET | `/api/bookings/owner` | owner — rentals of own equipment |
| GET | `/api/admin/bookings` | admin |
| PATCH | `/api/admin/bookings/:id` | admin — update status |

**Total amount rule** (calculate on the server, never trust the client):
- `daily`: `days × price × quantity`
- `weekly`: `ceil(days / 7) × price × quantity`
- `monthly`: `ceil(days / 30) × price × quantity`

**Availability rule:** quantity requested must be `<= availableQuantity`, minus quantities in overlapping `confirmed`/`active` bookings for the same date range. Reject past start dates and end date earlier than start date.

### Payments (Stripe)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/payments/webhook` | Stripe webhook, uses `express.raw`, **registered before `express.json()`** |
| GET | `/api/payments/verify/:sessionId` | customer — fallback verification for the success page |

On `checkout.session.completed`: set booking `paymentStatus: "paid"`, `bookingStatus: "confirmed"`, decrement/reserve equipment quantity, insert a record into `payments` with `transactionId`. Make this handler **idempotent** (do nothing if the session was already processed).

### Analytics (Challenge 3)
| Method | Path | Access |
|---|---|---|
| GET | `/api/analytics/admin` | admin |
| GET | `/api/analytics/owner` | owner |
| GET | `/api/analytics/customer` | customer (optional) |

**Admin:** total users, total equipment, total bookings, pending approvals, completed rentals, total revenue, monthly booking statistics (aggregation grouped by month).

**Owner:** total listed equipment, completed rentals, total earnings, monthly earnings (aggregate `payments` filtered by `ownerEmail`).

Use MongoDB aggregation pipelines, and return chart-ready arrays like `[{ month: "Jan", bookings: 4, revenue: 1200 }]`.

## 8. Cross-Cutting Rules

- **CORS:** allow only `CLIENT_URL` (plus localhost in development) with `credentials: true`. Handle `OPTIONS` preflight.
- **Cookies in production:** `secure: true`, `sameSite: "none"` for cross-site client/server deployments.
- Use a central error handler and a JSON `404` handler. Never leak stack traces in production.
- Validate every request body and query with `zod`. Never accept `role`, `status`, `ownerEmail` or `paymentStatus` from the client on create/update endpoints.
- Convert `:id` params with `ObjectId.isValid` before querying; return `400` for invalid ids.
- Use consistent response shapes and correct status codes (200, 201, 400, 401, 403, 404, 409, 500).
- Cache the MongoDB client connection (important for serverless deployment such as Vercel, to avoid 504 timeouts).
- Add `GET /` health route returning a simple JSON message.
- Do not log secrets or tokens.

## 9. Optional Features (implement only after the core is complete)

1. **Pagination:** All Equipment and booking history endpoints.
2. **Cron job (`node-cron`):** daily job that marks bookings `completed` when `endDate` has passed and returns the quantity to the equipment. Note: serverless hosts (Vercel) do not run persistent cron jobs. If deploying there, expose a protected `/api/jobs/update-bookings` endpoint and trigger it with an external scheduler, and tell the user.
3. **Email notifications (`nodemailer`):** send mail to the customer and the owner when a booking is completed. Failure to send an email must never fail the main request.

## 10. Build Phases

Work one phase at a time. After each phase, stop, summarise what was done, and wait for the user to say continue.

1. **Setup** — init project (ES Modules), Express app, folder structure, `.env.example`, `.gitignore`, health route, DB connection.
2. **Auth and users** — JWT route, logout, `verifyToken` + role middlewares, users endpoints.
3. **Equipment** — CRUD, featured, categories, owner/admin routes, approval.
4. **Search/filter/sort/pagination** — Challenge 1.
5. **Favorites.**
6. **Bookings** — availability check, price calculation, listing endpoints.
7. **Stripe** — checkout session, webhook, payment record, verify endpoint.
8. **Analytics** — admin and owner aggregations.
9. **Hardening** — validation, error handling, CORS check, indexes.
10. **Optional** — cron, email.
11. **README and deployment** — final checks.

## 11. Git Commit Rules

- Minimum **12 meaningful commits** on the server. Aim for 15+.
- Small, descriptive, imperative messages, for example:
  - `chore: initialize express server with javascript`
  - `feat: add mongodb connection with cached client`
  - `feat: add jwt login and logout routes`
  - `feat: add verifyToken and role based middlewares`
  - `feat: add equipment crud endpoints for owners`
  - `feat: add server side search filter and sort for equipment`
  - `feat: add favorites endpoints`
  - `feat: add booking checkout with availability check`
  - `feat: integrate stripe webhook and payment records`
  - `feat: add admin and owner analytics aggregations`
  - `fix: handle cors preflight for production client`
  - `docs: add readme with features and packages`
- One feature per commit. Never commit `.env`.

## 12. README Requirements

Must include: project name, purpose, **live server URL**, key features, list of all npm packages used, how to run locally, and the environment variable names (without values).

## 13. Final Checklist Before Submission

- [ ] No secrets in the repo; `.env.example` present
- [ ] All routes protected by the correct middleware
- [ ] Role is always read from the database, never from the client
- [ ] Equipment created by owners starts as `pending`
- [ ] Only `approved` equipment appears in public endpoints
- [ ] Total amount and availability are computed on the server
- [ ] Stripe webhook works in production and is idempotent
- [ ] Payment saved in `payments`, booking marked `paid`
- [ ] Search, filter, sort run in MongoDB (not in JS)
- [ ] Analytics return correct numbers and chart-ready data
- [ ] No CORS / 404 / 504 errors on the live server
- [ ] Logged-in user stays logged in after page reload (cookie/JWT persists)
- [ ] 12+ commits with clear messages
- [ ] README complete with live URL

## 14. Agent Behavior

- Ask before making any decision that is not covered here (for example hosting platform).
- Do not add features, packages or collections that are not listed.
- Keep code simple, readable and well-commented where logic is non-obvious. No unused code.
- Never expose or print secret values.