import { findMatches, reportAndExit } from "./_workspaceChecks.mjs";

const root = process.cwd();

const violations = findMatches(root, ["domains", "platform", "brain", "apps/api", "interfaces"], [
	{
		pattern: /from\s+["'][^"']*@server\/services\/(?:rag|document)[^"']*["']/g,
		message: "Legacy knowledge/document service imports are not allowed; use platform or domain-owned infrastructure paths.",
	},
	{
		pattern: /from\s+["'][^"']*server\/services\/(?:rag|document)\/[^"']*["']/g,
		message: "Legacy knowledge/document service imports are not allowed; use platform or domain-owned infrastructure paths.",
	},
	{
		pattern: /import\s*\(\s*["'][^"']*@server\/services\/(?:rag|document)[^"']*["']\s*\)/g,
		message: "Legacy knowledge/document service imports are not allowed; use platform or domain-owned infrastructure paths.",
	},
	{
		pattern: /import\s*\(\s*["'][^"']*server\/services\/(?:rag|document)\/[^"']*["']\s*\)/g,
		message: "Legacy knowledge/document service imports are not allowed; use platform or domain-owned infrastructure paths.",
	},
	{
		pattern: /from\s+["'][^"']*server\/services\/ai\/providers\/[^"']*["']/g,
		message: "Legacy AI provider paths are not allowed; use platform/ai/providers or surfaced platform aliases.",
	},
	{
		pattern: /import\s*\(\s*["'][^"']*server\/services\/ai\/providers\/[^"']*["']\s*\)/g,
		message: "Legacy AI provider paths are not allowed; use platform/ai/providers or surfaced platform aliases.",
	},
]);

reportAndExit("platform-ai-boundary", violations);