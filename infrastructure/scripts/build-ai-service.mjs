import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.resolve(root, "dist/ai-service");

await mkdir(outDir, { recursive: true });

await build({
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  entryPoints: [path.resolve(root, "apps/ai-service/index.ts")],
  outfile: path.resolve(outDir, "index.js"),
});