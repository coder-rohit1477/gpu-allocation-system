# PBL GPU Manager

A full-stack GPU resource management system for academic institutions.

## Stack
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, Sonner (toasts)
- **Backend**: Node.js, Express 4, Mongoose 8, JWT
- **Database**: MongoDB 7

## Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)

### 1 — Backend

```bash
cd backend
cp .env.example .env      # fill in MONGODB_URI and JWT_SECRET
npm install
npm run seed              # creates demo users + GPU data
npm start                 # http://localhost:5000
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

## Demo Credentials (after seed)

| Username  | Password      | Role    |
|-----------|---------------|---------|
| adminC    | Admin@1234    | ADMIN   |
| facultyB  | Faculty@1234  | FACULTY |
| studentA  | Student@1234  | STUDENT |

## Docker (all-in-one)

```bash
docker compose up --build
# Frontend: http://localhost
# Backend:  http://localhost:5000
```

Seed inside Docker:
```bash
docker compose exec backend node scripts/seed.js
```

## API Endpoints

| Method | URL                                    | Role           |
|--------|----------------------------------------|----------------|
| POST   | /api/v1/auth/login                     | Public         |
| GET    | /api/v1/gpu-resources/available        | Authenticated  |
| GET    | /api/v1/gpu-resources                  | ADMIN          |
| POST   | /api/v1/gpu-resources                  | ADMIN          |
| PATCH  | /api/v1/gpu-resources/:id              | ADMIN          |
| DELETE | /api/v1/gpu-resources/:id              | ADMIN          |
| POST   | /api/v1/gpu-requests                   | STUDENT        |
| GET    | /api/v1/gpu-requests/my-requests       | Authenticated  |
| GET    | /api/v1/gpu-requests/pending           | FACULTY        |
| GET    | /api/v1/gpu-requests/all               | ADMIN          |
| PATCH  | /api/v1/gpu-requests/:id/approve       | FACULTY        |
| PATCH  | /api/v1/gpu-requests/:id/reject        | FACULTY        |
| PATCH  | /api/v1/gpu-requests/:id/complete      | FACULTY/ADMIN  |
| GET    | /api/v1/admin/summary                  | ADMIN          |
| GET    | /api/v1/admin/audit-logs               | ADMIN          |
| GET    | /api/v1/analytics/usage                | ADMIN          |

## Environment Variables (backend/.env)

```
MONGODB_URI=mongodb://localhost:27017/pbl-gpu-manager
JWT_SECRET=your_very_long_secret_here
JWT_EXPIRES_IN=1d
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```
