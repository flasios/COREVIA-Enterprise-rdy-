import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n"; // Initialize i18n (en/ar) with RTL support

function getCsrfTokenFromCookie(): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("XSRF-TOKEN="));

  if (!cookie) {
    return null;
  }

  const value = cookie.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

function isSameOriginRequest(input: RequestInfo | URL): boolean {
  try {
    const requestUrl =
      typeof input === "string"
        ? new URL(input, window.location.origin)
        : input instanceof URL
          ? input
          : new URL(input.url, window.location.origin);

    return requestUrl.origin === window.location.origin;
  } catch {
    return false;
  }
}

function installCsrfFetchInterceptor(): void {
  const nativeFetch = window.fetch.bind(window);
  const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (!safeMethods.has(method) && isSameOriginRequest(input)) {
      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) {
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        }
        if (!headers.has("X-CSRF-Token")) {
          headers.set("X-CSRF-Token", csrfToken);
        }
        return nativeFetch(input, { ...init, headers });
      }
    }

    return nativeFetch(input, init);
  };
}

installCsrfFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
