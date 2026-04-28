import { build } from "esbuild";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outRoot = path.resolve(root, "dist");

const resolveEntry = (...candidates) => {
  for (const candidate of candidates) {
    const resolved = path.resolve(root, candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  throw new Error(`No build entry found for candidates: ${candidates.join(", ")}`);
};

const sharedConfig = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
};

await mkdir(outRoot, { recursive: true });

await build({
  ...sharedConfig,
  entryPoints: [resolveEntry("apps/api/index.ts")],
  outfile: path.resolve(outRoot, "index.js"),
});