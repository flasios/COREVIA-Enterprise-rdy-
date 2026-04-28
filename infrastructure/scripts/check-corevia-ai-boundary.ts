import { findMatches, reportAndExit } from "./_workspaceChecks.mjs";

const root = process.cwd();
const allowlistedTextFactories = new Set([
	"domains/ea/infrastructure/registrySupport.ts",
	"domains/intelligence/infrastructure/marketResearchService.ts",
	"domains/knowledge/infrastructure/agents/businessAgent.ts",
	"domains/knowledge/infrastructure/agents/financeAgent.ts",
	"domains/knowledge/infrastructure/agents/securityAgent.ts",
	"domains/knowledge/infrastructure/agents/technicalAgent.ts",
	"domains/knowledge/infrastructure/reranking.ts",
	"domains/knowledge/infrastructure/rag.ts",

]);

const violations = findMatches(root, ["domains", "brain", "apps/api", "platform", "interfaces"], [
	{
		pattern: /from\s+["'][^"']*@server\/services\/ai[^"']*["']/g,
		message: "Direct legacy AI service imports are not allowed; route through platform/brain/domain-owned adapters.",
	},
	{
		pattern: /from\s+["'][^"']*server\/services\/ai\/[^"']*["']/g,
		message: "Direct legacy AI service imports are not allowed; route through platform/brain/domain-owned adapters.",
	},
	{
		pattern: /import\s*\(\s*["'][^"']*@server\/services\/ai[^"']*["']\s*\)/g,
		message: "Direct legacy AI service imports are not allowed; route through platform/brain/domain-owned adapters.",
	},
	{
		pattern: /import\s*\(\s*["'][^"']*server\/services\/ai\/[^"']*["']\s*\)/g,
		message: "Direct legacy AI service imports are not allowed; route through platform/brain/domain-owned adapters.",
	},
	{
		pattern: /createAIService\(\s*["']text["']\s*\)/g,
		message: "Direct text-factory calls must stay on the explicit allowlist until the governed adapter migration is complete.",
		allow: (relativePath: string) => allowlistedTextFactories.has(relativePath),
	},
]);

reportAndExit("corevia-ai-boundary", violations);