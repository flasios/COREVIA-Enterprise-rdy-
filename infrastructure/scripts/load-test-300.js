import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

export const options = {
  scenarios: {
    corevia_300_users: {
      executor: "ramping-vus",
      stages: [
        { duration: __ENV.RAMP_STAGE_1 || "30s", target: Number(__ENV.STAGE_1_VUS || 100) },
        { duration: __ENV.RAMP_STAGE_2 || "30s", target: Number(__ENV.STAGE_2_VUS || 200) },
        { duration: __ENV.RAMP_STAGE_3 || "45s", target: Number(__ENV.TARGET_VUS || 300) },
        { duration: __ENV.STEADY_STAGE || "90s", target: Number(__ENV.TARGET_VUS || 300) },
        { duration: __ENV.RAMP_DOWN_STAGE || "45s", target: 0 },
      ],
      gracefulRampDown: __ENV.GRACEFUL_RAMP_DOWN || "30s",
      exec: "authenticatedUserJourney",
    },
  },
  thresholds: {
    checks: [__ENV.THRESHOLD_CHECKS || "rate>0.99"],
    http_req_failed: [__ENV.THRESHOLD_HTTP_FAILED || "rate<0.02"],
    http_req_duration: [__ENV.THRESHOLD_HTTP_P95 || "p(95)<1500"],
    auth_success_rate: [__ENV.THRESHOLD_AUTH_SUCCESS || "rate>0.99"],
    "http_req_duration{name:csrf_bootstrap}": [__ENV.THRESHOLD_CSRF_P95 || "p(95)<800"],
    "http_req_duration{name:auth_login}": [__ENV.THRESHOLD_LOGIN_P95 || "p(95)<1200"],
    "http_req_duration{name:auth_me}": [__ENV.THRESHOLD_ME_P95 || "p(95)<1000"],
    "http_req_duration{name:session_check}": [__ENV.THRESHOLD_SESSION_P95 || "p(95)<900"],
    "http_req_duration{name:notifications_list}": [__ENV.THRESHOLD_NOTIFICATIONS_P95 || "p(95)<1200"],
    "http_req_duration{name:notifications_unread}": [__ENV.THRESHOLD_NOTIFICATIONS_UNREAD_P95 || "p(95)<1200"],
    "http_req_duration{name:health_ready}": [__ENV.THRESHOLD_READY_P95 || "p(95)<750"],
  },
};

const authSuccessRate = new Rate("auth_success_rate");
const baseUrl = __ENV.BASE_URL || "http://127.0.0.1:5000";
const username = __ENV.LOADTEST_USERNAME || __ENV.E2E_USERNAME || "superadmin";
const password = __ENV.LOADTEST_PASSWORD || __ENV.E2E_PASSWORD;
const sessionCookieName = __ENV.SESSION_COOKIE_NAME || "corevia.sid";

function getBaseOrigin(url) {
  const match = url.match(/^(https?:\/\/[^/]+)/i);
  if (!match) {
    throw new Error(`Unable to derive origin from BASE_URL: ${url}`);
  }
  return match[1];
}

const baseOrigin = getBaseOrigin(baseUrl);
const loginHeaders = {
  Origin: baseOrigin,
  Referer: `${baseOrigin}/login`,
  "Content-Type": "application/json",
  Accept: "application/json",
};
const jsonHeaders = {
  Accept: "application/json",
};

let authenticated = false;
let csrfToken = null;
let completedIterations = 0;
let sessionCookieHeader = null;

if (!password) {
  throw new Error("LOADTEST_PASSWORD or E2E_PASSWORD must be set before running the 300-user load test.");
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function buildSessionCookieHeader() {
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(baseUrl);
  const pairs = [];

  for (const [name, values] of Object.entries(cookies)) {
    if (!Array.isArray(values) || values.length === 0) {
      continue;
    }
    pairs.push(`${name}=${values[0]}`);
  }

  if (!pairs.some((pair) => pair.startsWith(`${sessionCookieName}=`))) {
    return null;
  }

  return pairs.join("; ");
}

function getProtectedHeaders() {
  return sessionCookieHeader
    ? {
        ...jsonHeaders,
        Cookie: sessionCookieHeader,
      }
    : jsonHeaders;
}

function ensureAuthenticated() {
  if (authenticated) {
    return true;
  }

  const csrfResponse = http.get(`${baseUrl}/api/auth/csrf-token`, {
    headers: jsonHeaders,
    tags: { name: "csrf_bootstrap" },
  });
  const csrfBody = parseJson(csrfResponse);
  const nextCsrfToken = csrfBody && csrfBody.success ? csrfBody.csrfToken : null;

  const csrfOk = check(csrfResponse, {
    "csrf token responds": (result) => result.status === 200,
    "csrf token payload valid": () => typeof nextCsrfToken === "string" && nextCsrfToken.length > 0,
  });

  if (!csrfOk || !nextCsrfToken) {
    authSuccessRate.add(false);
    return false;
  }

  csrfToken = nextCsrfToken;

  const loginResponse = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ username, password }),
    {
      headers: {
        ...loginHeaders,
        "X-CSRF-Token": csrfToken,
      },
      tags: { name: "auth_login" },
    },
  );

  const loginBody = parseJson(loginResponse);
  const loginOk = check(loginResponse, {
    "login responds": (result) => result.status === 200,
    "login returns success": () => Boolean(loginBody && loginBody.success === true),
  });

  sessionCookieHeader = loginOk ? buildSessionCookieHeader() : null;
  authenticated = loginOk;
  authSuccessRate.add(loginOk);
  return loginOk && Boolean(sessionCookieHeader);
}

function requestSessionBatch() {
  const responses = http.batch([
    ["GET", `${baseUrl}/api/auth/me`, null, { headers: getProtectedHeaders(), tags: { name: "auth_me" } }],
    ["GET", `${baseUrl}/api/auth/session-check`, null, { headers: getProtectedHeaders(), tags: { name: "session_check" } }],
    ["GET", `${baseUrl}/api/notifications?limit=20`, null, { headers: getProtectedHeaders(), tags: { name: "notifications_list" } }],
  ]);

  const meBody = parseJson(responses[0]);
  const sessionBody = parseJson(responses[1]);
  const notificationsBody = parseJson(responses[2]);

  const batchOk = [
    check(responses[0], {
      "auth me responds": (result) => result.status === 200,
      "auth me payload valid": () => Boolean(meBody && meBody.success === true && meBody.data),
    }),
    check(responses[1], {
      "session check responds": (result) => result.status === 200,
      "session check authenticated": () => Boolean(sessionBody && sessionBody.success === true && sessionBody.authenticated === true),
    }),
    check(responses[2], {
      "notifications respond": (result) => result.status === 200,
      "notifications payload valid": () => Boolean(notificationsBody && notificationsBody.success === true),
    }),
  ].every(Boolean);

  return batchOk;
}

function requestFollowUpReads() {
  const unreadResponse = http.get(`${baseUrl}/api/notifications/unread`, {
    headers: getProtectedHeaders(),
    tags: { name: "notifications_unread" },
  });
  const unreadBody = parseJson(unreadResponse);

  const unreadOk = check(unreadResponse, {
    "notifications unread responds": (result) => result.status === 200,
    "notifications unread payload valid": () => Boolean(unreadBody && unreadBody.success === true),
  });

  let readyOk = true;
  if (completedIterations % 5 === 0) {
    const readyResponse = http.get(`${baseUrl}/api/health/ready`, {
      headers: jsonHeaders,
      tags: { name: "health_ready" },
    });
    readyOk = check(readyResponse, {
      "ready endpoint responds": (result) => result.status === 200,
      "ready endpoint payload valid": (result) => (result.headers["Content-Type"] || "").includes("application/json"),
    });
  }

  return unreadOk && readyOk;
}

export function setup() {
  const response = http.get(`${baseUrl}/api/health`, { tags: { name: "setup_health" } });
  const healthy = check(response, {
    "setup health endpoint responds": (result) => result.status === 200,
  });

  if (!healthy) {
    throw new Error(`Health check failed before load test: status ${response.status}`);
  }
}

export function authenticatedUserJourney() {
  if (!ensureAuthenticated()) {
    sleep(1);
    return;
  }

  const batchOk = requestSessionBatch();
  if (!batchOk) {
    authenticated = false;
    sessionCookieHeader = null;
  }

  const followUpOk = requestFollowUpReads();
  if (!followUpOk) {
    authenticated = false;
    sessionCookieHeader = null;
  }

  completedIterations += 1;
  sleep(Number(__ENV.THINK_TIME_SECONDS || 0.4));
}