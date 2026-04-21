# Test Report Summary - AI FOR EDUCATION

## I. Test Execution Summary
- Project: AI-FOR-EDUCATION
- Branch: ductoan
- Report date: 2026-04-16
- Prepared by: QA/Test (generated with Copilot support)

### 1.1 Scope of testing
- UI test: Frontend component/integration tests (Vitest + Testing Library).
- API test: Frontend API tests + Backend API/service route tests (Vitest + Pytest).
- Performance test: k6 script for API baseline load test.

### 1.2 Test Environment
- Frontend: Next.js 14 + TypeScript (Vitest)
- Backend: FastAPI + Python 3.14 (Pytest)
- Database: MongoDB
- Monitoring: Prometheus + Loki + Tempo + Grafana
- Performance tool: k6 (script provided)

## II. UI + API Test Report

### 2.1 Test Coverage Summary
- Frontend unit tests: 20 passed / 20 total
- Frontend integration tests: 6 passed / 8 total (2 failed)
- Backend tests (functional run, no coverage gate): 36 passed / 36 total

### 2.2 Detail by area
| Area | Total | Passed | Failed | Status |
|---|---:|---:|---:|---|
| UI (frontend component + integration UI cases) | 11 | 9 | 2 | Partial pass |
| API (frontend API + backend API/service tests) | 44 | 44 | 0 | Pass |
| Overall automated tests executed | 64 | 62 | 2 | Partial pass |

### 2.3 Defect Summary
| No | Description | Severity | Status | Evidence |
|---|---|---|---|---|
| 1 | AppShell integration tests fail due to missing AuthProvider context (`useAuth must be used within an AuthProvider`) | Medium | Open | `frontend/test/integration/app-shell.integration.test.tsx` |
| 2 | Backend CI-style command fails coverage gate (`cov-fail-under=29`, actual 25.72%) though all tests passed | Medium | Open | `backend/pytest.ini` |

### 2.4 Command outputs used
- `npm run test:unit` -> 20/20 passed
- `npm run test:integration` -> 6/8 passed, 2 failed
- `python -m pytest -o addopts=''` -> 36/36 passed
- `python -m pytest` -> fails only by coverage threshold

## III. Performance Test Report (k6)

### 3.1 Script
- File: `test_report/k6/api-performance.js`
- Covered endpoints:
  - `GET /health`
  - `GET /docs`
- Load profile:
  - Ramp to 10 VUs (30s)
  - Ramp to 20 VUs (60s)
  - Ramp down to 0 VUs (30s)

### 3.2 Thresholds
- Error rate: `< 10%`
- P95 latency: `< 2000 ms`
- P99 latency: `< 3000 ms`
- Check success rate: `> 95%`

### 3.3 Run commands
- Local k6 (if installed):
  - `k6 run test_report/k6/api-performance.js`
- Docker k6 (recommended when local k6 is missing):
  - `docker run --rm -i -e BASE_URL=http://host.docker.internal:8000 -v ${PWD}:/work -w /work grafana/k6 run test_report/k6/api-performance.js`

### 3.4 Current execution status
- Not executed in this session because:
  - k6 is not installed on host.
  - Backend endpoint `http://localhost:8000/health` was unreachable at run time.

### 3.5 Fields to fill after run
| Metric | Value | Threshold | Status |
|---|---:|---|---|
| Total Requests | TBD | - | TBD |
| Failed Requests | TBD | < 10% | TBD |
| Max VUs | 20 | - | Planned |
| Test Duration | 120s (+graceful) | - | Planned |
| Requests/sec | TBD | > 10 req/s | TBD |
| P95 Response Time | TBD | < 2000ms | TBD |
| P99 Response Time | TBD | < 3000ms | TBD |

## IV. Recommendations
1. Fix `AppShell` integration test by wrapping tested component with `AuthProvider` in the test setup.
2. Increase backend coverage above 29% or adjust the fail-under threshold for current phase.
3. Start backend (`docker compose up backend`) then run k6 to finalize performance section with actual metrics.
