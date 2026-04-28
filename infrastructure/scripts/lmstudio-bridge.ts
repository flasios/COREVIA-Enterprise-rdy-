const DEFAULT_BRIDGE_PORT = "1235";
const DEFAULT_UPSTREAM_URL = "http://127.0.0.1:1234/v1";

process.env.PORT ||= DEFAULT_BRIDGE_PORT;
process.env.HOST ||= "127.0.0.1";
process.env.LOCAL_LLM_PROVIDER ||= "openai-compatible";
process.env.LOCAL_LLM_BASE_URL ||= DEFAULT_UPSTREAM_URL;
process.env.LOCAL_LLM_DEFAULT_MODEL ||= process.env.COREVIA_ENGINE_A_FAST_MODEL || process.env.COREVIA_ENGINE_A_MODEL || "qwen2.5:7b";

console.log(`[lmstudio-bridge] Starting Engine A bridge on http://${process.env.HOST}:${process.env.PORT}`);
console.log(`[lmstudio-bridge] Upstream LM Studio endpoint: ${process.env.LOCAL_LLM_BASE_URL}`);

async function main(): Promise<void> {
	await import("../../apps/ai-service/index.ts");
}

void main();