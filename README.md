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

## Structure

- `frontend/` — React + Vite student quest interface
- `backend/` — Express JSON API, MongoDB persistence, and local Python compiler

The frontend includes grade selection, student accounts with passwords, the game map and coding mission screens, leaderboard, and teacher dashboard. Students need their grade, name, and password to sign in or resume. The Student Data button beside Quest Pulse opens a grade filter and student profile dialog where teachers can view passwords, edit names, and reset passwords. Passwords are verified using salted hashes and encrypted at rest; the encryption key stays in the ignored `backend/.env` file. Teacher-only profile endpoints require the teacher PIN.

The backend stores each grade in its own `grade_6` through `grade_12` MongoDB collection, with matching `attempts_grade_6` through `attempts_grade_12` collections. It executes Python locally with a timeout and checks missions against generated test cases.

The existing workspace app remains unchanged.
