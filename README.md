# Python Quest (separate React + Node app)

This standalone version keeps the original Python Quest React interface and Node/Express backend in separate folders. It does not use the parent pnpm workspace or PostgreSQL. Students, mission progress, and attempts are stored in MongoDB using the connection string in `backend/.env`.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB running at `mongodb://localhost:27017`
- Python 3.10 or newer available as `python` on Windows or `python3` on macOS/Linux

## Run locally

Open two PowerShell terminals in this folder.

Terminal 1 (API):

```powershell
cd backend
npm install
npm run dev
```

Terminal 2 (React app):

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (it will use the next port if 5174 is busy). The API runs on http://localhost:5000.

The frontend reads `VITE_API_BASE_URL` from `frontend/.env`. It is set to `http://localhost:5000` for local development. To connect a deployed frontend to a remote backend, set it to the backend's full URL (for example, `https://api.example.com`) and restart/rebuild the frontend. `frontend/.env.example` documents the setting; keep deployment-specific values in the ignored `.env` file.

## Deployment settings

For Render, set the backend root directory to `backend`, use `npm install` as the build command and `npm start` as the start command. Add `MONGODB_URI` (your Atlas URI pointing to the `python-tasks` database), `PASSWORD_ENCRYPTION_KEY` (exactly 64 hexadecimal characters), and `TEACHER_PIN` in the Render environment settings. Generate a new key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; keep the same key for as long as that database contains encrypted student passwords. Render provides `PORT` automatically. If the key is absent or malformed, the backend exits on startup and prints a clear configuration error.

For Netlify, set `VITE_API_BASE_URL` to the Render service URL (for example, `https://your-service.onrender.com`) and trigger a new deploy. Opening the Render root URL should show the API status JSON; `/api/healthz` is the health check.

## Structure

- `frontend/` — React + Vite student quest interface
- `backend/` — Express JSON API, MongoDB persistence, and local Python compiler

The frontend includes grade selection, student accounts with passwords, the game map and coding mission screens, leaderboard, and teacher dashboard. Students need their grade, name, and password to sign in or resume. The Student Data button beside Quest Pulse opens a grade filter and student profile dialog where teachers can add students, view passwords, edit names, reset passwords, and delete student profiles with their progress and attempts. Passwords are verified using salted hashes and encrypted at rest; the encryption key stays in the ignored `backend/.env` file. Teacher-only student management endpoints require the teacher PIN.

The backend stores each grade in its own `grade_6` through `grade_12` MongoDB collection, with matching `attempts_grade_6` through `attempts_grade_12` collections. It executes Python locally with a timeout and checks missions against generated test cases.

The first mission, Print Studio, teaches `print()` with a worked example and five randomly selected questions from the supplied printing-question set. The checker validates the output for those exact five prompts.

The existing workspace app remains unchanged.
