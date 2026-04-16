# CD to Docker Hub + Auto Deploy on Windows + Named Tunnel

This guide defines the production-like flow implemented in `project-cd.yml`:

1. Push code to GitHub.
2. GitHub Actions builds backend and frontend images.
3. Images are pushed to Docker Hub.
4. Actions connects to the Windows host via SSH.
5. Host runs `scripts/deploy.ps1` to pull latest images and restart `docker-compose.prod.yml`.
6. `cloudflared` service is started from the compose stack using a Named Tunnel token.

## 1. Required GitHub Secrets

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `DEPLOY_HOST` (public IP or DNS of the Windows machine)
- `DEPLOY_USERNAME` (Windows user with Docker permission)
- `DEPLOY_SSH_PRIVATE_KEY` (private key that matches `authorized_keys` on host)

## 2. Required GitHub Variables

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_HOST`

These variables are used as build args for the frontend image.

## 3. Host Setup (Windows)

1. Install Docker Desktop and verify `docker compose` works.
2. Enable OpenSSH Server and ensure port `22` is reachable from GitHub runners.
3. Clone repo to `D:\DACN`.
4. Copy `.env.prod.example` to `.env.prod` and fill all values.
5. Ensure `scripts/deploy.ps1` and `docker-compose.prod.yml` exist in `D:\DACN`.

## 4. Named Tunnel Setup

1. Create a Cloudflare Named Tunnel in your Cloudflare account.
2. Create ingress rules in Cloudflare dashboard:
   - `app.<domain>` -> `http://frontend:3000`
   - `api.<domain>` -> `http://backend:8000`
3. Copy generated tunnel token and set `CLOUDFLARED_TUNNEL_TOKEN` in `.env.prod`.
4. Update Google OAuth and Turnstile allowed domains to the stable `app.<domain>` hostname.

## 5. Deploy Command (manual fallback)

Run on host:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\DACN\scripts\deploy.ps1
```

## 6. Rollback

Set `IMAGE_TAG` in `.env.prod` to a previous SHA tag and run deploy script again.

## 7. Verification

- `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
- `http://localhost:8000/health` returns `200` on host.
- Public frontend and API hostnames resolve via Cloudflare tunnel.
