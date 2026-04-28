/**
 * Console Override — Production Structured Logging
 *
 * Replaces global console.log/info/warn/error with structured JSON output
 * in production. In development, keeps readable format with timestamps.
 *
 * Must be imported BEFORE any other module that uses console.*.
 * The StructuredLogger uses the saved original references internally
 * to avoid circular interception.
 *
 * @module platform
 */

/** Original console methods — preserved for StructuredLogger internal use */
export const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SERVICE_NAME = process.env.SERVICE_NAME || "corevia";

interface StructuredConsoleLog {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  args?: unknown[];
}

function formatArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return JSON.stringify({ unserializable: true });
    }
  }
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean" || typeof arg === "bigint") return `${arg}`;
  if (typeof arg === "symbol") return arg.toString();
  if (arg === undefined) return "undefined";
  return "[Unsupported value]";
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => formatArg(arg)).join(" ");
}

function isAlreadyStructured(arg: unknown): boolean {
  if (typeof arg !== "string") return false;
  // Detect output from StructuredLogger (already JSON)
  try {
    const parsed = JSON.parse(arg);
    return parsed && typeof parsed === "object" && "correlationId" in parsed && "level" in parsed;
  } catch {
    return false;
  }
}

function createOverride(level: string, original: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    // Pass through if already structured JSON from StructuredLogger
    if (args.length === 1 && isAlreadyStructured(args[0])) {
      original(...args);
      return;
    }

    if (IS_PRODUCTION) {
      const log: StructuredConsoleLog = {
        timestamp: new Date().toISOString(),
        level,
        service: SERVICE_NAME,
        message: formatArgs(args),
      };
      original(JSON.stringify(log));
    } else {
      // Development: add timestamp prefix for readability
      const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
      const prefix = `[${ts}] [${level.toUpperCase()}]`;
      original(prefix, ...args);
    }
  };
}

// ── Apply Overrides ─────────────────────────────────────────────────────────

console.log = createOverride("info", originalConsole.log) as typeof console.log;
console.info = createOverride("info", originalConsole.info) as typeof console.info;
console.warn = createOverride("warn", originalConsole.warn) as typeof console.warn;
console.error = createOverride("error", originalConsole.error) as typeof console.error;
console.debug = createOverride("debug", originalConsole.debug) as typeof console.debug;

originalConsole.log(`[ConsoleOverride] Structured logging active (mode=${IS_PRODUCTION ? "production" : "development"})`);
