/**
 * Shared · Hooks
 *
 * Cross-module React hooks that are NOT domain-specific.
 * Domain hooks belong in `modules/<domain>/hooks/`.
 */

export { useToast } from "@/hooks/use-toast";
export { useAuthorization } from "@/hooks/useAuthorization";
export { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
export { useWebSocket } from "@/hooks/useWebSocket";
export { useSystemMonitoring } from "@/modules/admin/hooks/useSystemMonitoring";
