# syntax=docker/dockerfile:1.7

ARG CUDA_RUNTIME_IMAGE=nvidia/cuda:12.8.0-runtime-ubuntu22.04
FROM ${CUDA_RUNTIME_IMAGE} AS base

ARG REQUIREMENTS_FILE=requirements.txt
ARG TORCH_CUDA_CHANNEL=cu128
ARG INSTALL_GPU_RUNTIME=1
ARG INSTALL_PLAYWRIGHT_BROWSER=1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    PLAYWRIGHT_BROWSERS_PATH=/usr/local/bin/playwright-browsers \
    DISPLAY=:99 \
    XVFB_WHD=1440x960x24 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-dev \
        build-essential \
        tzdata \
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
        libreoffice \
        xvfb \
        x11vnc \
        novnc \
        websockify \
        openbox \
        dbus-x11 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && ln -sf /usr/bin/pip3 /usr/bin/pip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements*.txt ./

RUN pip install --upgrade pip \
    && pip install -r ${REQUIREMENTS_FILE} \
    && if [ "$INSTALL_GPU_RUNTIME" = "1" ]; then \
        pip install --no-cache-dir --force-reinstall --index-url https://download.pytorch.org/whl/${TORCH_CUDA_CHANNEL} torch torchvision; \
        pip install --no-cache-dir --force-reinstall onnxruntime-gpu; \
    fi \
    && if [ "$INSTALL_PLAYWRIGHT_BROWSER" = "1" ]; then \
        mkdir -p $PLAYWRIGHT_BROWSERS_PATH; \
        playwright install chrome; \
        playwright install-deps chrome; \
    fi \
    && mkdir -p $PLAYWRIGHT_BROWSERS_PATH \
    && chmod -R 777 $PLAYWRIGHT_BROWSERS_PATH

COPY . .

RUN useradd -m -u 10001 appuser \
    && mkdir -p /app/storage \
    && chown -R appuser:appuser /app \
    && chmod +x /app/start-backend-with-gui.sh

USER appuser

EXPOSE 8000
EXPOSE 5900
EXPOSE 6080

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio"]
