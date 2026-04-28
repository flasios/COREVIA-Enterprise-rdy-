# Schema Ownership Manifest

> **Rule**: Only the owning module may _write_ to its tables.  
> Other modules may _read_ via their storage port interface but must never insert/update/delete.

| Schema File       | Owner Module     | Tables (key)                                   |
|-------------------|------------------|-------------------------------------------------|
| `platform.ts`     | `identity`       | users, sessions                                |
| `demand.ts`       | `demand`         | demandReports, demandReportSections, businessCases, demandConversionRequests, … |
| `portfolio.ts`    | `portfolio`      | portfolioProjects, wbsTasks, milestones, changeRequests, … |
| `governance.ts`   | `governance`     | gateCheckCatalog, projectPhaseGates, gateCheckResults, vendorParticipants, … |
| `intelligence.ts` | `intelligence`   | synergyOpportunities, innovationRecommendations, portfolioRuns, tenderPackages, aiConversations, … |
| `corevia.ts`      | `intelligence`   | coveriaLearningEvents, coveriaPersonality, coveriaInsights |
| `learning.ts`     | `intelligence`   | learningPatterns, intelligencePlans, policyPacks |
| `compliance.ts`   | `compliance`     | complianceRules, complianceRuns, complianceResults, orchestrationRuns |
| `knowledge.ts`    | `knowledge`      | knowledgeDocuments, knowledgeChunks, knowledgeEntities, … |
| `operations.ts`   | `operations`     | costEntries, procurementItems, procurementPayments |
| `performance.ts`  | `operations`     | notifications, systemSettings, auditLogs, announcements |
| `ea-registry.ts`  | `ea`             | eaApplications, eaTechnologyStandards, eaIntegrations, … |

## Cross-Domain References (Logical IDs only — no FK constraints)

| Source Module  | Column                       | Target Module | Target Table         |
|----------------|------------------------------|---------------|----------------------|
| intelligence   | synergyOpportunities.primaryDemandId | demand  | demandReports        |
| intelligence   | innovationRecommendations.demandReportId | demand | demandReports    |
| intelligence   | portfolioRecommendations.demandReportId | demand | demandReports    |
| intelligence   | tenderPackages.businessCaseId | demand       | businessCases        |
| intelligence   | agentFeedback.reportId        | demand       | demandReports        |
| intelligence   | agentFeedback.businessCaseId  | demand       | businessCases        |
| operations     | costEntries.projectId         | portfolio    | portfolioProjects    |
| operations     | procurementItems.projectId    | portfolio    | portfolioProjects    |
| operations     | procurementPayments.projectId | portfolio    | portfolioProjects    |
| compliance     | complianceRuns.reportId       | demand       | demandReports        |
| compliance     | orchestrationRuns.reportId    | demand       | demandReports        |
| governance     | projectPhaseGates.projectId   | portfolio    | portfolioProjects    |
| portfolio      | portfolioProjects.demandReportId | demand    | demandReports        |
| demand         | demandConversionRequests.createdProjectId | portfolio | portfolioProjects |

## Migration Path

When splitting into microservices:
1. Each module gets its own database/schema namespace
2. Cross-domain ID columns become opaque UUIDs validated via API calls
3. Event bus replaces cascading deletes (use `demand.DemandDeleted` → compliance cleans up)
4. Read models for cross-module queries use event-sourced projections
