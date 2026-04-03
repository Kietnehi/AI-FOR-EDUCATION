#!/usr/bin/env bash
set -euo pipefail

DISPLAY_NUM="${DISPLAY:-:99}"
XVFB_GEOMETRY="${XVFB_WHD:-1440x960x24}"
VNC_BIND_PORT="${VNC_PORT:-5900}"
NOVNC_BIND_PORT="${NOVNC_PORT:-6080}"
NOVNC_WEB_DIR="${NOVNC_WEB_DIR:-/usr/share/novnc}"

DISPLAY_ID="${DISPLAY_NUM#:}"
rm -f "/tmp/.X${DISPLAY_ID}-lock"

mkdir -p /tmp/.X11-unix /tmp/novnc

Xvfb "${DISPLAY_NUM}" -screen 0 "${XVFB_GEOMETRY}" -ac +extension RANDR &
XVFB_PID=$!

sleep 1

openbox >/tmp/openbox.log 2>&1 &
OPENBOX_PID=$!

x11vnc -display "${DISPLAY_NUM}" -forever -shared -nopw -listen 0.0.0.0 -rfbport "${VNC_BIND_PORT}" >/tmp/x11vnc.log 2>&1 &
X11VNC_PID=$!

websockify --web="${NOVNC_WEB_DIR}" "${NOVNC_BIND_PORT}" "127.0.0.1:${VNC_BIND_PORT}" >/tmp/novnc.log 2>&1 &
WEBSOCKIFY_PID=$!

cleanup() {
  kill "${WEBSOCKIFY_PID}" "${X11VNC_PID}" "${OPENBOX_PID}" "${XVFB_PID}" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

"$@" &
APP_PID=$!
wait "${APP_PID}"
