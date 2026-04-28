import { createPlaceholderRules, findMatches, reportAndExit } from "./_workspaceChecks.mjs";

reportAndExit("audit-tender-placeholders", findMatches(process.cwd(), ["domains/governance"], createPlaceholderRules("Tender/governance domain")));