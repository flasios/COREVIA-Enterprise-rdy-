import { createPlaceholderRules, findMatches, reportAndExit } from "./_workspaceChecks.mjs";

reportAndExit("audit-demand-placeholders", findMatches(process.cwd(), ["domains/demand"], createPlaceholderRules("Demand domain")));