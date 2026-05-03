# Stripe SaaS Billing MVP

> A production-style SaaS billing system where **Stripe is the single source of truth** for all payment outcomes. Built with NestJS, Next.js, Supabase PostgreSQL, and TypeORM.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core Payment Flow](#core-payment-flow)
- [Scope](#scope)
- [Out of Scope](#out-of-scope)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Webhook Testing](#webhook-testing)
- [Key Engineering Decisions](#key-engineering-decisions)
- [API Reference](#api-reference)
- [Rules & Constraints](#rules--constraints)

---

## Overview

This MVP demonstrates a secure, production-grade SaaS billing pipeline. It covers the complete lifecycle of a payment — from a user initiating checkout on the frontend, through backend PaymentIntent creation, to Stripe webhook-based confirmation and subscription activation.

The system is designed with the following guarantees:

- The **frontend never decides payment success**
- The **Stripe webhook is the only activation trigger** for subscriptions
- **Duplicate webhooks are safely ignored** via deduplication
- **Race conditions are prevented** using database transactions with row-level locking
- **Duplicate payment creation is blocked** using idempotency keys

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | NestJS (Node.js)                    |
| Frontend    | Next.js with Stripe Elements        |
| Database    | Supabase (PostgreSQL)               |
| ORM         | TypeORM                             |
| Payments    | Stripe API + Stripe Webhooks        |
| Validation  | class-validator + class-transformer |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                          │
│              Next.js + Stripe Elements                   │
│         /checkout    /success    /cancel                 │
└────────────────────────┬────────────────────────────────┘
                         │  POST /payment/create-intent
                         ▼
┌─────────────────────────────────────────────────────────┐
│                        Backend                           │
│                       NestJS                             │
│                                                          │
│   PaymentModule          WebhookModule                   │
│   ─────────────          ─────────────                   │
│   - Idempotency check    - Signature verification        │
│   - PaymentIntent create - Deduplication                 │
│   - DB record insert     - Transaction + row lock        │
│                          - Subscription activation       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL                    │
│                                                          │
│   payments   subscriptions   webhook_events              │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │  Webhook events
┌────────────────────────┴────────────────────────────────┐
│                        Stripe                            │
│         payment_intent.succeeded / payment_failed        │
└─────────────────────────────────────────────────────────┘
```

---

## Core Payment Flow

```
1.  User opens /checkout on the Next.js frontend
2.  Frontend calls POST /payment/create-intent on the backend
3.  Backend checks if idempotencyKey already exists in the database
4.  If duplicate → returns existing paymentIntentId (no new record created)
5.  If new → creates Stripe PaymentIntent via Stripe API
6.  Backend saves Payment record to DB with status: 'pending'
7.  Backend returns client_secret to the frontend
8.  Frontend uses Stripe Elements to complete payment with client_secret
9.  Stripe processes the payment and sends a webhook to POST /webhook/stripe
10. Backend verifies the webhook signature using the signing secret
11. Backend checks if stripeEventId already exists (deduplication)
12. If duplicate webhook → returns 200 OK and stops
13. If new event → saves WebhookEvent record to DB
14. On payment_intent.succeeded → opens a transaction, locks the Payment row,
    updates status to 'succeeded', creates Subscription with status: 'active'
15. On payment_intent.payment_failed → updates Payment status to 'failed'
```

---

## Scope

The following features are included in this MVP:

- **PaymentIntent Creation** — Backend creates Stripe PaymentIntent and stores a pending payment record
- **Stripe Webhook Verification** — Incoming webhooks are verified using Stripe's signing secret
- **Payment Status Tracking** — Payment status transitions from `pending` → `succeeded` or `failed`
- **Subscription Activation** — Subscription is created only after a verified `payment_intent.succeeded` webhook
- **Idempotency Handling** — Duplicate payment creation is blocked using a unique `idempotencyKey` constraint
- **Race Condition Prevention** — Transactions with `SELECT FOR UPDATE` row locking prevent concurrent conflicts
- **Database Tables** — `payments`, `subscriptions`, `webhook_events`
- **Checkout UI** — Next.js page with Stripe Elements for card input
- **Success & Cancel Pages** — UI flow for payment outcomes

---

## Out of Scope

The following are explicitly excluded from this MVP:

- Full authentication system (JWT, sessions, OAuth)
- Admin dashboard or management interface
- Email notifications (payment receipts, activation emails)
- Retry workers or background job queues
- Refund handling
- Multi-plan subscription management
- Coupons and discount logic
- Advanced analytics or reporting
- Microservices architecture
- Production deployment and infrastructure setup

---

## Project Structure

> `src/` inside both `backend/` and `frontend/` is auto-generated by the CLI. Do not create it manually.

```
stripe-saas-mvp/
│
├── backend/
│   ├── src/
│   │   ├── payment/
│   │   │   ├── payment.module.ts
│   │   │   ├── payment.controller.ts
│   │   │   ├── payment.service.ts
│   │   │   └── dto/
│   │   │       └── create-payment-intent.dto.ts
│   │   │
│   │   ├── webhook/
│   │   │   ├── webhook.module.ts
│   │   │   ├── webhook.controller.ts
│   │   │   └── webhook.service.ts
│   │   │
│   │   ├── entities/
│   │   │   ├── payment.entity.ts
│   │   │   ├── subscription.entity.ts
│   │   │   └── webhook-event.entity.ts
│   │   │
│   │   ├── stripe/
│   │   │   └── stripe.service.ts
│   │   │
│   │   ├── app.module.ts
│   │   └── main.ts
│   │
│   ├── .env
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── checkout/
│   │   │   └── page.tsx
│   │   │
│   │   ├── success/
│   │   │   └── page.tsx
│   │   │
│   │   ├── cancel/
│   │   │   └── page.tsx
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── public/
│   ├── next.config.ts
│   ├── package.json
│   └── .env.local
│
├── .gitignore
└── README.md
```

### Commands to scaffold the project

```bash
# Step 1 — create the monorepo root
mkdir stripe-saas-mvp
cd stripe-saas-mvp

# Step 2 — scaffold the backend (creates backend/ with src/ inside)
nest new backend
# when prompted: select npm as package manager

# Step 3 — scaffold the frontend (creates frontend/ with src/ inside)
npx create-next-app@latest frontend
# when prompted: yes to TypeScript, yes to src/ directory, yes to App Router
```

After both commands complete, create the feature folders manually inside `backend/src/` using the Nest CLI:

```bash
cd backend
nest g module payment
nest g controller payment
nest g service payment

nest g module webhook
nest g controller webhook
nest g service webhook
```

The Nest CLI will place all generated files inside `src/` automatically.

---

## Database Schema

### `payments`

| Column                | Type      | Constraints                                       |
| --------------------- | --------- | ------------------------------------------------- |
| id                    | UUID      | Primary Key                                       |
| userId                | VARCHAR   | Not Null                                          |
| stripePaymentIntentId | VARCHAR   | Unique, Not Null                                  |
| idempotencyKey        | VARCHAR   | Unique, Not Null                                  |
| amount                | INTEGER   | Not Null (in cents)                               |
| currency              | VARCHAR   | Not Null (e.g. `usd`)                             |
| status                | VARCHAR   | `pending` / `succeeded` / `failed`                |
| failureReason         | VARCHAR   | Nullable (stores failure reason if payment fails) |
| createdAt             | TIMESTAMP | Auto                                              |
| updatedAt             | TIMESTAMP | Auto                                              |

---

### `subscriptions`

| Column               | Type      | Constraints                    |
| -------------------- | --------- | ------------------------------ |
| id                   | UUID      | Primary Key                    |
| userId               | VARCHAR   | Not Null                       |
| stripeSubscriptionId | VARCHAR   | Nullable                       |
| planName             | VARCHAR   | Nullable (e.g. `Basic`, `Pro`) |
| status               | VARCHAR   | `active` / `inactive`          |
| activatedAt          | TIMESTAMP | Set on activation              |
| paymentId            | UUID      | Foreign Key → payments         |
| createdAt            | TIMESTAMP | Auto                           |
| updatedAt            | TIMESTAMP | Auto                           |

---

### `webhook_events`

| Column        | Type      | Constraints                                  |
| ------------- | --------- | -------------------------------------------- |
| id            | UUID      | Primary Key                                  |
| stripeEventId | VARCHAR   | Unique, Not Null                             |
| type          | VARCHAR   | e.g. `payment_intent.succeeded`              |
| payload       | JSONB     | Nullable (stores raw Stripe webhook payload) |
| processedAt   | TIMESTAMP | Set on insert                                |

---

## Environment Variables

### `backend/.env`

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App
PORT=4000
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm or yarn
- Stripe account (for API keys)
- Supabase project (for PostgreSQL connection string)
- Stripe CLI (for local webhook forwarding)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/stripe-saas-mvp.git
cd stripe-saas-mvp
```

### 2. Set Up the Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
npm run start:dev
```

### 3. Set Up the Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
npm run dev
```

### 4. Run Database Migrations

TypeORM is configured with `synchronize: true` for development. On first run, it will auto-create all tables in your Supabase database.

> **Note:** Disable `synchronize` in production and use proper migrations.

---

## Webhook Testing

Use the Stripe CLI to forward webhook events to your local backend during development.

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Other platforms: https://stripe.com/docs/stripe-cli
```

### Login and Forward

```bash
stripe login
stripe listen --forward-to localhost:4000/webhook/stripe
```

The CLI will print a webhook signing secret. Copy it into `backend/.env` as `STRIPE_WEBHOOK_SECRET`.

### Trigger Test Events

```bash
# Simulate a successful payment
stripe trigger payment_intent.succeeded

# Simulate a failed payment
stripe trigger payment_intent.payment_failed
```

---

## Key Engineering Decisions

**Stripe as source of truth**
Payment success is never determined by the frontend or by the API response from Stripe's PaymentIntent creation. The only trigger for subscription activation is a verified `payment_intent.succeeded` webhook event.

**Idempotency keys**
Every payment creation request must include a client-generated `idempotencyKey`. The backend checks this key against the database before calling Stripe. If a match is found, the existing record is returned without creating a duplicate.

**Webhook deduplication**
Every incoming webhook event is checked against the `webhook_events` table using `stripeEventId` as a unique constraint. Duplicate events (which Stripe can send) are silently acknowledged and dropped.

**Row-level locking**
Inside the webhook success handler, the `payments` row is fetched using `SELECT FOR UPDATE` inside a database transaction. This prevents two concurrent webhook deliveries from both creating a subscription for the same payment.

**Raw body for webhook verification**
The `/webhook/stripe` endpoint must receive the raw unparsed request body. NestJS's default JSON body parser is bypassed for this route so that `stripe.webhooks.constructEvent()` can verify the signature correctly.

---

## API Reference

### `POST /payment/create-intent`

Creates a Stripe PaymentIntent and stores a pending payment record.

**Request Body:**

```json
{
  "userId": "user_123",
  "amount": 2999,
  "currency": "usd",
  "idempotencyKey": "uuid-v4-generated-by-client"
}
```

**Response:**

```json
{
  "clientSecret": "pi_xxx_secret_xxx"
}
```

---

### `POST /webhook/stripe`

Receives and processes Stripe webhook events.

**Headers:**

```
stripe-signature: t=...,v1=...
```

**Handled Events:**

| Event                           | Action                                               |
|---------------------------------|------------------------------------------------------|
| `payment_intent.succeeded`      | Updates payment to `succeeded`, activates subscription |
| `payment_intent.payment_failed` | Updates payment to `failed`                          |

**Response:** `200 OK` on success, `400 Bad Request` if signature verification fails.

---

## Rules & Constraints

These rules are enforced by the system design and must not be violated:

1. **Frontend never decides payment success** — the UI only redirects to a success page; it does not activate anything
2. **Stripe webhook is the only source of truth** — subscription activation happens exclusively from verified webhook events
3. **Subscription activation only from webhook** — no direct API endpoint exists to activate a subscription
4. **Duplicate webhook events are ignored** — idempotent processing is enforced via the `webhook_events` table
5. **No frontend access to subscription activation** — there is no public endpoint that can activate a subscription directly

---

## License

MIT
