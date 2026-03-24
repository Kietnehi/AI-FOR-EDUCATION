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

## Run & Validate
### Frontend
- Install: `cd frontend && npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

### Backend
- Install: `cd backend && pip install -r requirements.txt`
- Dev: `uvicorn app.main:app --reload --port 8000`
- Optional seed: `py -m scripts.seed`

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
- Make smallest possible changes.
- Do not refactor unrelated code.
- Preserve public API shapes unless task explicitly requires breaking changes.
- Add tests when feasible; if no tests exist for the area, at least run lint/build relevant to changed surface.

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
