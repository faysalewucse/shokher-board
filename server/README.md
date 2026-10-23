# ShokherBoard — Server

Express 5 + Prisma (PostgreSQL) API boilerplate: JWT auth with email verification and password reset, role/permission-based access control, user management with avatar uploads, app config, in-app notifications (REST + Socket.IO), audit logging, and admin storage tools.

## Setup

Requires Node.js 18+ and PostgreSQL.

```bash
cp .env.example .env        # then set DATABASE_URL, JWT_SECRET, MAIL_*, ADMIN_*
npm install
npx prisma migrate dev      # apply migrations (or: npm run db:migrate, which runs `prisma db push`)
npm run seed:all            # roles (admin, user) + admin user from ADMIN_* env
npm run dev                 # http://localhost:8000
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` via `POST /api/v1/auth/login`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Start in production mode |
| `npm run db:migrate` | Bundle `prisma/schema/*.prisma` and `prisma db push` (quick dev sync, no migration files) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run seed:roles` / `seed:users` / `seed:all` | Seed roles and the admin user (idempotent — re-run to push new permissions to existing roles) |
| `npm run test:parser` | Self-test for the board message parser (`scripts/testMessageParser.js`) |
| `npm run test:trello` | Self-test for the Trello import mapping + portal normalizer (`scripts/testTrelloImport.js`, fixture `scripts/fixtures/trello-sample.json`) |

For tracked schema changes, edit `prisma/schema/*.prisma` and run `npx prisma migrate dev --name <change>`. Deploy with `npx prisma migrate deploy`.

## API (`/api/v1`)

| Path | Description | Docs |
|------|-------------|------|
| `/health` | Health check | [docs/health.md](docs/health.md) |
| `/auth` | Register, verify email, login, logout, forgot/reset password | [docs/auth.md](docs/auth.md) |
| `/users` | Own profile, avatar, password; admin user management | [docs/users.md](docs/users.md) |
| `/roles` | Role CRUD | [docs/roles.md](docs/roles.md) |
| `/permissions` | Grouped permission list | [docs/permissions.md](docs/permissions.md) |
| `/config` | App config (public + admin) | [docs/config.md](docs/config.md) |
| `/notifications` | List, unread count, mark read, delete, broadcast, cleanup | — |
| `/audit-logs` | Audit log list and per-entity history | — |
| `/admin` | `POST /cleanup-files`, `GET /storage-stats` | — |
| `/clients`, `/projects` | Clients and projects (archive on delete) | [docs/boards-contract.md](docs/boards-contract.md) |
| `/boards`, `/lists`, `/cards`, `/labels`, `/checklists`, `/checklist-items`, `/comments`, `/attachments` | Trello-like boards: members, labels, lists, cards, checklists, comments, attachments, activity, message-to-card | [docs/boards-contract.md](docs/boards-contract.md), [docs/boards.md](docs/boards.md) |
| `/boards/import/trello` | Import a Trello board export (parsed and normalized in the portal) into a new board | [docs/trello-import.md](docs/trello-import.md) |
| `/integrations/slack` | Per-user Slack connections (OAuth): connect, list, test, disconnect; admin overview | [docs/slack.md](docs/slack.md) |

Socket.IO connects on the same port; authenticate with `auth: { token }`. Each user joins the room `user:<id>` and receives `notification:new`, `notification:read` and `notification:unread-count` events. For boards, emit `board:join { boardId }` (ack `{ ok, error? }`) / `board:leave { boardId }` and listen for `board:event { boardId, type, payload, actorId }`.

## Project layout

```
prisma/schema/      Prisma models (multi-file schema)
prisma/migrations/  SQL migrations
src/config/         env config, DB connect, multer
src/constants/      permissions (JWT bitmask), enums
src/routes/         route definitions → controllers → services
src/middleware/     auth, validation, uploads, rate limiting, audit, errors
src/utils/          logger, mailer, email templates, scheduler, file cleanup
src/seeds/          role + admin user seeds
```
