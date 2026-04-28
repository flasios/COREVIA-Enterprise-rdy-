# COREVIA Service Ownership Migration Plan

## Objective

Move COREVIA from a module-fronted legacy service model to a genuinely module-owned architecture, while keeping a small, explicit set of shared platform services for cross-cutting technical concerns.

This document complements [docs/SOURCE_STRUCTURE_TARGET.md] and [docs/ENTERPRISE_ARCHITECTURE_GOVERNMENT.md].

## Target Standard

A service area is considered EA-aligned only when:

- the owning bounded context exposes the capability through its own module API/application/infrastructure layers;
- other modules depend on the owning module contract, not `platform/*` internals;
- only true platform concerns remain shared across domains.

## Accepted Shared Platform Services

These are the shared technical capabilities that remain intentionally shared after the runtime `platform/*` retirement. Shared ownership now lives under `platform/*` or an explicitly shared module.

| Service Area | Status | Notes |
| --- | --- | --- |
| `platform/audit/*` | Valid shared platform | Cross-cutting audit sink. |
| `platform/notifications/*` | Valid shared platform | Shared delivery and notification transport. |
| `platform/crypto/*` | Valid shared platform | Technical infrastructure and signing. |
| `platform/security/*` | Valid shared platform | Cross-cutting file and security enforcement. |
| `platform/tts/*` | Valid shared platform | Shared TTS/runtime adapters. |
| `platform/ai/providers/*` | Valid shared provider layer | Shared external model/provider adapters. |
| `platform/ai/factory.ts` | Valid shared provider composition | Shared AI composition entrypoint. |
| `platform/ai/cache.ts` | Valid shared platform | Shared AI caching. |
| `platform/ai/deepSeekReasoning.ts` | Valid shared platform | Shared reasoning runtime. |

## Transitional Legacy Domain Services

The runtime legacy service layer has been retired. Remaining gaps are structural polish and final internal ownership hardening rather than active business logic still running from `platform/*`.

| Service Area | Owning Module | Current State | Priority |
| --- | --- | --- | --- |
| Sanctioned direct text-generation internals | `intelligence` / `ea` / `knowledge` / `governance` | Brain governance is enforced, but a small number of internal direct text-generation callsites still exist behind approved boundaries | Medium |
| Current-state docs and guardrails | platform-wide | Code reality is ahead of some migration notes and enforcement documentation | Medium |

## Migration Phases

## Current Progress Snapshot

Completed in the first demand migration tranche:

- Demand analysis moved under `domains/demand/infrastructure/demandAnalysisService.ts`.
- Unified financial modeling moved under `domains/demand/infrastructure/financialModel.ts`.
- Version management moved under `domains/demand/infrastructure/versionManagement.ts`.
- Version impact analysis moved under `domains/demand/infrastructure/versionImpactAnalysis.ts`.
- Lightweight recommendation enrichment logic moved into the demand module.
- The legacy `platform/*` demand paths for this tranche have since been retired.

Demand module status after this tranche:

- The demand module no longer imports the targeted legacy business-service paths for demand analysis, financial modeling, version management, version impact analysis, or business-case enrichment.

Completed in the next governance tranche:

- Gate orchestration moved under `domains/governance/infrastructure/gateOrchestrator.ts`.
- Governance now owns the gate orchestration runtime.
- Portfolio consumes gate orchestration through governance ownership instead of the legacy service path.
- The old `server/services/gateOrchestrator.ts` path has since been retired.

Completed in the next knowledge document-processing tranche:

- OCR moved under `domains/knowledge/infrastructure/arabicOCR.ts`.
- Document processing moved under `domains/knowledge/infrastructure/documentProcessing.ts`.
- Knowledge and EA consumers now resolve document extraction through knowledge-owned implementations.
- The old `server/services/document/arabicOCR.ts` and `server/services/document/documentProcessor.ts` compatibility shims have since been retired.

Completed in the next knowledge document-export tranche:

- Document export moved under `domains/knowledge/infrastructure/documentExport.ts`.
- Document agent generation moved under `domains/knowledge/infrastructure/documentAgent.ts`.
- Demand now consumes export and agent generation through knowledge-owned implementations instead of legacy service paths.
- The old `server/services/document/documentExporter.ts` and `server/services/document/documentAgent.ts` compatibility shims have since been retired.

Completed in the next RAG primitives tranche:

- Chunking moved under `domains/knowledge/infrastructure/chunking.ts`.
- Embeddings moved under `domains/knowledge/infrastructure/embeddings.ts`.
- Knowledge adapters now resolve chunking and embeddings through knowledge-owned implementations instead of legacy RAG service paths.
- The old `server/services/rag/chunking.ts` and `server/services/rag/embeddings.ts` compatibility shims have since been retired.

Completed in the next RAG retrieval-core tranche:

- Core RAG retrieval moved under `domains/knowledge/infrastructure/rag.ts`.
- Query expansion, conversational memory, and reranking moved under knowledge-owned implementations.
- The knowledge RAG adapter now resolves retrieval through knowledge ownership instead of the legacy `server/services/rag` entrypoint.
- The old `server/services/rag/rag.ts`, `queryExpansion.ts`, `reranking.ts`, and `conversationalMemory.ts` compatibility shims have since been retired.

Completed in the next RAG integration and orchestration tranche:

- Stage-suggestion integration moved under `domains/knowledge/infrastructure/ragIntegrationService.ts`.
- Intelligence now resolves RAG agent execution and orchestration through knowledge-owned implementations.
- Agent registry, agents, utilities, cache, collaboration, and orchestration moved under `domains/knowledge/infrastructure/`.
- The remaining pure re-export compatibility files under `server/services/rag/**` have since been retired.

Completed in the next compliance tranche:

- The compliance engine moved under `domains/compliance/infrastructure/complianceEngineService.ts`.
- The compliance module now resolves its engine through module-owned implementation instead of the legacy service path.
- The old `server/services/compliance/complianceEngine.ts` path has since been retired.

Completed in the next integration tranche:

- Connector engine moved under `domains/integration/infrastructure/connectorEngine.ts`.
- Connector registry moved under `domains/integration/infrastructure/connectorRegistry.ts`.
- Connector templates moved under `domains/integration/infrastructure/connectorTemplates.ts`.
- Integration bootstrap and module adapters now resolve through module-owned implementations.
- The old `server/services/integration/Connector*.ts` paths have since been retired.

Completed in the next knowledge graph tranche:

- Graph builder moved under `domains/knowledge/infrastructure/graphBuilderService.ts`.
- The knowledge graph adapter now resolves through knowledge-owned implementation instead of the legacy service path.
- The old `server/services/knowledge/GraphBuilderService.ts` path has since been retired.

Completed in the next knowledge briefing tranche:

- Briefing moved under `domains/knowledge/infrastructure/briefing.ts`.
- The knowledge briefing adapter now resolves through knowledge-owned implementation instead of the legacy service path.
- The old `server/services/knowledge/BriefingService.ts` path has since been retired.

Completed in the next knowledge insight radar tranche:

- Insight radar moved under `domains/knowledge/infrastructure/insightRadarService.ts`.
- The knowledge insight radar adapter now resolves through knowledge-owned implementation instead of the legacy service path.
- The old `server/services/knowledge/InsightRadarService.ts` path has since been retired.

Completed in the next knowledge auto-classification tranche:

- Auto-classification moved under `domains/knowledge/infrastructure/autoClassificationService.ts`.
- The knowledge auto-classification adapter now resolves through knowledge-owned implementation instead of the legacy service path.
- The old `server/services/knowledge/AutoClassificationService.ts` path has since been retired.

Completed in the next knowledge automation tranche:

- Auto-categorization moved under `domains/knowledge/infrastructure/autoCategorizationService.ts`.
- Auto-tagging moved under `domains/knowledge/infrastructure/autoTaggingService.ts`.
- Duplicate detection moved under `domains/knowledge/infrastructure/duplicateDetectionService.ts`.
- The knowledge upload adapters now resolve these automation capabilities through module-owned implementations instead of legacy automation service paths.
- The old `server/services/automation/autoCategorizationService.ts`, `autoTaggingService.ts`, and `duplicateDetection.ts` paths have since been retired.

Completed in the next intelligence AI tranche:

- CoveriaIntelligence moved under `domains/intelligence/infrastructure/coveriaIntelligenceService.ts`.
- Market research moved under `domains/intelligence/infrastructure/marketResearchService.ts`.
- Intelligence adapters now resolve both capabilities through module-owned implementations instead of the legacy AI service paths.
- The old `server/services/ai/CoveriaIntelligence.ts` and `MarketResearchService.ts` paths have since been retired.

Completed in the next intelligence runtime tranche:

- Proactive intelligence moved under `domains/intelligence/infrastructure/proactiveIntelligenceService.ts`.
- Analytics moved under `domains/intelligence/infrastructure/analyticsService.ts`.
- Intelligence adapters now resolve both capabilities through module-owned implementations instead of the legacy intelligence service paths.
- The old `server/services/intelligence/proactiveIntelligence.ts` and `analytics.ts` paths have since been retired.
- The intelligence storage slice now explicitly includes knowledge document access for analytics-owned document-quality calculations.

Completed in the next intelligence draft tranche:

- Brain draft artifact generation moved under `domains/intelligence/infrastructure/brainDraftArtifactService.ts`.
- Intelligence adapters and proactive intelligence now resolve draft generation through the module-owned implementation instead of the legacy AI service path.
- The old `server/services/ai/brainDraftArtifact.ts` path has since been retired.

Completed in the next intelligence assistant tranche:

- The AI assistant runtime moved under `domains/intelligence/infrastructure/aiAssistantService.ts`.
- The intelligence assistant adapter now resolves the runtime through the module-owned implementation instead of the legacy AI service path.
- The old `server/services/ai/aiAssistant.ts` path has since been retired.
- Remaining `domains/intelligence/infrastructure/**` imports from `server/services/ai/*` are limited to shared AI provider/platform dependencies rather than intelligence domain-service ownership gaps.

Completed in the next demand automation tranche:

- Auto-indexing moved under `domains/demand/infrastructure/autoIndexingService.ts`.
- The demand auto-indexer now constructs the module-owned service directly instead of relying on a legacy singleton.
- `DemandStorageSlice` now explicitly includes knowledge storage because version-workflow submission can trigger knowledge indexing.
- The old `server/services/automation/autoIndexing.ts` path has since been retired.

Completed in the next portfolio collaboration tranche:

- Synergy detection moved under `domains/portfolio/infrastructure/synergyDetectorService.ts`.
- The portfolio synergy adapter now constructs the module-owned service with explicit demand-storage access instead of depending on the legacy intelligence singleton.
- Portfolio route registration now passes storage into synergy dependency wiring so the module owns the runtime construction path.
- The old `server/services/intelligence/synergyDetector.ts` path has since been retired.

Completed in the next knowledge quality tranche:

- Quality scoring moved under `domains/knowledge/infrastructure/qualityScoringService.ts`.
- The knowledge quality-scoring adapter now resolves the module-owned implementation directly instead of requiring the legacy intelligence service path.
- The old `server/services/intelligence/qualityScoring.ts` path has since been retired.

Completed in the next portfolio reporting tranche:

- Reporting export moved under `domains/portfolio/infrastructure/reportingExportService.ts`.
- The portfolio reporting adapter now resolves the module-owned implementation directly instead of depending on the legacy reporting service path.
- The old `server/services/reporting/reportingExportService.ts` path has since been retired.

Completed in the next governance tender tranche:

- Tender generation moved under `domains/governance/infrastructure/tenderGeneratorService.ts`.
- The governance tender adapter now resolves the module-owned implementation directly instead of lazily importing the legacy content-generation service path.
- The old `server/services/content-generation/tenderGenerator.ts` path has since been retired.

Completed in the next platform normalization tranche:

- Decision orchestration moved under `platform/decision/decisionOrchestrator.ts` as a shared platform gateway over core orchestration, rather than remaining under the legacy services path.
- Module adapters in demand and knowledge now resolve decision intake through `platform/*` instead of `server/services/decision/*`.
- File-security access is now normalized through `platform/security/fileSecurity.ts` and the `platform/security` barrel for portfolio, knowledge, and governance adapters.
- Notification access is now normalized through `platform/notifications/index.ts` for workflow notifications, email sending, and superadmin lookup across demand, portfolio, and intelligence modules.

Completed in the next portfolio WBS and staffing tranche:

- WBS generation helpers moved under `domains/portfolio/infrastructure/` (`wbsGeneratorService.ts`, `wbsBrainArtifactService.ts`, `wbsParallelGeneratorService.ts`).
- Portfolio adapters for critical-path analysis, WBS artifact normalization, and generation-progress tracking now resolve module-owned implementations instead of legacy content-generation service paths.
- Team recommendation generation moved under `domains/portfolio/infrastructure/teamRecommendationService.ts`.
- Portfolio and governance brain-draft adapters now resolve the intelligence module-owned brain-draft artifact runtime instead of the legacy AI service path.
- The old `server/services/content-generation/wbsGenerator.ts`, `wbsBrainArtifactAdapter.ts`, `wbsParallelGenerator.ts`, and `server/services/infrastructure/teamDesignService.ts` paths have since been retired.

Completed in the next notifications ownership tranche:

- Notification orchestration moved under `domains/notifications/infrastructure/notificationOrchestratorService.ts`.
- WhatsApp delivery moved under `domains/notifications/infrastructure/whatsAppService.ts`.
- Notifications infrastructure adapters now resolve module-owned implementations instead of legacy notification service paths.
- The old `server/services/notifications/NotificationOrchestrator.ts` and `WhatsAppService.ts` paths have since been retired.

Completed in the next platform audit and crypto tranche:

- Shared audit logging is now normalized through `platform/audit/index.ts`.
- Shared crypto service construction is now normalized through `platform/crypto/index.ts`.
- Identity, demand, knowledge, intelligence, and compliance module adapters now depend on platform audit/crypto paths rather than legacy infrastructure service imports.

Completed in the next platform shared-service inlining tranche:

- Shared audit logging now lives directly under `platform/audit/index.ts`; the legacy `server/services/infrastructure/auditLogger.ts` source has been retired.
- Shared file-security enforcement now lives directly under `platform/security/fileSecurity.ts`; the legacy `server/services/security/fileSecurity.ts` source has been retired.
- Shared email notification helpers and workflow notification transport now live directly under `platform/notifications/index.ts`; the legacy `server/services/infrastructure/notificationService.ts` source has been retired.
- Shared Outlook/Office365 SMTP delivery now lives directly under `platform/notifications/outlookEmailService.ts`; the legacy `server/services/infrastructure/outlookEmailService.ts` source has been retired.
- Shared AI caching now lives directly under `platform/ai/cache.ts`; the legacy `server/services/ai/aiCache.ts` source has been retired.

Completed in the next platform AI and TTS facade tranche:

- Shared AI factory access is now normalized through `platform/ai/factory.ts`.
- Shared AI cache and DeepSeek reasoning are now normalized through `platform/ai/cache.ts` and `platform/ai/deepSeekReasoning.ts`.
- Shared AI provider adapters are now normalized through `platform/ai/providers/*`.
- Shared TTS access is now normalized through `platform/tts/*`.
- No `domains/**` files now import legacy `server/services/ai/*` or `server/services/tts/*` paths directly.

Completed in the next compatibility-shim retirement tranche:

- Bootstrap notification initialization and event-bus orchestration now resolve through `domains/notifications/infrastructure/*` instead of legacy notification shim paths.
- Vendor proposal processing now resolves document extraction through `domains/knowledge/infrastructure/documentProcessing.ts` and AI draft generation through `platform/ai`.
- Corevia internal intelligence and the RAG gateway now resolve retrieval through `domains/knowledge/infrastructure/rag.ts` instead of legacy `server/services/rag/*` entrypoints.
- Corevia hybrid intelligence now resolves OpenAI provider access through `platform/ai/providers/openai.ts`.
- Corevia policy routes now resolve file-security enforcement through `platform/security/fileSecurity.ts`.
- Feedback-learning bootstrap now resolves through `domains/demand/infrastructure/feedbackLearning.ts` instead of the legacy business-case generator path.

Completed in the next platform AI ownership tranche:

- The real OpenAI provider implementation now lives under `platform/ai/providers/openai.ts`; the old `server/services/ai/providers/openai.ts` source has been retired.
- The real Anthropic and Falcon provider implementations now live under `platform/ai/providers/anthropic.ts` and `platform/ai/providers/falcon.ts`; the temporary legacy service shims for those providers have since been retired.
- The shared AI factory implementation now lives under `platform/ai/factory.ts`; the temporary `server/services/ai/factory.ts` shim has since been retired.
- The shared AI interface contract now lives under `platform/ai/interface.ts`, and the local embeddings adapter now lives under `platform/ai/providers/localEmbeddings.ts`; the temporary legacy shims for both have since been retired.
- The platform brain-draft export now points directly to `domains/intelligence/infrastructure/brainDraftArtifactService.ts` rather than routing back through a legacy AI service path.

Completed in the next Brain-governed AI entrypoint tranche:

- Market research generation now requires Decision Brain intake approval before any external text-generation call, while still using the direct structured-LLM path for latency after governance approval.
- EA external advisory generation now requires Decision Brain intake approval before it calls external provider adapters.
- EA registry structured-entry extraction now requires Decision Brain intake approval before any text-generation call and enforces that approval at the extraction helper boundary.
- Tender generation now requires Decision Brain intake approval before the governance module invokes Falcon-backed tender drafting.
- `domains/intelligence/infrastructure/marketResearchService.ts` now rejects unguided calls unless Brain governance approval metadata is present.
- `domains/ea/infrastructure/registrySupport.ts` now rejects unguided EA structured extraction unless Brain governance approval metadata is present.
- `infrastructure/scripts/check-platform-ai-boundary.ts` now enforces the current platform-owned provider boundary and flags new unsanctioned direct text-factory calls.

Completed in the next AI compatibility-retirement tranche:

- Unused legacy AI compatibility files under `server/services/ai/` have been retired, including the old AI assistant, CoveriaIntelligence, market research, brain-draft, factory, interface, and provider shim paths.

Completed in the next non-AI compatibility-retirement tranche:

- Unused legacy compatibility shims for tender generation, reporting export, notification orchestration, WhatsApp delivery, gate orchestration, and decision orchestration have been retired from `platform/*`.
- Unused legacy compatibility shims for knowledge document processing/export and the pure re-export RAG stack have been retired from `server/services/document/*` and `server/services/rag/**`.
- Unused legacy compatibility shims for knowledge automation, auto-classification/briefing/insight-radar, portfolio synergy, and the legacy Brain-only business-case wrapper have been retired.
- Shared crypto implementation now lives directly under `platform/crypto/index.ts`; the old `server/services/infrastructure/cryptoService.ts` source has been retired.
- Historical tests formerly parked under `server/services/__tests__/` have been re-homed under their owning platform/module folders.

Next highest-priority migrations:

- reduce the remaining sanctioned direct `createAIService("text")` callers behind narrower governed adapters so Brain control is structurally explicit inside module internals

### Phase 1 — Guardrails

Goal: stop new debt.

- Keep API layer blocked from direct `platform/*` imports.
- Warn on infrastructure imports from legacy domain service paths.
- Require new domain capabilities to be introduced inside the owning module first.

### Phase 2 — High-Value Business Core

Goal: migrate the most business-critical domain logic first.

1. Move demand analysis into `domains/demand/infrastructure` with demand-owned types and ports.
2. Move version management/version analysis into the demand module.
3. Move unified financial modeling and business-case enrichment into the demand module.
4. Move gate orchestration into governance/portfolio ownership with explicit ports.

### Phase 3 — Knowledge And Document Core

Goal: consolidate document and RAG capabilities under the right ownership.

1. Split platform file-security concerns from domain document processing.
2. Move remaining document export/agent logic behind knowledge-owned contracts.
3. Complete RAG orchestration, chunking, embeddings, retrieval, integration, and agent coordination under knowledge/intelligence ownership.

### Phase 4 — Domain Completion

Goal: eliminate remaining legacy domain service folders.

1. Move compliance engine into the compliance module.
2. Move connector registry/engine/templates into the integration module.
3. Move remaining knowledge automation services into the knowledge module.
4. Re-home higher-level AI/domain orchestration services under the owning modules or convert them into clearly named platform jobs.

### Phase 5 — Platform Normalization

Goal: leave only true platform concerns in shared service locations.

1. Rename or relocate shared technical services from `server/services/infrastructure` to `platform/*` where appropriate.
2. Keep only transport, provider, security, crypto, audit, and similar cross-cutting capabilities shared.
3. Remove or archive empty legacy service folders once module ownership is complete.
4. Prefer platform wrappers first when the underlying shared implementation is still intentionally reused outside modules.

## Definition Of Done

A service area is done when:

- no module imports its business logic from legacy `server/services/<domain>` paths;
- the owning module has ports, adapters, and tests for the capability;
- cross-module access goes through the owning module contract or an approved platform port;
- ESLint guardrails can be tightened from warning to error for that service area.

## Immediate Recommended Execution Order

1. `demandAnalysis`
2. `UnifiedFinancialModel`
3. `versionManagement` / `versionAnalyzer`
4. `businessCaseGenerator`
5. `gateOrchestrator`
6. `document/*`
7. `rag/*`

This order removes the highest concentration of business logic from the legacy shared service layer first.