# Equipment Rental Platform — Server

REST API for an equipment rental marketplace where **owners** list equipment, **customers** browse, book and pay with Stripe, and **admins** approve listings and manage the platform. This repository is the **backend only**; the frontend (Next.js + BetterAuth) lives in a separate repo and consumes this API.

- **Live API:** `https://YOUR-PROJECT.vercel.app` *(replace with the deployed URL after deploying to Vercel)*
- **Health check:** `GET /` → `{ "success": true, "message": "Equipment Rental API is running" }`

## Key features

- **JWT authentication** — `POST /api/auth/jwt` upserts the user, issues a JWT (payload contains only `email`) and sets it in a `httpOnly` cookie (`secure` + `sameSite: "none"` in production). `Authorization: Bearer <token>` also works.
- **Role-based authorization** — `verifyToken`, `verifyCustomer`, `verifyOwner`, `verifyAdmin`. The role is **always read from MongoDB**, never from the client or the token.
- **Equipment management** — owner CRUD, `pending → approved/rejected` moderation by admins. Only approved equipment is public.
- **Server-side search, filter, sort and pagination** (Challenge 1) — all executed by MongoDB, regex-escaped search, `{ data, total, page, totalPages }` response.
- **Favorites** — customer-only, unique per user/equipment, joined with equipment via aggregation.
- **Bookings** — server-computed totals (daily/weekly/monthly), overlap-aware availability, reject past dates, paginated history for customers/owners/admins.
- **Stripe payments** — Checkout session with server-computed amount, raw-body webhook with signature verification and idempotent processing, payment records, fallback verification for the success page.
- **Analytics** (Challenge 3) — MongoDB aggregation pipelines producing chart-ready `[{ month, year, bookings, revenue }]` data for admin, owner and customer dashboards.
- **Scheduled cleanup** — daily `node-cron` job completes expired rentals (and frees their reserved stock), with a protected HTTP trigger for serverless hosts.
- **Email notifications** — `nodemailer` mails to customer and owner when a rental is completed; mail failures never fail a request.
- **Production hardening** — zod validation on every body/query, `ObjectId` validation, central error handler, JSON 404s, strict CORS with preflight, no stack traces or secrets in production responses, cached MongoDB client (serverless-safe), indexes on hot queries.

## Tech stack and packages

Node.js (ES Modules, no TypeScript) + Express 5 + MongoDB.

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.3.0 | HTTP framework |
| `mongodb` | ^7.9.0 | Official MongoDB driver |
| `jsonwebtoken` | ^9.0.3 | JWT signing/verification |
| `cookie-parser` | ^1.4.7 | httpOnly cookie parsing |
| `cors` | ^2.8.6 | CORS + preflight for the frontend origin |
| `dotenv` | ^18.0.10 | Environment variables |
| `zod` | ^4.6.7 | Request validation |
| `stripe` | ^23.1.0 | Checkout sessions and webhooks |
| `node-cron` | ^4.6.0 | Daily booking completion job |
| `nodemailer` | ^10.6.0 | Rental completion emails |

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5000
```

```bash
npm start              # production start (node src/index.js)
```

The API starts even if MongoDB is temporarily unreachable, and it never crashes on a cold start.

## Environment variables

Copy `.env.example` to `.env`. Names only — values stay out of the repository.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `5000`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `DB_NAME` | Database name (optional, defaults to the URI database) |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_URL` | Frontend origin allowed by CORS and used for Stripe redirect URLs |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe signing secret (`whsec_…`) |
| `NODE_ENV` | `development` or `production` |
| `EMAIL_USER` | Gmail address used to send notifications |
| `EMAIL_PASS` | Gmail app password |

`.env` is git-ignored. Never commit real credentials.

## API overview

### Auth
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/jwt` | public — upsert user + issue JWT cookie |
| POST | `/api/auth/logout` | public — clear cookie |

### Users
| Method | Path | Access |
|---|---|---|
| GET | `/api/users/me` | logged-in |
| PATCH | `/api/users/me` | logged-in — `name`, `photo`, `phone`, `address` only |
| GET | `/api/users` | admin |
| PATCH | `/api/users/:id/role` | admin — `customer` / `owner` / `admin` |
| DELETE | `/api/users/:id` | admin |

### Equipment
| Method | Path | Access |
|---|---|---|
| GET | `/api/equipment` | public — approved only |
| GET | `/api/equipment/featured` | public — 6 newest approved |
| GET | `/api/equipment/categories` | public |
| GET | `/api/equipment/:id` | logged-in (pending items: owner/admin only) |
| POST | `/api/equipment` | owner — forced to `pending` |
| GET | `/api/equipment/owner/mine` | owner |
| PATCH | `/api/equipment/:id` | own owner or admin |
| DELETE | `/api/equipment/:id` | own owner or admin |
| GET | `/api/admin/equipment` | admin — all statuses, optional `?status=` |
| PATCH | `/api/admin/equipment/:id/status` | admin — `approved` / `rejected` |

`GET /api/equipment` query params: `search` (name/category/location, case-insensitive), `category`, `rentalType`, `minPrice`, `maxPrice`, `availability=available`, `sort` (`price_asc`, `price_desc`, `newest`), `page`, `limit` (default 9, max 50).

### Favorites (customer)
| Method | Path |
|---|---|
| POST | `/api/favorites` |
| GET | `/api/favorites` |
| DELETE | `/api/favorites/:equipmentId` |

### Bookings
| Method | Path | Access |
|---|---|---|
| POST | `/api/bookings/checkout` | customer — creates booking + Stripe session, returns `url` |
| GET | `/api/bookings/mine` | customer, paginated |
| GET | `/api/bookings/owner` | owner, paginated |
| GET | `/api/admin/bookings` | admin, paginated |
| PATCH | `/api/admin/bookings/:id` | admin — update `bookingStatus` |

**Pricing (server-side):** `daily = days × price × quantity`, `weekly = ceil(days/7) × price × quantity`, `monthly = ceil(days/30) × price × quantity`. A same-day rental counts as one day.

**Availability:** requested quantity must fit `availableQuantity` minus the quantities of `confirmed`/`active` bookings whose dates overlap the request. Past start dates and `endDate < startDate` are rejected.

### Payments
| Method | Path | Notes |
|---|---|---|
| POST | `/api/payments/webhook` | Stripe webhook, raw body + signature verification |
| GET | `/api/payments/verify/:sessionId` | customer, fallback verification for the success page |

### Analytics
| Method | Path | Access |
|---|---|---|
| GET | `/api/analytics/admin` | admin |
| GET | `/api/analytics/owner` | owner |
| GET | `/api/analytics/customer` | customer |

### Jobs
| Method | Path | Access |
|---|---|---|
| POST / GET | `/api/jobs/update-bookings` | admin — completes expired bookings |

## Stripe setup

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env`.
2. Create a webhook endpoint in the Stripe Dashboard pointing at `https://YOUR-PROJECT.vercel.app/api/payments/webhook` and subscribe to `checkout.session.completed`.
3. Locally, forward events and use the printed signing secret:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

The webhook handler is idempotent: replayed events do not create duplicate payments, and the booking is only confirmed once.

## Deployment (Vercel)

This repo is prepared for Vercel's Node.js serverless runtime:

- `api/index.js` exports the Express app.
- `api/webhook.js` is a dedicated Web-API function that reads the **raw** Stripe body before any parsing (Vercel may parse JSON bodies for the main function, which would break signature verification).
- `vercel.json` rewrites `/api/payments/webhook` to that function and everything else to the Express app.

Steps:

1. Import the repository into Vercel.
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables** (use `NODE_ENV=production` and the production `CLIENT_URL` origin, with no trailing slash).
3. Deploy, then update the Stripe webhook URL to `https://YOUR-PROJECT.vercel.app/api/payments/webhook`.
4. Replace the placeholder live URL at the top of this README.

**Scheduled job on Vercel:** serverless hosts do not run persistent `node-cron` jobs (the scheduler logs that it is disabled when `VERCEL=1`). Trigger the cleanup from an external scheduler (e.g. cron-job.org) with:

```
GET https://YOUR-PROJECT.vercel.app/api/jobs/update-bookings
Authorization: Bearer <admin JWT>
```

**Cookies:** in production the auth cookie is `secure` and `sameSite: "none"`, so the frontend and API may live on different domains — just make sure `CLIENT_URL` matches the frontend origin exactly and requests use `credentials: "include"`.

## Project structure

```
.
├── api/                 # Vercel serverless entry points
│   ├── index.js         # exports the Express app
│   └── webhook.js       # raw-body Stripe webhook function
├── src/
│   ├── config/          # env, cached MongoDB client, stripe, indexes
│   ├── middlewares/     # verifyToken, verifyCustomer/Owner/Admin, error/404
│   ├── routes/          # auth, users, equipment, favorites, bookings, payments, analytics, admin, jobs
│   ├── controllers/
│   ├── services/        # pricing, availability, analytics, email
│   ├── jobs/            # cron scheduler + update-bookings job
│   ├── utils/           # tokens, serializers, validation, ObjectId, regex
│   ├── app.js           # Express app (no listen)
│   └── index.js         # listen + DB connect + cron
├── .env.example
├── vercel.json
└── package.json
```

## Notes

- **Stock reservation:** a paid (`confirmed`) booking reserves stock through the availability calculation, so `availableQuantity` is never decremented; otherwise overlapping-date checks would double-count and block legitimate rentals. Completing or cancelling a booking releases its reservation automatically.
- **Responses** are consistent: `{ success: true, data, ... }` or `{ success: false, message }` with proper status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `413`, `500`, `502`, `503`).
- **Security:** secrets are read from `.env` only, never logged, and `.env` is ignored by git from the first commit.
