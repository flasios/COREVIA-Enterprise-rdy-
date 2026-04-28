import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const baseValuesPath = path.resolve(root, "infrastructure/charts/corevia/values.yaml");
const productionValuesPath = path.resolve(root, "infrastructure/charts/corevia/values-production.yaml");

function parseScalarYaml(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const values = new Map();
  const stack = [];

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#") || line.trimStart().startsWith("- ")) {
      continue;
    }

    const match = line.match(/^(\s*)([^:#][^:]*):(.*)$/);
    if (!match) {
      continue;
    }

    const indent = match[1].length;
    const key = match[2].trim();
    const rawValue = match[3].trim();

    while (stack.length > 0 && indent <= stack.at(-1).indent) {
      stack.pop();
    }

    const currentPath = [...stack.map((entry) => entry.key), key].join(".");

    if (!rawValue) {
      stack.push({ indent, key });
      continue;
    }

    const value = rawValue.replace(/^['"]|['"]$/g, "");
    values.set(currentPath, value);
  }

  return values;
}

function mergeValues(baseValues, overrideValues) {
  const merged = new Map(baseValues);
  for (const [key, value] of overrideValues.entries()) {
    merged.set(key, value);
  }
  return merged;
}

function getValue(values, key) {
  return values.get(key) ?? "";
}

function isTrue(value) {
  return String(value).toLowerCase() === "true";
}

function isPlaceholder(value) {
  return (
    !value ||
    /REPLACE_|example\.gov\.ae|^corevia(?:-api|-processing-worker)?$/i.test(value)
  );
}

function assert(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

const mergedValues = mergeValues(
  parseScalarYaml(baseValuesPath),
  parseScalarYaml(productionValuesPath),
);

const errors = [];

const apiImageRepository = getValue(mergedValues, "image.repository");
const apiImageTag = getValue(mergedValues, "image.tag");
const workerEnabled = isTrue(getValue(mergedValues, "worker.enabled"));
const workerImageRepository = getValue(mergedValues, "worker.image.repository");
const workerImageTag = getValue(mergedValues, "worker.image.tag");
const secretCreate = isTrue(getValue(mergedValues, "secret.create"));
const existingSecretName = getValue(mergedValues, "secret.existingSecretName");
const sessionSecret = getValue(mergedValues, "secretEnv.SESSION_SECRET");
const allowedOrigins = getValue(mergedValues, "secretEnv.ALLOWED_ORIGINS");
const databaseUrl = getValue(mergedValues, "secretEnv.DATABASE_URL");
const redisUrl = getValue(mergedValues, "secretEnv.REDIS_URL");
const metricsAuthToken = getValue(mergedValues, "secretEnv.METRICS_AUTH_TOKEN");
const allowPublicMetrics = isTrue(getValue(mergedValues, "env.ALLOW_PUBLIC_METRICS"));

assert(!isPlaceholder(apiImageRepository) && apiImageRepository.includes("/"), "image.repository must point to a non-placeholder registry/repository for production.", errors);
assert(Boolean(apiImageTag) && !isPlaceholder(apiImageTag), "image.tag must be set to a non-placeholder immutable release tag for production.", errors);

if (workerEnabled) {
  assert(getValue(mergedValues, "env.COREVIA_INLINE_WORKER") === "false", "env.COREVIA_INLINE_WORKER must be false when worker.enabled=true.", errors);
  assert(!isPlaceholder(workerImageRepository) && workerImageRepository.includes("/"), "worker.image.repository must point to a non-placeholder registry/repository when worker.enabled=true.", errors);
  assert(Boolean(workerImageTag) && !isPlaceholder(workerImageTag), "worker.image.tag must be set to a non-placeholder immutable release tag when worker.enabled=true.", errors);
}

if (secretCreate) {
  assert(Boolean(databaseUrl) && !isPlaceholder(databaseUrl), "secretEnv.DATABASE_URL must be set to a non-placeholder production connection string when secret.create=true.", errors);
  assert(sessionSecret.length >= 32 && !isPlaceholder(sessionSecret), "secretEnv.SESSION_SECRET must be non-placeholder and at least 32 characters when secret.create=true.", errors);
  assert(Boolean(allowedOrigins) && !isPlaceholder(allowedOrigins) && /^https?:\/\//.test(allowedOrigins), "secretEnv.ALLOWED_ORIGINS must be set to a non-placeholder origin list when secret.create=true.", errors);
  assert(Boolean(redisUrl) && !isPlaceholder(redisUrl), "secretEnv.REDIS_URL must be set to a non-placeholder production Redis URL when secret.create=true.", errors);

  if (!allowPublicMetrics) {
    assert(metricsAuthToken.length >= 24 && !isPlaceholder(metricsAuthToken), "secretEnv.METRICS_AUTH_TOKEN must be non-placeholder and at least 24 characters unless env.ALLOW_PUBLIC_METRICS=true.", errors);
  }
} else {
  assert(Boolean(existingSecretName) && !isPlaceholder(existingSecretName), "secret.existingSecretName must be set to a non-placeholder Kubernetes Secret name when secret.create=false.", errors);
}

assert(getValue(mergedValues, "env.TRUST_PROXY") === "true", "env.TRUST_PROXY must be true in production values.", errors);
assert(getValue(mergedValues, "env.CSRF_STRICT_MODE") === "true", "env.CSRF_STRICT_MODE must be true in production values.", errors);
assert(getValue(mergedValues, "env.CSRF_ENFORCE_AUTH_ORIGIN") === "true", "env.CSRF_ENFORCE_AUTH_ORIGIN must be true in production values.", errors);
assert(getValue(mergedValues, "env.MALWARE_SCAN_MODE") === "required", "env.MALWARE_SCAN_MODE must be required in production values.", errors);
assert(getValue(mergedValues, "env.ENABLE_REDIS") === "true", "env.ENABLE_REDIS must be true in production values.", errors);

assert(getValue(mergedValues, "env.ALLOW_SELF_REGISTER") === "false", "env.ALLOW_SELF_REGISTER must be false in production values.", errors);

if (errors.length > 0) {
  console.error("Production values validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Production values validation passed.");