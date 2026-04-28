import { readFileSync } from "node:fs";
import path from "node:path";

const appRouterPath = path.resolve(process.cwd(), "apps/web/app/AppRouter.tsx");
const source = readFileSync(appRouterPath, "utf8");

const openRoutePattern = /<Route\s+path="([^"]+)"[^>]*>/g;

const unguardedAllowedRoutes = new Set([
  "/login",
  "/register",
  "/decisions",
  "/portfolio",
  "/decision-brain",
  "/decisions/:id",
  "/decision-workspace/:id",
  "/brain-console",
  "/brain-console/decisions",
  "/brain-console/decisions/:id",
  "/brain-console/intelligence",
  "/brain-console/new",
  "/brain-console/services",
  "/brain-console/services/:id",
  "/brain-console/agents",
  "/brain-console/policies",
  "/brain-console/audit-trail",
  "/brain-console/learning",
  "/brain-console/ai-assistant",
]);

const failures = [];

function getRouteBody(startIndex, endIndex) {
  return source.slice(startIndex, endIndex);
}

const matches = [...source.matchAll(openRoutePattern)];
for (let index = 0; index < matches.length; index += 1) {
  const match = matches[index];
  const routePath = match[1];
  const routeStart = match.index;
  const nextRouteStart = index + 1 < matches.length ? matches[index + 1].index : source.length;
  const routeBlock = getRouteBody(routeStart, nextRouteStart);

  const hasProtectedRoute = routeBlock.includes("<ProtectedRoute requiredPermissions={[");
  const isRedirectOnly = routeBlock.includes("<Redirect to=");
  const isExplicitlyAllowed = unguardedAllowedRoutes.has(routePath);

  if (!hasProtectedRoute && !isRedirectOnly && !isExplicitlyAllowed) {
    failures.push(routePath);
  }
}

if (failures.length > 0) {
  console.error("Route permission coverage failed. The following routes are missing ProtectedRoute requiredPermissions guards:");
  for (const routePath of failures) {
    console.error(`- ${routePath}`);
  }
  process.exit(1);
}

console.log("Route permission coverage passed.");
