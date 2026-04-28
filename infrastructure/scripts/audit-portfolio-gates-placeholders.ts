import { createPlaceholderRules, findMatches, reportAndExit } from "./_workspaceChecks.mjs";

reportAndExit("audit-portfolio-gates-placeholders", findMatches(process.cwd(), ["domains/portfolio"], createPlaceholderRules("Portfolio domain")));