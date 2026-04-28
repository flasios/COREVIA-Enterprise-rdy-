import { createPlaceholderRules, findMatches, reportAndExit } from "./_workspaceChecks.mjs";

reportAndExit("audit-brain-placeholders", findMatches(process.cwd(), ["brain"], createPlaceholderRules("Brain")));