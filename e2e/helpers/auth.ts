import { expect, type APIRequestContext, type Page } from '@playwright/test';

const AUTH_SESSION_HINT_STORAGE_KEY = 'corevia.auth.session-present';

type BrowserCookie = {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
  expires?: number;
};

function getBaseUrl(): string {
  return process.env.BASE_URL ?? 'http://localhost:5000';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTrustedAuthHeaders(origin?: string): Record<string, string> {
  const resolvedOrigin = origin ?? new URL(getBaseUrl()).origin;

  return {
    Origin: resolvedOrigin,
    Referer: `${resolvedOrigin}/login`,
  };
}

function parseSetCookieHeaders(headerValues: string[], cookieUrl: string): BrowserCookie[] {

  return headerValues.map((headerValue) => {
    const [nameValue, ...rawAttributes] = headerValue.split(';');
    const separatorIndex = nameValue.indexOf('=');
    const name = nameValue.slice(0, separatorIndex).trim();
    const value = nameValue.slice(separatorIndex + 1).trim();

    const cookie: BrowserCookie = {
      name,
      value,
      url: cookieUrl,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    };

    for (const rawAttribute of rawAttributes) {
      const [attributeName, attributeValue] = rawAttribute.split('=');
      const normalizedName = attributeName.trim().toLowerCase();
      const normalizedValue = attributeValue?.trim();

      if (normalizedName === 'httponly') {
        cookie.httpOnly = true;
      } else if (normalizedName === 'secure') {
        cookie.secure = true;
      } else if (normalizedName === 'samesite' && normalizedValue) {
        if (normalizedValue === 'Strict' || normalizedValue === 'Lax' || normalizedValue === 'None') {
          cookie.sameSite = normalizedValue;
        }
      } else if (normalizedName === 'expires' && normalizedValue) {
        const timestamp = Date.parse(normalizedValue);
        if (!Number.isNaN(timestamp)) {
          cookie.expires = Math.floor(timestamp / 1000);
        }
      }
    }

    return cookie;
  });
}

export function getE2ECredentials(): { username: string; password: string } {
  const username = process.env.E2E_USERNAME ?? 'superadmin';
  const password = process.env.E2E_PASSWORD;

  if (!password) {
    throw new Error('Set E2E_PASSWORD before running authenticated Playwright flows.');
  }

  return { username, password };
}

export async function loginWithRequest(request: APIRequestContext): Promise<void> {
  const { username, password } = getE2ECredentials();

  const response = await request.post('/api/auth/login', {
    headers: getTrustedAuthHeaders(),
    data: {
      username,
      password,
    },
  });
  const responseBody = await response.text();

  expect(response.ok(), responseBody).toBeTruthy();
}

export async function loginViaUi(page: Page, destination: string): Promise<void> {
  const { username, password } = getE2ECredentials();

  await page.goto('/login');
  const origin = new URL(page.url()).origin;

  const loginResponse = await page.request.post('/api/auth/login', {
    headers: getTrustedAuthHeaders(origin),
    data: {
      username,
      password,
    },
  });
  const loginBody = await loginResponse.text();
  expect(loginResponse.ok(), loginBody).toBeTruthy();

  const setCookieHeaders = loginResponse
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value);

  const browserCookies = parseSetCookieHeaders(setCookieHeaders, origin).filter(
    (cookie) => cookie.name === 'corevia.sid' || cookie.name === 'XSRF-TOKEN',
  );
  await page.context().addCookies(browserCookies);
  await page.addInitScript((authSessionHintKey) => {
    localStorage.setItem(authSessionHintKey, 'true');
  }, AUTH_SESSION_HINT_STORAGE_KEY);
  await page.evaluate((authSessionHintKey) => {
    localStorage.setItem(authSessionHintKey, 'true');
  }, AUTH_SESSION_HINT_STORAGE_KEY);

  const destinationUrl = new URL(destination, origin);
  const destinationPattern = new RegExp(`${escapeRegex(destinationUrl.pathname)}(?:$|[?#])`);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(destination);
    await page.waitForLoadState('networkidle');
    if (destinationPattern.test(page.url())) {
      break;
    }
    await page.waitForTimeout(500);
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(destinationPattern, { timeout: 10_000 });
}

export { getTrustedAuthHeaders };
