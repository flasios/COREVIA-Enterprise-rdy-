import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Custom error thrown when the backend returns a structured 409 GENERATION_BLOCKED
 * response. UI can catch this in mutation onError and surface the BlockedGenerationDialog.
 */
export class BlockedGenerationError extends Error {
  readonly isBlockedGeneration = true;
  readonly status: number;
  readonly payload: {
    success: false;
    blocked: true;
    code: "GENERATION_BLOCKED";
    artifact: string;
    artifactLabel: string;
    title: string;
    summary: string;
    reasons: Array<{ code: string; message: string; layer?: number }>;
    actions: Array<{
      id: "retry" | "request_approval" | "use_template";
      label: string;
      description: string;
      method?: "GET" | "POST";
      endpoint?: string;
    }>;
    context: Record<string, unknown>;
  };

  constructor(payload: BlockedGenerationError["payload"], status: number) {
    super(payload.title || "Generation blocked");
    this.name = "BlockedGenerationError";
    this.payload = payload;
    this.status = status;
  }
}

export function isBlockedGenerationError(err: unknown): err is BlockedGenerationError {
  return (
    err instanceof BlockedGenerationError ||
    (typeof err === "object" && err !== null && (err as { isBlockedGeneration?: boolean }).isBlockedGeneration === true)
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Special handling: 409 with GENERATION_BLOCKED payload
    if (res.status === 409) {
      const cloned = res.clone();
      try {
        const body = await cloned.json();
        if (body && body.code === "GENERATION_BLOCKED" && body.blocked === true) {
          throw new BlockedGenerationError(body, res.status);
        }
      } catch (parseErr) {
        if (parseErr instanceof BlockedGenerationError) throw parseErr;
        // fall through to default error
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("XSRF-TOKEN="));

  if (!cookie) {
    return null;
  }

  const value = cookie.split("=")[1];
  return value ? decodeURIComponent(value) : null;
}

function buildRequestHeaders(method: string, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {};
  const normalizedMethod = method.toUpperCase();

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const hasBody = data !== undefined;
  const res = await fetch(url, {
    method,
    headers: buildRequestHeaders(method, hasBody),
    body: hasBody ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes - allows background refresh while maintaining performance
      gcTime: 30 * 60 * 1000, // 30 minutes - keeps data in cache longer for navigation
      retry: (failureCount, error) => {
        // Only retry on network errors, not 4xx errors
        if (error instanceof Error && error.message.startsWith('4')) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});
