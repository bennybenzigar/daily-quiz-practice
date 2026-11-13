# Daily Quiz Practice — Cloud + Mobile PWA

A full-stack upgrade of the supplied Angular quiz application. It keeps the existing dashboard, JSON import, quiz practice, exam mode, answer review, backup/restore and progress screens, and moves question banks and practice history to MongoDB.

## Architecture

- **Frontend:** Angular 22 standalone application, installable Progressive Web App (PWA)
- **Backend:** Node.js 22 + Express + TypeScript
- **Database:** MongoDB Atlas (cloud) or MongoDB 7 (local Docker)
- **ODM:** Mongoose
- **No NgRx / Redux**
- **No AI provider or API key required**

## Project structure

```text
daily-quiz-practice/
├── backend/
│   ├── src/
│   │   ├── models/          # MongoDB schemas
│   │   ├── routes/          # REST API
│   │   └── server.ts
│   ├── scripts/seed.ts
│   ├── Dockerfile
│   └── .env.example
├── public/manifest.webmanifest
├── src/
│   ├── app/
│   ├── environments/
│   └── main.ts
├── sample-data/vasco-da-gama.json
├── docker-compose.yml
└── render.yaml
```

## 1. Requirements

- Node.js 22 LTS recommended (Node 20.19+ may work with the installed Angular toolchain)
- npm
- MongoDB Atlas account, or Docker Desktop for local MongoDB

## 2. Configure MongoDB Atlas

1. Create a MongoDB Atlas project and cluster.
2. Create a database user with a strong password.
3. In **Network Access**, allow the backend host to connect. For local development, add your current public IP. Avoid `0.0.0.0/0` unless you understand the exposure.
4. Copy the Atlas connection string. Replace username, password and database name. URL-encode special characters in the password.

Example:

```text
mongodb+srv://quiz_user:YOUR_URL_ENCODED_PASSWORD@cluster0.xxxxx.mongodb.net/daily_quiz?retryWrites=true&w=majority
```

Do not put this URI in Angular code or commit it to Git.

## 3. Run backend locally

Open CMD/PowerShell:

```cmd
cd backend
copy .env.example .env
```

Edit `backend/.env` and set `MONGODB_URI` to your Atlas connection string:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
CLIENT_ORIGINS=http://localhost:4200
```

Then:

```cmd
npm install
npm run dev
```

Backend health check:

```text
http://localhost:3000/api/health
```

Expected:

```json
{ "status": "ok", "service": "daily-quiz-api" }
```

Keep the backend terminal running.

## 4. Run Angular frontend locally

Open a second terminal at the project root:

```cmd
npm install
npm start
```

Open:

```text
http://localhost:4200
```

The development environment points to `http://localhost:3000/api`.

## 5. Import the Vasco da Gama question bank

The project includes:

```text
sample-data/vasco-da-gama.json
```

In the app:

1. Open **Import questions**.
2. Browse to the sample JSON file, or paste your own JSON.
3. Click **Import questions**.
4. Go back to the dashboard and choose History → Vasco da Gama.

JSON format:

```json
{
  "topic": "History",
  "subtopic": "Vasco da Gama",
  "questions": [
    {
      "question": "In which year did Vasco da Gama reach Calicut?",
      "options": ["1492", "1497", "1498", "1502"],
      "answer": "1498",
      "explanation": "He reached Calicut in 1498.",
      "difficulty": "easy"
    }
  ]
}
```

`answer` can match the exact option text or an option ID. If options are strings, IDs A, B, C and D are generated automatically. Imports append questions to an existing topic/subtopic bank. Duplicate question IDs are regenerated.

## 6. Local database with Docker (alternative to Atlas)

If Docker Desktop is installed, from the project root:

```cmd
docker compose up --build -d
```

This starts MongoDB on port 27017 and the API on port 3000. The named Docker volume `quiz_mongo_data` persists data when containers restart or are recreated.

For local Docker, set the backend's `MONGODB_URI` to:

```text
mongodb://localhost:27017/daily_quiz
```

Do not use `localhost` as the MongoDB hostname from inside the API container; the compose file uses `mongodb` for that network.

## 7. Deploy backend to Render

1. Push this project to a private GitHub repository.
2. In Render, create a **New Web Service** from the repository.
3. Set **Root Directory** to `backend`.
4. Choose Docker runtime (Render detects `backend/Dockerfile`).
5. Add environment variables:
   - `NODE_ENV=production`
   - `MONGODB_URI=<your Atlas connection string>`
   - `CLIENT_ORIGINS=https://YOUR-FRONTEND.pages.dev`
6. Deploy and wait for `/api/health` to return `status: ok`.
7. Copy the deployed API base URL, e.g. `https://daily-quiz-api.onrender.com`.

Render free services may spin down after inactivity, so the first API request can be slow. This does not mean MongoDB data is deleted. Confirm the current Render plan's limits before production use.

## 8. Deploy frontend to Cloudflare Pages

Before the production build, edit:

`src/environments/environment.prod.ts`

Set:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://YOUR-BACKEND.onrender.com/api'
};
```

Then:

1. Push changes to GitHub.
2. Create a Cloudflare Pages project connected to the repository.
3. Set **Build command** to `npm run build`.
4. Set **Build output directory** to `dist/daily-quiz-practice/browser`.
5. Deploy.
6. Add the final Pages domain to Render's `CLIENT_ORIGINS` environment variable and redeploy the API.

For local testing of a production build:

```cmd
npm run build
```

Serve `dist/daily-quiz-practice/browser` using an HTTP static server. Service worker registration is disabled in `ng serve` development mode and enabled in production builds.

## 9. Install on Android

1. Open the deployed HTTPS Cloudflare Pages URL in Chrome on Android.
2. Open Chrome menu (⋮).
3. Choose **Install app** or **Add to Home screen**.
4. Confirm installation.

The app opens like a standalone mobile app. It connects to the same backend and MongoDB database as desktop. Installing the PWA does not create another database. Clearing app cache or uninstalling the PWA does not delete Atlas records.

The PWA caches the app shell. Do not assume question imports, quiz submissions or all screens work offline; those operations require the API connection. The service worker's API cache is a best-effort freshness cache, not an offline write queue.

## 10. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/quiz-sets` | List question banks |
| POST | `/api/quiz-sets/import` | Validate and append imported questions |
| DELETE | `/api/quiz-sets/:id` | Delete a question bank |
| GET | `/api/sessions` | List practice history |
| POST | `/api/sessions` | Save a completed attempt |
| GET | `/api/backup` | Export all data |
| POST | `/api/backup/restore` | Restore/merge backup data |

## 11. Data persistence and backups

MongoDB Atlas stores the records independently of the mobile browser. A Render restart or PWA reinstall does not delete Atlas data. Use Atlas backup options available on your chosen tier and periodically use the app's **Export backup** feature. Test restore procedures before relying on backups.

MongoDB Atlas free-tier availability, storage, backup options and limits can change; check the current Atlas pricing and limits before choosing a production tier.

## 12. Important security note before public launch

This starter is intended for a **single-owner/private deployment**. The API currently has CORS restrictions, Helmet headers, request size limits, rate limiting and input validation, but it does **not** include user authentication or per-user authorization. CORS is not authentication. Do not publish the write-enabled API as a public multi-user service or store sensitive/private question banks until authentication and authorization are added. Keep the GitHub repository private and restrict who can access the frontend/API while using it privately.

Never commit `.env`, MongoDB credentials, or database connection strings. Do not put database credentials in Angular environment files.

## 13. Troubleshooting

- **API cannot connect to MongoDB:** verify `MONGODB_URI`, Atlas database user, password URL encoding and Atlas Network Access.
- **CORS error:** add the exact deployed frontend origin to `CLIENT_ORIGINS` (no trailing slash), then redeploy backend.
- **Frontend shows no banks:** verify `environment.prod.ts` points to the deployed API and open `/api/health`.
- **Render first request is slow:** free web services can spin down while idle.
- **Port already in use:** change `PORT` for the API or stop the process using port 3000.
- **Angular TypeScript deprecation:** `ignoreDeprecations: "6.0"` is already set in the supplied `tsconfig.json`.

## Verification status

The source has been assembled from the uploaded Angular project and extended with the API, MongoDB models, PWA and deployment configuration. A live MongoDB Atlas connection, Render deployment, Cloudflare deployment and Android installation require your own accounts/credentials and have not been performed from this archive.
