import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    checks: ['rate>0.95'],
  },
};

function get(path) {
  return http.get(`${BASE_URL}${path}`, {
    tags: { endpoint: path },
    timeout: '30s',
  });
}

export default function () {
  const healthRes = get('/health');
  check(healthRes, {
    'GET /health status is 200': (r) => r.status === 200,
  });

  const docsRes = get('/docs');
  check(docsRes, {
    'GET /docs status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
