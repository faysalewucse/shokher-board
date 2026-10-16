# ShokherBoard — Portal

Web app for ShokherBoard: boards with drag-and-drop cards, message-to-card, clients & projects, plus users, roles & permissions, audit logs, notifications and settings.

Stack: React 19, Vite 7, React Router, Ant Design 6, Tailwind CSS 4, axios.

## Setup

Requires the API server running on `http://localhost:8000` (see `../server`).

```bash
cp .env.example .env
npm install
npm run dev
```

The dev server proxies `/api/v1` to `http://localhost:8000`.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build to `dist/`
- `npm run preview`: preview the production build
- `npm run lint`: run ESLint

The version shown in the sidebar comes from `package.json` (`__APP_VERSION__`).
