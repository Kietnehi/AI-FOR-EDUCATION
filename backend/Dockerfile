# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim-bookworm AS deps

ARG REQUIREMENTS_FILE=requirements.txt
ARG TORCH_CUDA_CHANNEL=cu128
ARG INSTALL_GPU_RUNTIME=0
ARG INSTALL_PLAYWRIGHT_BROWSER=0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    UV_LINK_MODE=copy \
    VIRTUAL_ENV=/app/.venv \
    PATH=/app/.venv/bin:/usr/local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.5.24 /uv /usr/local/bin/uv
COPY requirements*.txt ./

RUN --mount=type=cache,target=/root/.cache/uv \
    python -m venv "$VIRTUAL_ENV" \
    && uv pip install --python "$VIRTUAL_ENV/bin/python" -r "$REQUIREMENTS_FILE" \
    && if [ "$INSTALL_GPU_RUNTIME" = "1" ]; then \
        uv pip install --python "$VIRTUAL_ENV/bin/python" --index-url "https://download.pytorch.org/whl/${TORCH_CUDA_CHANNEL}" torch torchvision; \
        uv pip install --python "$VIRTUAL_ENV/bin/python" onnxruntime-gpu; \
    fi

FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ARG APP_UID=10001
ARG APP_GID=10001
ARG INSTALL_LIBREOFFICE=0
ARG INSTALL_PLAYWRIGHT_BROWSER=0

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    VIRTUAL_ENV=/app/.venv \
    PATH=/app/.venv/bin:/usr/local/bin:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DISPLAY=:99 \
    XVFB_WHD=1440x960x24 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tini \
        xvfb \
        x11vnc \
        openbox \
        novnc \
        websockify \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libdbus-1-3 \
        libxcb1 \
        libxkbcommon0 \
        libx11-6 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "$INSTALL_LIBREOFFICE" = "1" ]; then \
        apt-get update \
        && apt-get install -y --no-install-recommends libreoffice \
        && rm -rf /var/lib/apt/lists/*; \
    fi

RUN groupadd --gid "$APP_GID" appuser \
    && useradd --uid "$APP_UID" --gid "$APP_GID" --create-home --shell /usr/sbin/nologin appuser

COPY --from=deps /app/.venv /app/.venv
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser run.py ./run.py
COPY --chown=appuser:appuser sitecustomize.py ./sitecustomize.py
COPY --chown=appuser:appuser start-backend-with-gui.sh ./start-backend-with-gui.sh

RUN mkdir -p /app/storage \
    && chown -R appuser:appuser /app \
    && chmod +x /app/start-backend-with-gui.sh

RUN if [ "$INSTALL_PLAYWRIGHT_BROWSER" = "1" ]; then \
        /app/.venv/bin/playwright install chrome; \
    fi

USER appuser

EXPOSE 8000
EXPOSE 5900
EXPOSE 6080

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]
