import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    health_smoke: {
      executor: "constant-vus",
      exec: "healthScenario",
      vus: Number(__ENV.HEALTH_VUS || 10),
      duration: __ENV.HEALTH_DURATION || "30s",
    },
    readiness_smoke: {
      executor: "constant-vus",
      exec: "readinessScenario",
      vus: Number(__ENV.READINESS_VUS || 5),
      duration: __ENV.READINESS_DURATION || "30s",
      startTime: "5s",
    },
    metrics_probe: {
      executor: "constant-arrival-rate",
      exec: "metricsScenario",
      rate: Number(__ENV.METRICS_RATE || 2),
      timeUnit: "1s",
      duration: __ENV.METRICS_DURATION || "30s",
      preAllocatedVUs: Number(__ENV.METRICS_PREALLOCATED_VUS || 5),
      maxVUs: Number(__ENV.METRICS_MAX_VUS || 10),
      startTime: "10s",
    },
    login_page_probe: {
      executor: "ramping-vus",
      exec: "loginPageScenario",
      stages: [
        { duration: __ENV.LOGIN_RAMP_UP || "10s", target: Number(__ENV.LOGIN_TARGET_VUS || 15) },
        { duration: __ENV.LOGIN_STEADY || "20s", target: Number(__ENV.LOGIN_TARGET_VUS || 15) },
        { duration: __ENV.LOGIN_RAMP_DOWN || "10s", target: 0 },
      ],
      startTime: "15s",
    },
  },
  thresholds: {
    http_req_failed: [__ENV.THRESHOLD_HTTP_FAILED || "rate<0.02"],
    http_req_duration: [__ENV.THRESHOLD_HTTP_P95 || "p(95)<750"],
    "http_req_duration{scenario:health_smoke}": [__ENV.THRESHOLD_HEALTH_P95 || "p(95)<250"],
    "http_req_duration{scenario:readiness_smoke}": [__ENV.THRESHOLD_READY_P95 || "p(95)<350"],
    "http_req_duration{scenario:metrics_probe}": [__ENV.THRESHOLD_METRICS_P95 || "p(95)<500"],
    "http_req_duration{scenario:login_page_probe}": [__ENV.THRESHOLD_LOGIN_P95 || "p(95)<1000"],
  },
};

const baseUrl = __ENV.BASE_URL || "http://localhost:5000";
const metricsHeaders = __ENV.METRICS_AUTH_TOKEN
  ? { Authorization: `Bearer ${__ENV.METRICS_AUTH_TOKEN}` }
  : undefined;
const htmlPageHeaders = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function healthScenario() {
  const response = http.get(`${baseUrl}/api/health`);
  check(response, {
    "health endpoint responds": (result) => result.status === 200,
    "health response is json": (result) => (result.headers["Content-Type"] || "").includes("application/json"),
  });
  sleep(0.5);
}

export function readinessScenario() {
  const response = http.get(`${baseUrl}/api/health/ready`);
  check(response, {
    "readiness endpoint responds": (result) => result.status === 200,
    "readiness response is json": (result) => (result.headers["Content-Type"] || "").includes("application/json"),
  });
  sleep(0.5);
}

export function metricsScenario() {
  const response = http.get(`${baseUrl}/metrics`, { headers: metricsHeaders });
  check(response, {
    "metrics endpoint responds": (result) => result.status === 200,
    "metrics output is prometheus": (result) => (result.body || "").includes("corevia_http_requests_total"),
  });
  sleep(1);
}

export function loginPageScenario() {
  const response = http.get(`${baseUrl}/login?redirect=%2F`, { headers: htmlPageHeaders });
  check(response, {
    "login page responds": (result) => result.status === 200,
    "login page serves spa shell": (result) => {
      const body = result.body || "";
      return body.includes('<div id="root"></div>') && body.includes("/main.tsx");
    },
  });
  sleep(1);
}

function loadTestScenario() {
  healthScenario();
}

export default loadTestScenario;