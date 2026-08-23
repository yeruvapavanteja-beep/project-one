# AgriSmart Connect

**Smart Farming. Better Decisions. Direct to Customers.**

AgriSmart Connect is an AI-assisted (rule-based, ML-ready) agriculture platform that helps
farmers choose crops using soil, season, water, weather, and market-demand data, track crop
growth, and sell — including pre-harvest — directly to customers.

> Recommendations are decision-support suggestions only. They are **not** a guarantee of yield,
> profit, or market price, and do not replace a certified soil lab test or a qualified
> agricultural expert.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no framework), Chart.js for analytics
- **Backend:** Node.js, Express.js, REST API, MVC structure
- **Database:** MySQL (raw parameterized SQL via `mysql2`, connection pooling)
- **Auth:** JWT + bcrypt password hashing
- **Uploads:** Multer (crop/growth/profile images)

---

## Project Structure

```
agrismart-connect/
├── backend/
│   ├── server.js
│   ├── config/        db.js, jwt.js, upload.js
│   ├── controllers/    11 controllers (auth, farm, soil, recommendation, crop, growth,
│   │                    marketplace, prebooking, order, notification, analytics, admin)
│   ├── middleware/     auth.js, errorHandler.js, validate.js
│   ├── models/         raw parameterized SQL, one file per table/domain
│   ├── routes/         one file per module, mounted under /api/*
│   ├── services/       soilAnalysisService.js, recommendationEngine.js (the scoring engine)
│   ├── utils/          response.js, notify.js, seedDemo.js
│   └── uploads/        crops/ growth/ profiles/ (created at runtime)
├── frontend/
│   ├── index.html              landing page
│   ├── login.html / register.html / forgot-password.html
│   ├── farmer-dashboard.html   SPA: farm, soil, recommendations, crops, growth, harvest,
│   │                            pre-bookings, orders, analytics, notifications, profile
│   ├── customer-dashboard.html SPA: upcoming harvests, pre-bookings, orders, favorites, profile
│   ├── admin-dashboard.html    SPA: platform stats, farmers, customers, crops, orders,
│   │                            pre-bookings, complaints, categories/locations
│   ├── marketplace.html        public browse + filters + cart + checkout
│   ├── crop-details.html       public crop page with growth timeline
│   ├── css/                    style.css (tokens), landing.css, dashboard.css, marketplace.css,
│   │                            auth.css, responsive.css
│   └── js/                     api.js (fetch wrapper), auth.js, main.js, farmer.js, customer.js,
│                                admin.js, marketplace.js, booking.js
└── database/
    └── schema.sql       full normalized schema + seed reference data (categories, crop_master, weights)
```

---

## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.5+)

### 2. Database

```bash
mysql -u root -p < database/schema.sql
```

This creates the `agrismart_connect` database, all 21 tables, and seeds:
- Default recommendation weights (soil 30%, season 20%, water 20%, weather 15%, demand 15%)
- 5 categories (Vegetables, Fruits, Leafy Vegetables, Organic Produce, Grains & Pulses)
- 10 reference crops in `crop_master` (Tomato, Chilli, Okra, Potato, Onion, Spinach, Cabbage,
  Mango, Banana, Watermelon) with ideal soil/water ranges used by the recommendation engine

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DB_PASSWORD and a real JWT_SECRET
npm run dev        # nodemon, or `npm start` for plain node
```

Backend runs on `http://localhost:5000`. Health check: `GET /api/health`.

**Optional — seed demo data** (1 admin, 1 farmer, 1 customer, 1 farm, 1 growing crop open for
pre-booking, 1 sample pre-booking, sample demand data):

```bash
npm run seed
```

Demo logins (password `Password123` for all):
| Role | Email |
|---|---|
| Admin | admin@agrismart.test |
| Farmer | ramesh@agrismart.test |
| Customer | sana@agrismart.test |

### 4. Frontend

The frontend is static HTML/CSS/JS — no build step. Serve it with any static server, e.g.:

```bash
cd frontend
npx serve .
# or: python3 -m http.server 3000
```

Open `http://localhost:3000`. `js/api.js` auto-detects `localhost` and points API calls at
`http://localhost:5000/api`; update `API_BASE_URL` in that file for a non-local deployment.

---

## Core Innovation: Pre-Harvest Booking

Farmers open part of an upcoming harvest (`available_for_prebooking_kg`) before it's picked.
Customers reserve quantity; the booking endpoint runs inside a MySQL transaction with
`SELECT ... FOR UPDATE` row locking so concurrent bookings can never oversell a crop. Cancelling
a booking atomically releases the reserved quantity. A farmer cannot pre-book their own crop.

## Crop Recommendation Engine

`backend/services/recommendationEngine.js` scores every crop in `crop_master` against the
farmer's soil/season/water/weather inputs plus live (or seeded-sample, clearly flagged) demand
data, combined via configurable weights stored in `recommendation_weights`. Output is a ranked
list with a suitability label, demand outlook, and a plain-language "why this crop" explanation.
This module is intentionally the only piece a future Python/ML model would need to replace —
the API contract (`generateRecommendations()` → ranked array) stays identical.

## Security Notes

- Passwords hashed with bcrypt (12 rounds), never stored or logged in plain text
- JWT-based auth with role-based middleware (`authenticate` + `authorize(...)`)
- All SQL uses named parameterized queries — no string-concatenated queries anywhere
- Multer restricts uploads to JPEG/PNG/WEBP, 5MB max, random filenames
- `.env` holds all secrets; never commit it (see `.gitignore`)
- Errors are sanitized before reaching the client — no stack traces or DB details leak

## Known Limitations (v1)

- No real payment gateway — `payment_status`/`payment_method` fields exist as
  payment-ready architecture only
- Weather input is a simple qualitative selector (temperature/rainfall band), not a live
  weather API integration
- Demand analytics blend real platform activity with seeded sample data until enough real
  activity accumulates — every response flags which is which (`isSample` / `is_sample_data`)
