# GearLoop — Equipment Rental Platform (Server)

REST API for **GearLoop**, an equipment rental marketplace (Assignment 09 – Category 003). **Owners** list equipment, **Customers** browse, book and pay with Stripe, and **Admins** approve listings and manage the platform.

This repository is the **backend only**. The frontend (Next.js + BetterAuth) lives in a separate repo and uses this API.

| | |
| --- | --- |
| 🌐 **Live API** | [gearloop-server.vercel.app](https://gearloop-server.vercel.app) |
| 💻 **Client repo** | [mdsolimansikder7/assignment-09-client](https://github.com/mdsolimansikder7/assignment-09-client) |
| 🖥️ **Live site** | [gearloop-rent.vercel.app](https://gearloop-rent.vercel.app/) |
| ❤️ **Health check** | `GET /` → `{ "success": true, "message": "Equipment Rental API is running" }` |

---

## ✨ Key Features

- **JWT authentication** — `POST /api/auth/jwt` upserts the user, issues a JWT (payload contains only `email`) and sets it in an `httpOnly` cookie (`secure` + `sameSite: "none"` in production). `Authorization: Bearer <token>` also works.
- **Role-based authorization** — `verifyToken`, `verifyCustomer`, `verifyOwner`, `verifyAdmin`. The role is **always read from MongoDB**, never from the client or the token.
- **Equipment management** — owner CRUD, with `pending → approved / rejected` moderation by admins. Only approved equipment is public.
- **Server-side search, filter, sort and pagination** — all executed by MongoDB with regex-escaped search. Response shape: `{ data, total, page, totalPages }`.
- **Favorites** — customer-only, unique per user/equipment, joined with equipment through aggregation.
- **Bookings** — server-computed totals (daily / weekly / monthly), overlap-aware availability, past dates rejected, paginated history for customers, owners and admins.
- **Stripe payments** — Checkout session with a server-computed amount, raw-body webhook with signature verification and idempotent processing, payment records, and a fallback verification for the success page.
- **Analytics** — MongoDB aggregation pipelines that return chart-ready `[{ month, year, bookings, revenue }]` data for admin, owner and customer dashboards.
- **Scheduled cleanup** — a daily `node-cron` job completes expired rentals and frees their reserved stock, plus a protected HTTP trigger for serverless hosts.
- **Email notifications** — `nodemailer` mails the customer and owner when a rental is completed. A mail failure never fails the request.
- **Production hardening** — zod validation on every body/query, `ObjectId` validation, central error handler, JSON 404s, strict CORS with preflight, no stack traces or secrets in production responses, cached MongoDB client (serverless-safe), and indexes on hot queries.

---

## 🧰 Tech Stack

Node.js (ES Modules, no TypeScript) + Express 5 + MongoDB.

| Package | Version | Purpose |
| --- | --- | --- |
| `express` | ^5.3.0 | HTTP framework |
| `mongodb` | ^7.9.0 | Official MongoDB driver |
| `jsonwebtoken` | ^9.0.3 | JWT signing and verification |
| `cookie-parser` | ^1.4.7 | httpOnly cookie parsing |
| `cors` | ^2.8.6 | CORS and preflight for the frontend origin |
| `dotenv` | ^18.0.10 | Environment variables |
| `zod` | ^4.6.7 | Request validation |
| `stripe` | ^23.1.0 | Checkout sessions and webhooks |
| `node-cron` | ^4.6.0 | Daily booking completion job |
| `nodemailer` | ^10.6.0 | Rental completion emails |

---

## 🚀 Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/mdsolimansikder7/assignment-09-server.git
cd assignment-09-server

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env      # then fill in your values

# 4. Start the dev server
npm run dev               # http://localhost:5000
```

Production start:

```bash
npm start                 # node src/index.js
```

The API still starts if MongoDB is temporarily unreachable, so it never crashes on a cold start.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`. Only names are listed here, never real values.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `5000`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `DB_NAME` | Database name (optional, defaults to the database in the URI) |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_URL` | Frontend origin allowed by CORS and used for Stripe redirect URLs |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe signing secret (`whsec_…`) |
| `NODE_ENV` | `development` or `production` |
| `EMAIL_USER` | Gmail address used to send notifications |
| `EMAIL_PASS` | Gmail app password |

> `.env` is git-ignored. Never commit real credentials.

---

## 🔌 API Overview

### Auth

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/jwt` | Public — upsert user and issue JWT cookie |
| POST | `/api/auth/logout` | Public — clear cookie |

### Users

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/users/me` | Logged-in |
| PATCH | `/api/users/me` | Logged-in — `name`, `photo`, `phone`, `address` only |
| GET | `/api/users` | Admin |
| PATCH | `/api/users/:id/role` | Admin — `customer` / `owner` / `admin` |
| DELETE | `/api/users/:id` | Admin |

### Equipment

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/equipment` | Public — approved only |
| GET | `/api/equipment/featured` | Public — 6 newest approved |
| GET | `/api/equipment/categories` | Public |
| GET | `/api/equipment/:id` | Logged-in (pending items: owner/admin only) |
| POST | `/api/equipment` | Owner — forced to `pending` |
| GET | `/api/equipment/owner/mine` | Owner |
| PATCH | `/api/equipment/:id` | Own owner or admin |
| DELETE | `/api/equipment/:id` | Own owner or admin |
| GET | `/api/admin/equipment` | Admin — all statuses, optional `?status=` |
| PATCH | `/api/admin/equipment/:id/status` | Admin — `approved` / `rejected` |

`GET /api/equipment` query params: `search` (name / category / location, case-insensitive), `category`, `rentalType`, `minPrice`, `maxPrice`, `availability=available`, `sort` (`price_asc`, `price_desc`, `newest`), `page`, `limit` (default 9, max 50).

### Favorites (customer)

| Method | Path |
| --- | --- |
| POST | `/api/favorites` |
| GET | `/api/favorites` |
| DELETE | `/api/favorites/:equipmentId` |

### Bookings

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/bookings/checkout` | Customer — creates booking and Stripe session, returns `url` |
| GET | `/api/bookings/mine` | Customer, paginated |
| GET | `/api/bookings/owner` | Owner, paginated |
| GET | `/api/admin/bookings` | Admin, paginated |
| PATCH | `/api/admin/bookings/:id` | Admin — update `bookingStatus` |

**Pricing (server-side):**

- `daily = days × price × quantity`
- `weekly = ceil(days / 7) × price × quantity`
- `monthly = ceil(days / 30) × price × quantity`
- A same-day rental counts as one day.

**Availability:** the requested quantity must fit `availableQuantity` minus the quantities of `confirmed` / `active` bookings whose dates overlap the request. Past start dates and `endDate < startDate` are rejected.

### Payments

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/payments/webhook` | Stripe webhook, raw body and signature verification |
| GET | `/api/payments/verify/:sessionId` | Customer — fallback verification for the success page |

### Analytics

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/analytics/admin` | Admin |
| GET | `/api/analytics/owner` | Owner |
| GET | `/api/analytics/customer` | Customer |

### Jobs

| Method | Path | Access |
| --- | --- | --- |
| GET / POST | `/api/jobs/update-bookings` | Admin — completes expired bookings |

---

## 💳 Stripe Setup

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env`.
2. In the Stripe Dashboard, create a webhook endpoint pointing to `https://gearloop-server.vercel.app/api/payments/webhook` and subscribe to `checkout.session.completed`.
3. Locally, forward events and use the signing secret it prints:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

The webhook handler is idempotent: replayed events do not create duplicate payments, and a booking is confirmed only once.

---

## ▲ Deployment (Vercel)

This repo is prepared for Vercel's Node.js serverless runtime:

- `api/index.js` exports the Express app.
- `api/webhook.js` is a dedicated function that reads the **raw** Stripe body before any parsing (Vercel may parse JSON for the main function, which would break signature verification).
- `vercel.json` rewrites `/api/payments/webhook` to that function and everything else to the Express app.

**Steps**

1. Import the repository into Vercel.
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables**. Use `NODE_ENV=production` and the production `CLIENT_URL` origin with no trailing slash.
3. Deploy, then point the Stripe webhook URL to `https://gearloop-server.vercel.app/api/payments/webhook`.

**Scheduled job on Vercel:** serverless hosts do not keep persistent `node-cron` jobs (the scheduler logs that it is disabled when `VERCEL=1`). Trigger the cleanup from an external scheduler such as cron-job.org:

```
GET https://gearloop-server.vercel.app/api/jobs/update-bookings
Authorization: Bearer <admin JWT>
```

**Cookies:** in production the auth cookie is `secure` and `sameSite: "none"`, so the frontend and API can live on different domains. Make sure `CLIENT_URL` matches the frontend origin exactly and requests use `credentials: "include"`.

---

## 📁 Project Structure

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

---

## 📝 Notes

- **Stock reservation:** a paid (`confirmed`) booking reserves stock through the availability calculation, so `availableQuantity` is never decremented. Otherwise overlapping-date checks would double-count and block valid rentals. Completing or cancelling a booking releases its reservation automatically.
- **Responses** are consistent: `{ success: true, data, ... }` or `{ success: false, message }` with proper status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `413`, `500`, `502`, `503`).
- **Security:** secrets are read from `.env` only, never logged, and `.env` is ignored by git.

---

## 👤 Author

**Md Soliman Sikder** — CSE student, Sonargaon University

- GitHub: [@mdsolimansikder7](https://github.com/mdsolimansikder7)
- LinkedIn: [md-soliman-sikder](https://www.linkedin.com/in/md-soliman-sikder-b17887237)
