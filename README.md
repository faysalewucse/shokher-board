# shokher-board

ShokherBoard is a team workspace for managing clients, projects and tasks on Trello-style boards. Drag cards across lists, assign teammates, set due dates, add checklists, comments and files, and see changes live. Prefer chatting? Just type a message — it becomes a card. Connect your Slack workspace to keep your team in sync.

## Repository layout

| Folder | What it is | Stack |
|---|---|---|
| [`server/`](server) | REST + Socket.IO API | Node.js, Express 5, Prisma, PostgreSQL |
| [`portal/`](portal) | Web app | React 19, Vite, Ant Design, Tailwind CSS |

## Quick start

```bash
# API (http://localhost:8000)
cd server
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, …
npm install
npx prisma migrate deploy
npm run seed:all            # roles + admin user
npm run dev

# Web app (http://localhost:5173), in another terminal
cd portal
cp .env.example .env
npm install
npm run dev
```

See [server/README.md](server/README.md) and [portal/README.md](portal/README.md) for details. The Slack setup is in [server/docs/slack.md](server/docs/slack.md).
