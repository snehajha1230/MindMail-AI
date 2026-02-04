# AI Email Assistant

A full-stack email assistant that lets you sign in with Google, view and manage Gmail, and chat with an AI assistant powered by Google Gemini. The assistant can answer questions about your emails and help you draft or manage messages.

---

## Brief Description

**AI Email Assistant** is a web app with:

- **Google OAuth** — Sign in with your Google account; the app requests read/send/modify access to Gmail.
- **Gmail integration** — List and read emails via the Gmail API; the backend uses your OAuth tokens to access your mailbox.
- **AI chat** — A chat interface where you can ask questions about your emails; the backend uses **Google Gemini** to generate answers based on your mailbox context.
- **JWT sessions** — After OAuth, the backend issues JWTs so the frontend can call protected Gmail and chatbot endpoints.

The frontend is a **Next.js** app (React); the backend is **FastAPI**. The frontend is intended to be deployed on **Vercel**, with the backend hosted elsewhere (e.g. Railway, Render, or your own server).

---

## Setup Instructions

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.9+ and **pip**
- A **Google Cloud** project with Gmail API and OAuth consent configured
- A **Google AI (Gemini)** API key

---

### Backend (FastAPI)

1. **Clone the repo and go to the backend:**

   ```bash
   cd "ai email assistant/backend"
   ```

2. **Create a virtual environment and install dependencies:**

   ```bash
   python -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables** (see [Required environment variables](#required-environment-variables) and [Google credentials & OAuth](#how-to-configure-google-credentials-and-oauth)):

   Create a `.env` file in the `backend` directory with at least:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GEMINI_API_KEY`
   - `JWT_SECRET`
   - `FRONTEND_URL`

4. **Run the API:**

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be at `http://localhost:8000`. Docs: `http://localhost:8000/docs`.

---

### Frontend (Next.js)

1. **Go to the frontend directory:**

   ```bash
   cd "ai email assistant/frontend"
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set environment variables:**

   Create a `.env.local` (or `.env`) in the `frontend` directory:

   ```bash
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

   For production, set `NEXT_PUBLIC_BACKEND_URL` to your deployed backend URL (e.g. `https://your-backend.up.railway.app`).

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

   The app will be at `http://localhost:3000`.

5. **Production build:**

   ```bash
   npm run build
   npm start
   ```

---

## How to Configure Google Credentials and OAuth

1. **Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create or select a project.

2. **Enable APIs**
   - Enable **Gmail API**: APIs & Services → Library → search “Gmail API” → Enable.
   - Enable **Generative Language API** (for Gemini): Library → search “Generative Language API” → Enable.

3. **OAuth consent screen**
   - APIs & Services → **OAuth consent screen**.
   - Choose **External** (or Internal for workspace-only).
   - Fill in app name, support email, developer contact.
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add test users if the app is in “Testing”.

4. **OAuth 2.0 Client ID (Web application)**
   - APIs & Services → **Credentials** → Create credentials → **OAuth client ID**.
   - Application type: **Web application**.
   - Name it (e.g. “AI Email Assistant”).
   - **Authorized redirect URIs**:
     - Local: `http://localhost:8000/auth/callback`
     - Production: `https://your-backend-domain.com/auth/callback` (your real backend URL + `/auth/callback`).
   - Copy **Client ID** and **Client secret** into your backend `.env`.

5. **Gemini API key**
   - In the same project (or another), go to [Google AI Studio](https://aistudio.google.com/apikey) or use APIs & Services → Credentials.
   - Create an **API key** and restrict it to “Generative Language API” if desired.
   - Put this key in backend `.env` as `GEMINI_API_KEY`.

6. **Backend `.env`**
   - `GOOGLE_REDIRECT_URI` must match exactly one of the redirect URIs you added (e.g. `http://localhost:8000/auth/callback` for local).
   - `FRONTEND_URL` is the URL of your Next.js app (e.g. `http://localhost:3000` or `https://your-app-name.vercel.app`).

---

## Required Environment Variables

### Backend (`.env` in `backend/`)

| Variable               | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 Client ID from Google Cloud Console.                             |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client secret.                                                    |
| `GOOGLE_REDIRECT_URI`  | Redirect URI for OAuth (e.g. `http://localhost:8000/auth/callback`).       |
| `GEMINI_API_KEY`       | Google AI (Gemini) API key.                                                 |
| `JWT_SECRET`           | Secret used to sign JWT tokens (use a long random string).                 |
| `FRONTEND_URL`         | Full URL of the Next.js app (e.g. `http://localhost:3000` or Vercel URL).  |

### Frontend (`.env.local` or Vercel env vars)

| Variable                    | Description                                      |
|----------------------------|--------------------------------------------------|
| `NEXT_PUBLIC_BACKEND_URL`  | Full URL of the FastAPI backend (no trailing `/`). |

---

## Live Vercel URL

**Live app:** https://mind-mail-ai.vercel.app  


Ensure `NEXT_PUBLIC_BACKEND_URL` and `FRONTEND_URL` (in backend) are set to your production backend and this Vercel URL respectively, and that your Google OAuth client has the production callback in **Authorized redirect URIs**.

---

## Technologies Used

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, react-icons.
- **Backend:** FastAPI, Uvicorn, Python 3.9+.
- **Auth:** Google OAuth 2.0 (`google-auth-oauthlib`), JWT (e.g. `python-jose`), Gmail API via `google-api-python-client` and `google-auth`.
- **AI:** Google Gemini (Generative Language API) via REST; model fallback (e.g. `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-pro`) is implemented in the backend.
- **Config:** `python-dotenv` for backend env; Next.js built-in env for frontend.

---

## Assumptions and Known Limitations

- **OAuth redirect:** The OAuth callback is handled by the **backend** (`/auth/callback`). The redirect URI in Google Cloud must be the backend URL, not the frontend.
- **CORS:** Backend allows all origins (`allow_origins=["*"]`); for production you may want to restrict this to your frontend domain.
- **Token storage:** The frontend stores the JWT (e.g. in URL or memory) after login; ensure you don’t expose tokens in logs or public URLs in production.
- **Gemini:** The app assumes a Gemini API key and that billing/API is enabled for the Generative Language API where required.
- **Gmail scope:** The app requests read, send, and modify; users must approve these scopes when signing in.
- **Local HTTP:** For local development with `http://localhost` redirect URIs, the backend may set `OAUTHLIB_INSECURE_TRANSPORT=1`; do not use this in production.
- **Single backend instance:** Session/state is not shared across multiple backend instances unless you add a shared store (e.g. Redis) for tokens or sessions.

Replace the placeholder Vercel URL and any “your-backend-domain” examples with your real URLs when you deploy.
