# Axiom — Groq-powered AI chat

A responsive ChatGPT-inspired chat workspace built with React, Vite, Framer Motion, GSAP, Express, Markdown rendering, and Groq's OpenAI-compatible Chat Completions API.

## Included

- Responsive chat workspace with collapsible sidebar, conversation history, model picker, starter prompts, composer, export, settings, and search.
- GSAP entrance animation and Framer Motion transitions.
- Groq streaming responses (server-to-browser SSE), model selection, stop generation, Markdown/GFM/code blocks, and response copying.
- Browser-local conversation history (localStorage) and Markdown export.
- Text/Markdown/CSV/JSON/HTML/LOG attachment support (up to 180 KB).
- Server-side API key handling, model allow-list, request size limits, rate limiting, and health endpoint.
- Light/dark appearance and mobile navigation.

## Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- npm
- A Groq API key from https://console.groq.com/keys

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set your key:

   ```env
   GROQ_API_KEY=gsk_your_real_key_here
   PORT=8787
   DEFAULT_MODEL=openai/gpt-oss-120b
   ```

3. Start the development servers:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173.

Vite serves the interface and proxies `/api` requests to Express on port 8787.

## Deploy to Vercel

This repository has a root Express entry point and `vercel.json`. Import the GitHub repository in Vercel, use `npm run build` as the build command, and add `GROQ_API_KEY` as an encrypted environment variable for Production. Add it to Preview too only if you want chat enabled in preview deployments. `DEFAULT_MODEL` is optional.

Redeploy after changing environment variables. Keep the Groq key server-side only. Do not add it to client variables such as `VITE_GROQ_API_KEY`.

## API endpoints

- `GET /api/health` — configured/not-configured status without exposing the key.
- `GET /api/models` — enabled model list.
- `POST /api/chat` — streams response deltas as Server-Sent Events.

The model allow-list lives in `server/index.js`; keep it synchronized with the model list in `src/App.jsx`.

## Security and limitations

- Never paste the Groq key into `src/`, `index.html`, or a public repository. Store it in a local ignored `.env` or the hosting provider's encrypted environment settings.
- The included rate limiter is a starting point, not a full public multi-user security system. Before public launch, add authentication, persistent rate limiting, usage monitoring, and production abuse controls.
- Conversation history is stored in browser localStorage. Clearing browser storage removes it. No account login or shared database is included.
- Attachments are read as text and sent as prompt context. This version does not parse PDFs or images.
- AI output can be inaccurate. Verify important information before relying on it.

## Customization

- Styling: `src/styles.css`
- Interface and interactions: `src/App.jsx`
- Model list, streaming, rate limits: `server/index.js`
