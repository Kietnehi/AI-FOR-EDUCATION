# CD Local Build + Self-hosted Windows Runner + Named Tunnel

This guide defines the flow in `project-cd.yml` after migrating to self-hosted runner:

1. Push code to GitHub.
2. GitHub Actions jobs run on repository self-hosted runner (`self-hosted`, `Windows`, `x64`).
3. Runner executes `scripts/deploy.ps1` directly on the same Windows machine.
4. Deploy script builds backend and frontend images locally.
5. Deployment restarts `docker-compose.prod.yml` with newly built images.
6. Public traffic is exposed by a standalone Windows `cloudflared` service (not from compose).

## 1. Required GitHub Variables

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_HOST`

These variables are still required for frontend runtime config.

## 2. Self-hosted Runner Setup (Windows)

1. Open repository settings -> Actions -> Runners -> New self-hosted runner.
2. Choose Windows x64 and follow registration commands on the target machine.
3. Ensure runner labels include exactly: `self-hosted`, `Windows`, `x64`.
4. Install runner as a service so it can process jobs continuously after reboot.
5. Verify runner appears as `Idle` in repository settings.

Recommended command pattern (from `D:\actions-runner`):

```powershell
.\config.cmd --url <REPO_URL> --token <RUNNER_TOKEN> --runasservice
```

## 3. Host Setup (Windows)

1. Install Docker Desktop and verify `docker compose` works.
2. Clone repository to `D:\DACN`.
3. Copy `.env.prod.example` to `.env.prod` and fill all values.
4. Ensure `scripts/deploy.ps1` and `docker-compose.prod.yml` exist in `D:\DACN`.
5. Verify local command works:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\DACN\scripts\deploy.ps1
```

## 4. Named Tunnel Setup

1. Create a Cloudflare Named Tunnel in your Cloudflare account.
2. Create ingress rules in Cloudflare dashboard:
   - `app.<domain>` -> `http://frontend:3000`
   - `api.<domain>` -> `http://backend:8000`
3. Install `cloudflared` on Windows host and register tunnel as a Windows service:

```powershell
cloudflared service install <TUNNEL_TOKEN>
Set-Service cloudflared -StartupType Automatic
Start-Service cloudflared
```

4. Verify service status:

```powershell
Get-Service cloudflared
```

5. Update Google OAuth and Turnstile allowed domains to stable `app.<domain>`.

Note: current production compose file does not include a `cloudflared` service.

## 5. Rollback

Rollback bằng cách checkout commit cũ rồi chạy lại workflow CD (hoặc chạy `scripts/deploy.ps1`).

## 6. Verification

- `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
- `http://localhost:8000/health` returns `200` on host
- Public frontend and API hostnames resolve via Cloudflare tunnel

## 7. Startup Checklist (Each Time The Machine Boots)

Use this checklist so CD can run successfully after reboot:

1. Ensure Docker Desktop is running and engine is healthy.
2. Ensure GitHub runner is online:
   - Preferred: runner installed as Windows service and status is `Running`.
   - Temporary/manual mode: run `D:\actions-runner\run.cmd` in a terminal and keep it open.
3. Ensure `cloudflared` service is running (`Get-Service cloudflared`).
4. Optional quick health check before pushing:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
Invoke-WebRequest http://localhost:8000/health
```
