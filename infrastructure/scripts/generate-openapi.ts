import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { swaggerSpec } from "../../interfaces/config/swagger";

const outputPath = path.resolve(process.cwd(), "docs/openapi.json");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(swaggerSpec, null, 2)}\n`, "utf8");

console.log(`[docs:api] Wrote OpenAPI spec to ${outputPath}`);