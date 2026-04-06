# Copilot Instructions for AI Learning Studio

## Purpose
This repository is an AI-powered education platform with:
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS v4
- Backend: FastAPI (async), MongoDB (Motor), ChromaDB, LLM integrations

Use these instructions to make safe, minimal, architecture-aligned changes.

## Canonical References (Link, Do Not Duplicate)
- Product and setup overview: [README.md](README.md)
- Backend entry and lifecycle: [backend/app/main.py](backend/app/main.py)
- Backend config and env model: [backend/app/core/config.py](backend/app/core/config.py)
- API route composition: [backend/app/api/router.py](backend/app/api/router.py)
- DB connection and indexes: [backend/app/db/mongo.py](backend/app/db/mongo.py)
- Frontend API client: [frontend/lib/api.ts](frontend/lib/api.ts)
- Frontend app shell: [frontend/components/app-shell.tsx](frontend/components/app-shell.tsx)

If details conflict, prefer source files over this document.

## Build, Run, and Validate
### Frontend
- Install: cd frontend && npm install
- Dev: cd frontend && npm run dev
- Build: cd frontend && npm run build
- Lint: cd frontend && npm run lint
- Unit tests: cd frontend && npm run test:unit
- Integration tests: cd frontend && npm run test:integration
- Coverage: cd frontend && npm run test:coverage

### Backend
- Install runtime deps: cd backend && pip install -r requirements.txt
- Install test deps: cd backend && pip install -r requirements-test.txt
- Dev (preferred): cd backend && python run.py
- Dev (alternative): cd backend && uvicorn app.main:app --reload --port 8000
- Tests: cd backend && pytest

### Docker
- Local stack: docker-compose up
- CI-like stack: docker-compose -f docker-compose.ci.yml up

## Architecture Boundaries
### Backend layering (strict flow)
- app/api/routes/*: HTTP contracts only
- app/services/*: business orchestration
- app/repositories/*: persistence and data access
- app/ai/*: ingestion, retrieval, generation, chatbot orchestration
- app/schemas/*: request and response models
- app/models/*: document contracts

Prefer route -> service -> repository. Do not place DB queries directly in routes.

### Frontend layering
- frontend/app/*: route-level pages
- frontend/components/*: reusable UI and layout
- frontend/lib/*: API helpers and shared runtime utilities
- frontend/types/*: shared TS types

Prefer existing primitives in [frontend/components/ui](frontend/components/ui) and shared types in [frontend/types/index.ts](frontend/types/index.ts).

## Project Conventions
### Backend
- Async-first: use async and await end-to-end (Motor is async-only).
- Use dependency injection in routes: Depends(get_database), and Depends(get_current_user) for protected endpoints.
- Keep Mongo serialization consistent via repository helpers:
	- Parse inbound ids with parse_object_id in [backend/app/utils/object_id.py](backend/app/utils/object_id.py)
	- Return outbound ids via serialize_document in [backend/app/repositories/base.py](backend/app/repositories/base.py)
- Reuse existing AI abstractions; avoid provider-specific logic in routes.

### Frontend
- Use use client only where interactivity is required.
- Use apiFetch<T>() from [frontend/lib/api.ts](frontend/lib/api.ts) for API calls.
- Keep UI state in components and keep API mapping typed.
- Preserve Tailwind + CSS variable design system in [frontend/app/globals.css](frontend/app/globals.css).

## Environment and Integration Gotchas
- Frontend env for browser usage must use NEXT_PUBLIC_ prefix (for example NEXT_PUBLIC_API_BASE_URL).
- Backend CORS must include frontend origin (default local: http://localhost:3000).
- Required writable storage directories are configured in [backend/app/core/config.py](backend/app/core/config.py):
	- ./storage/uploads
	- ./storage/generated
	- ./storage/chroma
	- ./storage/images
	- ./storage/notebooklm/documents
	- ./storage/notebooklm/chrome-profile
- Keep LLM fallback behavior intact unless explicitly requested:
	- Gemini is primary by default, with fallback and key rotation support via GEMINI_API_KEYS.
	- Do not remove fallback paths to OpenAI or OpenRouter.
- MongoDB URI credentials may require URL encoding for special characters.
- On Windows, preserve event loop policy handling before server startup in [backend/run.py](backend/run.py) and [backend/app/main.py](backend/app/main.py).
- Backend tests enforce a minimum coverage threshold in [backend/pytest.ini](backend/pytest.ini).

## Change Policy
- Make the smallest possible change that solves the problem.
- Avoid broad refactors in the same PR; split large work into follow-ups.
- Preserve public API shapes unless the task explicitly requires API changes.
- Add or update tests when feasible; otherwise run relevant lint/build/tests and report what was validated.

## Key Docs to Link
Use these docs for details instead of copying content into instruction files.
- [markdown_docs/CI_SUMMARY.md](markdown_docs/CI_SUMMARY.md)
- [markdown_docs/DOCKER_REVIEW.md](markdown_docs/DOCKER_REVIEW.md)
- [markdown_docs/LLM_API_FLOW.md](markdown_docs/LLM_API_FLOW.md)
- [markdown_docs/MONITORING_AND_CLOUDFLARE_R2.md](markdown_docs/MONITORING_AND_CLOUDFLARE_R2.md)
- [markdown_docs/REASONING_STREAMING.md](markdown_docs/REASONING_STREAMING.md)
- [markdown_docs/STORAGE_AND_MEDIA_FIXES.md](markdown_docs/STORAGE_AND_MEDIA_FIXES.md)
- [markdown_docs/MINIGAME.md](markdown_docs/MINIGAME.md)
- [markdown_docs/ui.md](markdown_docs/ui.md)

## File-Level Starting Points
- Materials flow: [backend/app/api/routes/materials.py](backend/app/api/routes/materials.py), [backend/app/services/material_service.py](backend/app/services/material_service.py)
- Generation flow: [backend/app/services/generation_service.py](backend/app/services/generation_service.py), [backend/app/ai/generation](backend/app/ai/generation)
- Chat and RAG flow: [backend/app/api/routes/chat.py](backend/app/api/routes/chat.py), [backend/app/services/chat_service.py](backend/app/services/chat_service.py), [backend/app/ai/chatbot/orchestrator.py](backend/app/ai/chatbot/orchestrator.py)
- Frontend materials pages: [frontend/app/materials](frontend/app/materials)
- Frontend shared layout and navigation: [frontend/components/layout](frontend/components/layout), [frontend/components/app-shell.tsx](frontend/components/app-shell.tsx)

## Example Prompts
- Create a short lesson plan for [topic] suitable for [age/level].
- Investigate and propose a minimal fix for a 500 in POST /materials; point to affected files and a small patch.
- Add an endpoint to create generated content using generation_service and return its id.
