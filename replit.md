# Project Overview

This is a full-stack React + Express application cloned from an AI Studio export. It is a medical data extraction tool that uses AI (Gemini/OpenAI) to extract structured data from medical records.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Express.js + Socket.io (real-time chat/collaboration)
- **Database**: Firebase / Firestore
- **AI**: Google Gemini API + OpenAI API
- **Build Tool**: Vite (dev), esbuild (production server bundle)

## Key Files

- `server.ts` — Express server with Socket.io, AI API routes, and Vite middleware
- `vite.config.ts` — Vite configuration
- `src/` — React frontend (App.tsx, pages/, components/, firebase.ts)
- `firebase-applet-config.json` — Firebase project config
- `firestore.rules` — Firestore security rules

## Ports

- **5000** — Main server (Express wraps Vite in dev mode)

## Environment Variables

- `GEMINI_API_KEY` — Google Gemini API key (required for AI features)
- `APP_URL` — Hosted URL (injected at runtime)
- `OPENAI_API_KEY` — OpenAI API key (optional, used for alternative AI model)

## Scripts

- `npm run dev` — Start dev server (tsx server.ts)
- `npm run build` — Build for production
- `npm start` — Run production build

## Deployment

- Target: VM (always-on, required for Socket.io)
- Build: `npm run build`
- Run: `node dist/server.cjs`
