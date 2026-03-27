const baseUrl = process.env.WARMUP_BASE_URL || "http://127.0.0.1:3000";
const backendUrl = process.env.WARMUP_BACKEND_URL || "http://backend:8000";

const staticRoutes = [
  "/",
  "/materials",
  "/materials/upload",
  "/materials/video",
  "/converter",
  "/chatbot",
  "/generated",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForFrontend(maxAttempts = 60) {
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      const res = await fetchText(`${baseUrl}/`, 5000);
      if (res.ok) {
        console.log(`[warmup] Frontend ready at attempt ${i}`);
        return true;
      }
    } catch {
      // Ignore and retry.
    }
    await sleep(1000);
  }
  console.warn("[warmup] Frontend was not ready in time, skip warm-up.");
  return false;
}

async function warmRoute(route) {
  const started = Date.now();
  try {
    const res = await fetchText(`${baseUrl}${route}`);
    const ms = Date.now() - started;
    console.log(`[warmup] ${route} -> ${res.status} (${ms}ms)`);
  } catch (error) {
    const ms = Date.now() - started;
    console.warn(`[warmup] ${route} -> failed after ${ms}ms: ${String(error)}`);
  }
}

async function getFirstMaterialId() {
  try {
    const res = await fetchText(`${backendUrl}/api/materials`, 15000);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    return first?.id || first?._id || null;
  } catch {
    return null;
  }
}

async function main() {
  const ready = await waitForFrontend();
  if (!ready) return;

  console.log("[warmup] Start warming static routes...");
  for (const route of staticRoutes) {
    // Sequential requests to avoid CPU spikes at startup.
    await warmRoute(route);
  }

  const materialId = await getFirstMaterialId();
  if (materialId) {
    await warmRoute(`/materials/${materialId}`);
  } else {
    console.log("[warmup] No material id found for dynamic route warm-up.");
  }

  console.log("[warmup] Completed.");
}

main().catch((error) => {
  console.warn(`[warmup] Unexpected error: ${String(error)}`);
});
