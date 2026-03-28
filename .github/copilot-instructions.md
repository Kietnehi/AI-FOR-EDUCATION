# Copilot Instructions for AI Learning Studio

## Purpose
This repository is an AI-powered education platform with:
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS v4
- Backend: FastAPI (async), MongoDB (Motor), ChromaDB, LLM integrations

Use these instructions to make safe, minimal, and architecture-aligned changes.

## Canonical References (Link, Don't Duplicate)
- Product + setup overview: `README.md`
- Backend entry/lifecycle: `backend/app/main.py`
- Backend config/env model: `backend/app/core/config.py`
- API route composition: `backend/app/api/router.py`
- DB connection/indexes: `backend/app/db/mongo.py`
- Frontend API client: `frontend/lib/api.ts`
- Frontend app shell/layout: `frontend/components/app-shell.tsx`

If details conflict, prefer the source files above over this document.

## Run & Validate (Quick Commands)
### Frontend
- Install dependencies: `cd frontend && npm install`
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Lint: `cd frontend && npm run lint`

### Backend
- Install dependencies: `cd backend && pip install -r requirements.txt`
- Dev server: `cd backend && uvicorn app.main:app --reload --port 8000`
- Optional seed data: `cd backend && python -m scripts.seed`

### Testing & Checks
- Frontend unit/CI tests: `cd frontend && npm test` (if configured)
- Backend tests: `cd backend && pytest` (if tests added)
- Format/Lint: run the repo-specific linters described in respective `frontend`/`backend` folders before opening PRs.

## Architecture Boundaries
### Backend layering (keep strict flow)
- `app/api/routes/*`: HTTP contracts only
- `app/services/*`: business orchestration
- `app/repositories/*`: persistence/data access
- `app/ai/*`: ingestion, retrieval, generation, chatbot orchestration
- `app/schemas/*`: Pydantic request/response models
- `app/models/*`: document contracts

Prefer route -> service -> repository. Avoid placing DB queries directly in route handlers.

### Frontend layering
- `frontend/app/*`: route-level pages
- `frontend/components/*`: reusable UI/layout
- `frontend/lib/*`: API helpers and shared runtime utilities
- `frontend/types/*`: shared TS types

Prefer using existing UI primitives in `frontend/components/ui/*` and types from `frontend/types/index.ts`.

## Project Conventions
### Backend
- Async-first: use `async/await` throughout services/repos.
- Use DI for DB in routes: `Depends(get_database)`.
- Keep serialization consistent (`ObjectId` -> string ids) via repository utilities.
- Reuse existing AI abstractions instead of adding provider-specific logic in routes/services.

### Frontend
- Use `"use client"` only where interactivity is required.
- Use `apiFetch<T>()` from `frontend/lib/api.ts` for API calls.
- Keep visual/state logic in components; keep API mapping typed.
- Preserve existing Tailwind + CSS variable design system in `frontend/app/globals.css`.

## Environment & Integration Gotchas
- Frontend API env must use `NEXT_PUBLIC_` prefix (`NEXT_PUBLIC_API_BASE_URL`).
- Backend CORS must include frontend origin (default local: `http://localhost:3000`).
- Required writable storage dirs: `backend/storage/uploads`, `backend/storage/generated`, `backend/storage/chroma`.
- LLM path may fallback (Gemini/OpenAI/OpenRouter); do not remove fallback behavior unless requested.
- MongoDB URI credentials may require URL encoding for special characters.

## Change Policy
- Make the smallest possible change that solves the problem.
- Avoid broad refactors in the same PR; split large work into follow-ups.
- Preserve public API shapes unless the change is explicitly scoped to an API update.
- Add tests when feasible. If no tests exist, at minimum run relevant lint/build commands and document manual verification steps in the PR.

## File-Level Starting Points
- Materials flow: `backend/app/api/routes/materials.py`, `backend/app/services/material_service.py`
- Generation flow: `backend/app/services/generation_service.py`, `backend/app/ai/generation/*`
- Chat/RAG flow: `backend/app/api/routes/chat.py`, `backend/app/services/chat_service.py`, `backend/app/ai/chatbot/orchestrator.py`
- Frontend materials pages: `frontend/app/materials/*`
- Frontend shared layout/nav: `frontend/components/layout/*`, `frontend/components/app-shell.tsx`

## When Unsure
1. Check existing pattern in neighboring files first.
2. Follow current naming and typing conventions.
3. Prefer adding a focused helper over broad rewrites.
4. Document assumptions in PR/summary if behavior is ambiguous.

## Contributing / PR Guidance
- Create a feature branch from `main` and open a PR with a clear description and testing steps.
- For backend changes, include a short note about DB migrations or required env updates.
- If the change touches AI/LLM behavior, include prompt examples and a short safety/ethics note.

## Example Agent Prompts
- "Create a short lesson plan for [topic] suitable for [age/level]."
- "Investigate and propose a minimal fix for a 500 in POST /materials; point to affected files and a small patch."
- "Add an endpoint to create generated content using generation_service and return its id."

## Where to Look Next
- Product overview and setup: [README.md](README.md)
- Backend entry/lifecycle: [backend/app/main.py](backend/app/main.py)
- Frontend API helper: [frontend/lib/api.ts](frontend/lib/api.ts)

If you'd like, I can also add a short `AGENTS.md` with example applyTo snippets and starter prompts.

## Example Prompts
- **Quick Start:** Ask the agent to "Create a short lesson plan for [topic] suitable for [age/level]."
- **Backend Debug:** "Investigate and propose a fix for a 500 error in POST /materials; point to affected files and a minimal patch."
- **Feature Implementation:** "Add an endpoint to create generated content using `generation_service`, return created id, and include minimal tests."
- **Frontend Task:** "Implement the upload UI for materials using `apiFetch` and frontend component primitives."

## Suggested Agent Customizations
- **create-agent:** Scaffold an agent for workspace tasks (seed DB, run tests, lint). Use `applyTo` to scope to `backend/**` or `frontend/**`.
- **create-instruction:** Templates for PR descriptions, migration steps, and contributor guidelines.
- **create-skill:** Encapsulate provider-specific LLM calls under `backend/app/ai/*` for reuse.

## ApplyTo Recommendations
- **Backend-only:** `applyTo: backend/**` — tasks that modify FastAPI services, repositories, or DB.
- **Frontend-only:** `applyTo: frontend/**` — UI, components, and Next.js routing changes.
- **Full-repo:** `applyTo: **/*` — cross-cutting changes affecting both frontend and backend (use sparingly).

## Where to Look Next
- Product overview and setup: [README.md](README.md)
- Backend entry/lifecycle: [backend/app/main.py](backend/app/main.py)
- Frontend API helper: [frontend/lib/api.ts](frontend/lib/api.ts)
