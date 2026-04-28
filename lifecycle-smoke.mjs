#!/usr/bin/env node
/**
 * lifecycle-smoke.mjs
 *
 * Node.js-based lifecycle smoke script that avoids the CSRF issues that
 * affect raw curl pipelines. Uses native fetch with a manual Set-Cookie
 * store so every request in the same session automatically carries the
 * correct corevia.sid and XSRF-TOKEN values.
 *
 * Usage:
 *   E2E_PASSWORD='<password>' BASE_URL='http://127.0.0.1:5001' node lifecycle-smoke.mjs
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:5001').replace(/\/$/, '');
const USERNAME = process.env.E2E_USERNAME ?? 'superadmin';
const PASSWORD = process.env.E2E_PASSWORD;

if (!PASSWORD) {
  console.error('❌  Set E2E_PASSWORD before running this script.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Minimal cookie store
// ---------------------------------------------------------------------------

const cookieStore = new Map(); // name → { value, path, httpOnly }

function parseCookies(headers) {
  const setCookieValues = headers.getSetCookie
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);

  for (const raw of setCookieValues) {
    const [nameValue] = raw.split(';');
    const eq = nameValue.indexOf('=');
    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();
    const httpOnly = /HttpOnly/i.test(raw);
    cookieStore.set(name, { value, httpOnly });
  }
}

function buildCookieHeader() {
  return [...cookieStore.entries()].map(([k, v]) => `${k}=${v.value}`).join('; ');
}

function getCsrfToken() {
  return cookieStore.get('XSRF-TOKEN')?.value ?? null;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const cookie = buildCookieHeader();

  const headers = {
    'Content-Type': 'application/json',
    Origin: new URL(BASE_URL).origin,
    Referer: `${BASE_URL}/`,
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(url, { ...options, headers });
  parseCookies(res.headers);
  return res;
}

async function post(path, body, extraHeaders = {}) {
  const csrf = getCsrfToken();
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...extraHeaders,
    },
  });
}

async function patch(path, body) {
  const csrf = getCsrfToken();
  return apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: csrf ? { 'X-CSRF-Token': csrf } : {},
  });
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function ok(label, res, body) {
  if (res.ok) {
    console.log(`✅  ${label} (${res.status})`);
  } else {
    console.error(`❌  ${label} (${res.status}): ${JSON.stringify(body)}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Smoke flow
// ---------------------------------------------------------------------------

console.log(`\n🔍  COREVIA lifecycle smoke → ${BASE_URL}\n`);

// 1. Login
const loginRes = await post('/api/auth/login', { username: USERNAME, password: PASSWORD }, {
  Referer: `${BASE_URL}/login`,
});
const loginBody = await loginRes.json();
ok('Login', loginRes, loginBody);

// 2. Fetch fresh CSRF token (ensures session is synced and XSRF-TOKEN cookie is current)
const csrfRes = await apiFetch('/api/auth/csrf-token');
const csrfBody = await csrfRes.json();
if (csrfBody.csrfToken && !cookieStore.has('XSRF-TOKEN')) {
  cookieStore.set('XSRF-TOKEN', { value: csrfBody.csrfToken, httpOnly: false });
}
ok('CSRF token fetch', csrfRes, csrfBody);
console.log(`   token=${getCsrfToken()?.slice(0, 12)}...`);

// 3. Create project
const createRes = await post('/api/portfolio/projects', {
  directCreate: true,
  projectName: `Smoke ${Date.now()}`,
  projectDescription: 'Lifecycle smoke test project',
  workspacePath: 'standard',
});
const createBody = await createRes.json();
ok('Create project', createRes, createBody);
const projectId = createBody.data?.id;
console.log(`   projectId=${projectId}`);

// 4. Fetch project
const fetchRes = await apiFetch(`/api/portfolio/projects/${projectId}`);
const fetchBody = await fetchRes.json();
ok('Fetch project', fetchRes, fetchBody);

// 5. Create closure gate
const gateRes = await post(`/api/portfolio/projects/${projectId}/gates`, {
  gateName: 'Smoke Closure Gate',
  gateType: 'closure',
  gateOrder: 500,
  description: 'Smoke test closure gate',
});
const gateBody = await gateRes.json();
ok('Create closure gate', gateRes, gateBody);
const gateId = gateBody.data?.id;
console.log(`   gateId=${gateId}`);

// 6. Create approval
const approvalRes = await post(`/api/portfolio/projects/${projectId}/approvals`, {
  approvalType: 'document',
  title: 'Smoke Closure Sign-off',
  description: 'Smoke test closure approval',
  priority: 'high',
  status: 'pending',
  gateId,
});
const approvalBody = await approvalRes.json();
ok('Create closure approval', approvalRes, approvalBody);
const approvalId = approvalBody.data?.id;
console.log(`   approvalId=${approvalId}`);

// 7. Approve
const decideRes = await post(`/api/portfolio/approvals/${approvalId}/decide`, {
  decision: 'approved',
  comments: 'Smoke test — approved.',
});
const decideBody = await decideRes.json();
ok('Approve closure', decideRes, decideBody);
console.log(`   status=${decideBody.data?.status}`);

// 8. Patch closure metadata
const patchRes = await patch(`/api/portfolio/projects/${projectId}`, {
  metadata: {
    closurePackage: {
      operationsOwner: 'Smoke Owner',
      supportModel: 'Hypercare',
      archiveLocation: '/smoke/archive',
      lessonsLearned: 'Smoke test passed.',
      benefitsSummary: 'All lifecycle stages validated.',
      handoverDate: new Date().toISOString().split('T')[0],
      checklist: {
        docsArchived: true,
        supportTransferred: true,
        finalCommsSent: true,
        financialsClosed: true,
      },
      updatedAt: new Date().toISOString(),
    },
  },
});
const patchBody = await patchRes.json();
ok('Save closure package metadata', patchRes, patchBody);

// 9. Submit closure gate
const submitRes = await patch(`/api/portfolio/projects/${projectId}/gates/${gateId}`, {
  status: 'submitted',
  reviewNotes: 'Smoke test submission.',
});
const submitBody = await submitRes.json();
ok('Submit closure gate', submitRes, submitBody);

console.log('\n✅  All lifecycle smoke checks passed.\n');
