# Developer Guide

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **PostgreSQL** 16+ with pgvector extension
- **Redis** 7+ (optional — app falls back to in-memory cache)
- **Git**

## Local Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd COREVIA
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your local PostgreSQL connection string
```

Required environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/heliumdb` |
| `SESSION_SECRET` | Session encryption key (≥32 chars in prod) | Auto-generated in dev |
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `ENABLE_REDIS` | Enable Redis cache/session store | `false` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

### 3. Database Setup

```bash
# Push schema to database (creates all 153 tables)
npm run db:push

# Or run migrations
npm run db:migrate

# Create a super admin user
node --import tsx infrastructure/scripts/create-super-admin.ts
```

### 4. Start Development Server

```bash
npm run dev
```

This starts:
- Express API server on port 5000
- Vite HMR dev server (proxied through Express)
- WebSocket server for real-time updates

### 5. Access the Application

- **App:** http://localhost:5000
- **Swagger:** http://localhost:5000/api/docs
- **Superadmin login:** run `node --import tsx infrastructure/scripts/create-super-admin.ts` to reset and print the current `superadmin` / `admin@corevia.local` credential
- **Authenticated Playwright:** export `E2E_USERNAME` and `E2E_PASSWORD` before running specs that require privileged access
- **Enterprise smoke suite:** run `npm run test:e2e:enterprise` to reset `superadmin` automatically and execute the focused authenticated enterprise Playwright flows
- **Full enterprise release gate:** run `npm run quality:release:enterprise` to execute the release-quality checks plus the authenticated enterprise smoke suite

---

## Project Structure

```
COREVIA/
├── apps/
│   ├── web/                   # React frontend (Vite)
│   │   ├── app/               # App shell, contexts, route pages
│   │   ├── components/        # Shared UI components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── modules/           # Domain-owned UI modules
│   │   ├── services/          # Frontend API/integration clients
│   │   └── shared/            # Shared frontend utilities
│   └── api/                   # API app entry point (index.ts, bootstrap)
├── brain/                     # Decision Spine and governed reasoning surface
│   ├── agents/                # AI agent definitions
│   ├── intelligence/          # Engine A/B/C inference orchestration
│   ├── layers/                # 8-layer decision pipeline
│   ├── orchestration/         # Multi-agent orchestration
│   ├── pipeline/              # Pipeline stage execution
│   ├── reasoning/             # Reasoning strategies
│   ├── spine/                 # Decision spine core
│   └── storage/               # Brain-owned persistence
├── domains/                   # Bounded-context modules
│   ├── compliance/            # Compliance domain
│   ├── demand/                # Demand / requirements domain
│   ├── ea/                    # Enterprise architecture domain
│   ├── governance/            # Governance domain
│   ├── identity/              # Identity & access domain
│   ├── intelligence/          # Intelligence domain
│   ├── knowledge/             # Knowledge base domain
│   ├── notifications/         # Notifications domain
│   ├── operations/            # Operations domain
│   ├── platform/              # Platform domain
│   ├── portfolio/             # Portfolio domain
│   └── workspace/             # Workspace domain
├── platform/                  # Technical kernel (observability, flags, cache)
├── interfaces/                # Transport & composition layer
│   ├── config/                # Swagger, security config
│   ├── middleware/            # Express middleware (auth, CSRF, rate limit)
│   ├── storage/               # Ports & Adapters storage layer
│   │   ├── ports/             # Port interfaces (one per domain)
│   │   └── repositories/      # Drizzle ORM implementations
│   └── routes/                # Route composition root
├── packages/                  # Shared types, schemas, contracts
│   ├── contracts/             # Zod schemas shared client↔server
│   ├── primitives/            # Base types, events, crypto
│   └── schema.ts             # Drizzle table definitions (153 tables)
├── infrastructure/            # Deployment, scripts, migrations, runtime assets
│   ├── charts/                # Helm charts for Kubernetes
│   ├── docker/                # Container-oriented deployment assets
│   ├── gateway/               # Reverse-proxy configuration
│   ├── infra/                 # Terraform/Azure IaC
│   ├── migrations/            # Drizzle migration output root
│   └── scripts/               # Utility and operational scripts
└── docs/                      # Documentation, ADRs
```

---

## Development Workflow

### Creating a New Domain Module

1. Create the domain directory:
   ```
   domains/<name>/
   ├── api/
   │   ├── <name>.routes.ts
   │   └── index.ts
   ├── application/
   │   └── <name>.service.ts
   └── domain/
       └── <name>.types.ts
   ```

2. Define the storage port in `interfaces/storage/ports/<name>.port.ts`
3. Implement the repository in `interfaces/storage/repositories/<name>.repository.ts`
4. Wire the port methods in `interfaces/storage/PostgresStorage.ts`
5. Add the import to `interfaces/storage.ts`
6. Register routes in `interfaces/routes/registerDomainRoutes.ts`
7. Add tables to `packages/schema.ts`

### Adding an API Endpoint

1. Define the Zod schema in `packages/contracts/<module>.ts`
2. Create the route handler in `domains/<module>/api/<name>.routes.ts`
3. Use `validateBody(schema)` middleware for request validation
4. Use `requireAuth` and `requirePermission("resource.action")` for authorization
5. Add JSDoc `@swagger` annotations for Swagger documentation

### Adding a Database Table

1. Define the table in `packages/schema.ts` using Drizzle's `pgTable()`
2. Run `npm run db:generate` to create a migration file
3. Run `npm run db:migrate` to apply the migration
4. Or use `npm run db:push` for development (auto-sync schema)

---

## Key Conventions

### TypeScript

- Strict mode enabled (`strict: true`)
- No `any` — use `unknown` and narrow with type guards
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use branded types for IDs (`DemandId`, `ProjectId`)

### API Routes

- RESTful resource naming (`/api/demands`, `/api/projects/:id`)
- `requireAuth` middleware on all non-public routes
- `requirePermission()` for RBAC enforcement
- Zod validation via `validateBody()` middleware
- Consistent error format: `{ success: false, error: string }`

### State Management (Frontend)

- Use `useQuery()` for all server data
- Use `useMutation()` + `queryClient.invalidateQueries()` for mutations
- Query keys follow `[resource, ...params]` pattern
- No global state stores — React Context only for auth

### Storage

- All database access through port interfaces
- Never import Drizzle `db` directly in module code
- Repository methods return plain objects, not Drizzle Row types

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Build for production |
| `npm test` | Run server tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:client` | Run client-side tests |
| `npm run test:all` | Run all test suites |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migration |
| `npm run db:migrate` | Run migrations |
| `npm run check` | TypeScript type check |

---

## Architecture Boundary Checks

Architecture invariants are enforced at CI time:

```bash
# Check that modules don't cross domain boundaries
npx tsx infrastructure/scripts/check-architecture-boundary.ts

# Check that AI module respects platform boundaries
npx tsx infrastructure/scripts/check-corevia-ai-boundary.ts
npx tsx infrastructure/scripts/check-platform-ai-boundary.ts
```

These scripts fail the build if:
- A domain module imports from another domain module's internals
- Storage access bypasses the port interface
- Circular dependencies are detected

---

## Troubleshooting

### Database connection errors

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify connection string
psql "$DATABASE_URL" -c "SELECT 1"

# Reset database
npm run db:push
```

### Redis not available

The app works without Redis — it falls back to in-memory cache and PostgreSQL session store. Set `ENABLE_REDIS=false` (default) to disable Redis features.

### Port already in use

```bash
# Find and kill the process on port 5000
lsof -ti:5000 | xargs kill -9
```
