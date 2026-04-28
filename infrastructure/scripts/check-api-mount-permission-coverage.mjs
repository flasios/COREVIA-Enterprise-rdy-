import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const domainsApiDir = path.resolve(rootDir, "domains");

const authOnlyAllowed = new Map([
  ["/api/auth", "Authentication bootstrap endpoint"],
  ["/api/compliance", "Compliance permissions are enforced per endpoint inside compliance.routes.ts"],
  ["/api/notifications", "Per-user notification endpoints enforce ownership inside route handlers"],
  ["/api/demand-conversion-requests", "Fine-grained permission checks are applied per conversion endpoint"],
  ["/api/demand-reports", "Ownership and workflow permissions are enforced in route-level handlers"],
  ["/api/demand-analysis", "Report access constraints are enforced per endpoint"],
  ["/api/ea", "Registry operations enforce role constraints inside domain handlers"],
  ["/api/ea/registry", "Registry operations enforce role constraints inside domain handlers"],
  ["/api/gates", "Governance mutation routes enforce workflow permissions at endpoint level"],
  ["/api/business-cases", "Business-case authorization is enforced by route-level ownership and workflow checks"],
  ["/api/tenders", "Tender approval and generation access are enforced in tender route handlers"],
  ["/api/vendor-evaluation", "Vendor evaluation routes enforce tender-scoped authorization"],
  ["/api/privacy", "Privacy routes are authenticated and user-scoped"],
  ["/api/knowledge", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/knowledge/documents", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/knowledge/upload", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/knowledge/graph", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/knowledge/briefings", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/knowledge/insights", "Knowledge permissions are enforced per endpoint by domain service policy"],
  ["/api/synergy-opportunities", "Portfolio-scoped authorization is enforced in route handlers"],
  ["/api/synergy-detection", "Portfolio-scoped authorization is enforced in route handlers"],
  ["/api/versions", "Version workflow routes enforce permissions at endpoint level"],
  ["/api/dashboard", "Dashboard data is filtered by authenticated user context in route handlers"],
  ["/api/reporting", "Reporting endpoints enforce role/ownership checks within domain services"],
]);

function listRegisterRouteFiles(dirPath) {
  const files = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "__tests__") {
        continue;
      }
      files.push(...listRegisterRouteFiles(absolute));
      continue;
    }

    if (/register.*Routes\.ts$/i.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

function parseMounts(source) {
  return [...source.matchAll(/app\.use\(\s*"([^"]+)"([\s\S]*?)\);/g)]
    .map((match) => ({
      path: match[1],
      call: match[0],
    }))
    .filter((mount) => mount.path.startsWith("/api"));
}

const registerFiles = listRegisterRouteFiles(domainsApiDir);
const failures = [];

for (const filePath of registerFiles) {
  const source = readFileSync(filePath, "utf8");
  const mounts = parseMounts(source);

  for (const mount of mounts) {
    const hasRequireAuth = mount.call.includes("requireAuth");
    const hasPermissionGate = mount.call.includes("requirePermission(");
    const isAuthOnlyException = authOnlyAllowed.has(mount.path);

    if (!hasRequireAuth && !isAuthOnlyException) {
      failures.push({
        filePath,
        route: mount.path,
        reason: "Missing requireAuth middleware on API mount",
      });
      continue;
    }

    if (!hasPermissionGate && !isAuthOnlyException) {
      failures.push({
        filePath,
        route: mount.path,
        reason: "Missing requirePermission middleware and no auth-only allowlist exception",
      });
    }
  }
}

if (failures.length > 0) {
  console.error("API mount permission coverage failed. Unmanaged mounts detected:\n");
  for (const failure of failures) {
    const relativePath = path.relative(rootDir, failure.filePath);
    console.error(`- ${failure.route} in ${relativePath}: ${failure.reason}`);
  }
  console.error("\nIf auth-only is intentional, add the mount path to authOnlyAllowed with a security rationale.");
  process.exit(1);
}

console.log("API mount permission coverage passed.");
