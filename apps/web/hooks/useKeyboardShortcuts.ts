import { useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { userHasAllEffectivePermissions, type Permission, type Role, type CustomPermissions } from "@shared/permissions";

/* ── Shortcut definitions ── */
interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: string; // route to navigate to, or "custom"
  requiredPermissions?: Permission[];
}

const SHORTCUTS: Shortcut[] = [
  { key: "h", meta: true, description: "Go to Home", action: "/", requiredPermissions: ["report:read"] },
  { key: "b", meta: true, shift: true, description: "Open Brain Console", action: "/brain-console", requiredPermissions: ["brain:view"] },
  { key: "d", meta: true, shift: true, description: "Brain Decisions", action: "/brain-console/decisions", requiredPermissions: ["brain:view"] },
  { key: "g", meta: true, shift: true, description: "Intelligent Gateway", action: "/intelligent-gateway", requiredPermissions: ["report:read"] },
  { key: "l", meta: true, shift: true, description: "Intelligent Library", action: "/intelligent-library", requiredPermissions: ["report:read"] },
  { key: "p", meta: true, shift: true, description: "Portfolio Hub", action: "/portfolio-hub", requiredPermissions: ["portfolio:view"] },
  { key: "n", meta: true, shift: true, description: "New Brain Intake", action: "/brain-console/new", requiredPermissions: ["brain:run"] },
];

/* ── Hook ── */
export function useKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of SHORTCUTS) {
        const hasPermission = !shortcut.requiredPermissions || (
          !!currentUser &&
          userHasAllEffectivePermissions(
            currentUser.role as Role,
            shortcut.requiredPermissions,
            (currentUser.customPermissions ?? null) as CustomPermissions | null,
          )
        );
        if (!hasPermission) continue;

        const metaMatch = shortcut.meta ? e.metaKey || e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          metaMatch &&
          shiftMatch &&
          altMatch
        ) {
          e.preventDefault();
          if (shortcut.action !== "custom") {
            setLocation(shortcut.action);
          }
          return;
        }
      }
    },
    [currentUser, setLocation]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/* ── Shortcuts display for help dialog ── */
export function getShortcutsList() {
  return SHORTCUTS.map((s) => {
    const keys: string[] = [];
    if (s.meta) keys.push("⌘");
    if (s.shift) keys.push("⇧");
    if (s.alt) keys.push("⌥");
    keys.push(s.key.toUpperCase());
    return {
      keys: keys.join(""),
      description: s.description,
    };
  });
}
