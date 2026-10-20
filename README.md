# HotelOps

A modern, full-featured hotel management & operations platform built with NestJS, Next.js, Prisma, and PostgreSQL.

## Features

### Core Operations
- **Reservations** - Full lifecycle management (inquiry → confirmed → checked-in → checked-out)
- **Front Desk** - Check-in/check-out, walk-ins, arrival/departure board
- **Housekeeping** - Kanban board, task assignment, room status tracking
- **Maintenance** - Request management, assignment, resolution tracking

### Revenue & Finance
- **Rate Plans** - Flexible pricing with seasonal adjustments, promo codes
- **Payments** - Multiple methods, refunds, payment tracking
- **Folios** - Guest charges, room charges, services, taxes
- **Invoices** - Auto-generated on checkout, PDF support
- **Expenses & Vendors** - Track operational costs

### Property Management
- **Rooms & Types** - Building/floor hierarchy, availability grid
- **Amenities** - Room type amenities
- **Inventory** - Stock tracking, low-stock alerts

### Guests & CRM
- **Guest Profiles** - VIP tracking, preferences, history
- **Communications** - Notifications, audit log

### Reporting
- **Dashboard** - Occupancy, ADR, RevPAR, revenue charts
- **Reports** - Daily series, revenue by category, source breakdown, top guests, housekeeping efficiency

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 10, TypeScript, Prisma ORM |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ |
| Realtime | Socket.io |
| Auth | JWT (access + refresh tokens), bcrypt |
| Validation | class-validator, Zod |
| UI Components | Radix UI, Lucide Icons |
| Charts | Recharts |

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16
- Redis 7

### Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd HotelOps
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database/redis credentials

# 3. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 4. Start development servers
npm run dev
```

- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/api/docs
- Web: http://localhost:3000

### Docker (Production)

```bash
# Build and run all services
docker-compose up -d

# Run migrations + seed
docker-compose --profile setup run --rm migrate
```

## Demo Accounts

After seeding, use these credentials (password: `Demo123!`):

| Role | Email |
|------|-------|
| Owner | owner@hotelops.app |
| General Manager | manager@hotelops.app |
| Front Desk | frontdesk@hotelops.app |
| Housekeeping | housekeeping@hotelops.app |
| Maintenance | maintenance@hotelops.app |
| Accountant | accountant@hotelops.app |

## Project Structure

```
HotelOps/
├── apps/
│   ├── api/                 # NestJS backend
│   │   └── src/
│   │       ├── auth/        # Authentication
│   │       ├── modules/     # Feature modules
│   │       ├── common/      # Guards, decorators, utilities
│   │       └── main.ts
│   └── web/                 # Next.js frontend
│       └── app/
│           ├── (auth)/      # Login, password reset
│           └── (app)/       # Protected app pages
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.mjs             # Demo data seeder
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
└── package.json             # Monorepo root
```

## Key API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| Reservations | `GET/POST /reservations`, `GET /reservations/:id` |
| Front Desk | `GET /front-desk/board`, `POST /front-desk/check-in` |
| Housekeeping | `GET /housekeeping/board`, `POST /housekeeping/tasks` |
| Rooms | `GET /rooms`, `GET /rooms/stats`, `PATCH /rooms/:id/status` |
| Guests | `GET/POST /guests`, `POST /guests/:id/vip` |
| Reports | `GET /reports/overview`, `GET /reports/daily` |

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` - Auth secrets
- `CORS_ORIGIN` - Allowed frontend origin

## Scripts

```bash
# Development
npm run dev              # Start both API and Web
npm run dev:api          # API only
npm run dev:web          # Web only

# Building
npm run build            # Build both workspaces
npm run build:api        # API only
npm run build:web        # Web only

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:seed      # Seed demo data
npm run db:reset         # Reset database

# Quality
npm run lint             # ESLint all workspaces
npm run format           # Prettier format
npm run typecheck        # TypeScript check
npm run test             # Run tests
```

## Production Deployment

1. **Build images**
   ```bash
   docker build -f Dockerfile.api -t hotelops-api .
   docker build -f Dockerfile.web -t hotelops-web .
   ```

2. **Configure production `.env`**
   - Use strong JWT secrets (32+ chars)
   - Set `NODE_ENV=production`
   - Configure real SMTP for emails
   - Set `EMAIL_DEV_MODE=false`

3. **Run with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

## License

MIT