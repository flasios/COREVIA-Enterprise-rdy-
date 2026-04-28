/**
 * EA Registry CRUD Routes — structured baseline for applications,
 * capabilities, data domains, technology standards and integrations.
 *
 * Enhanced with:
 * - Provenance tracking (demand-ingested vs manual)
 * - Verification workflow (pending_verification → verified / rejected)
 * - Per-sub-service document uploads with templates
 * - Demand auto-ingest from approved reports
 * - AI-powered document upload & extract (upload document → extract structured data)
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { buildEaRegistryDeps, type EaStorageSlice } from "../application";
import { createAuthMiddleware } from "@interfaces/middleware/auth";
import { uploadLimiter } from "@interfaces/middleware/rateLimiter";
import { logger } from "@platform/logging/Logger";
import { decisionOrchestrator } from "@platform/decision/decisionOrchestrator";
import { createManagedFileHandle, readManagedUtf8File } from "@platform/storage/managedFiles";
import type { Permission, Role, CustomPermissions } from "@shared/permissions";
import { userHasAllEffectivePermissions } from "@shared/permissions";
import {
  insertEaApplicationSchema,
  updateEaApplicationSchema,
  insertEaCapabilitySchema,
  updateEaCapabilitySchema,
  insertEaDataDomainSchema,
  updateEaDataDomainSchema,
  insertEaTechnologyStandardSchema,
  updateEaTechnologyStandardSchema,
  insertEaIntegrationSchema,
  updateEaIntegrationSchema,
} from "@shared/schema";

/**
 * Check if user has the given permission.
 * Uses role-based permission resolution (same as requirePermission middleware).
 */
function hasPermission(req: Request, permission: Permission): boolean {
  const role = req.session?.role as Role | undefined;
  if (!role) return false;
  // super_admin bypasses all permission checks
  if ((role as string) === "super_admin") return true;
  const customPermissions = (req as unknown as Record<string, unknown>).auth
    ? ((req as unknown as Record<string, unknown>).auth as { customPermissions?: CustomPermissions }).customPermissions
    : undefined;
  return userHasAllEffectivePermissions(role, [permission], customPermissions);
}

function safeReadManagedUtf8FileFromRoot(rootDir: string, fileName: string): string {
  return readManagedUtf8File(
    createManagedFileHandle(rootDir, fileName, [path.resolve(os.tmpdir()), path.resolve(process.cwd(), "uploads")]),
  );
}

function crudRoutes<T>(
  router: Router,
  basePath: string,
  insertSchema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown } },
  updateSchema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown } },
  fns: {
    getAll: () => Promise<T[]>;
    getOne: (id: string) => Promise<T | undefined>;
    create: (data: unknown) => Promise<T>;
    update: (id: string, data: unknown) => Promise<T | undefined>;
    remove: (id: string) => Promise<boolean>;
  },
  label: string
) {
  // LIST — requires ea:registry:read — supports ?limit=N&offset=M pagination
  router.get(basePath, async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:read")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions: ea:registry:read required" });
    }
    try {
      const items = await fns.getAll();
      const total = items.length;

      // Optional pagination
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 500) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      if (limit !== undefined) {
        const paginated = items.slice(offset, offset + limit);
        return res.json({
          success: true,
          data: paginated,
          pagination: { total, limit, offset, hasMore: offset + limit < total },
        });
      }

      return res.json({ success: true, data: items, pagination: { total } });
    } catch (err) {
      logger.error(`[EA Registry] List ${label} failed:`, err);
      return res.status(500).json({ success: false, error: `Failed to list ${label}` });
    }
  });

  // GET ONE — requires ea:registry:read
  router.get(`${basePath}/:id`, async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:read")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions: ea:registry:read required" });
    }
    try {
      const item = await fns.getOne(req.params.id as string);
      if (!item) return res.status(404).json({ success: false, error: `${label} not found` });
      return res.json({ success: true, data: item });
    } catch (err) {
      logger.error(`[EA Registry] Get ${label} failed:`, err);
      return res.status(500).json({ success: false, error: `Failed to get ${label}` });
    }
  });

  // CREATE — requires ea:registry:write
  router.post(basePath, async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions: ea:registry:write required" });
    }
    try {
      const parsed = insertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Validation failed", details: (parsed as { error: unknown }).error });
      }
      const item = await fns.create(parsed.data as unknown);
      return res.status(201).json({ success: true, data: item });
    } catch (err) {
      logger.error(`[EA Registry] Create ${label} failed:`, err);
      return res.status(500).json({ success: false, error: `Failed to create ${label}` });
    }
  });

  // UPDATE — requires ea:registry:write
  router.patch(`${basePath}/:id`, async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions: ea:registry:write required" });
    }
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Validation failed", details: (parsed as { error: unknown }).error });
      }
      const item = await fns.update(req.params.id as string, parsed.data as unknown);
      if (!item) return res.status(404).json({ success: false, error: `${label} not found` });
      return res.json({ success: true, data: item });
    } catch (err) {
      logger.error(`[EA Registry] Update ${label} failed:`, err);
      return res.status(500).json({ success: false, error: `Failed to update ${label}` });
    }
  });

  // DELETE — requires ea:registry:admin
  router.delete(`${basePath}/:id`, async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:admin")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions: ea:registry:admin required" });
    }
    try {
      const deleted = await fns.remove(req.params.id as string);
      if (!deleted) return res.status(404).json({ success: false, error: `${label} not found` });
      return res.json({ success: true });
    } catch (err) {
      logger.error(`[EA Registry] Delete ${label} failed:`, err);
      return res.status(500).json({ success: false, error: `Failed to delete ${label}` });
    }
  });
}

export function createEaRegistryRoutes(storage: EaStorageSlice): Router {
  const router = Router();
  const auth = createAuthMiddleware(storage);
  const deps = buildEaRegistryDeps();

  // All registry routes require auth
  router.use(auth.requireAuth);

  // Applications CRUD — /api/ea/registry/applications
  crudRoutes(router, "/applications", insertEaApplicationSchema, updateEaApplicationSchema, {
    getAll: () => storage.getAllEaApplications(),
    getOne: (id) => storage.getEaApplication(id),
    create: (data) => storage.createEaApplication(data as Parameters<typeof storage.createEaApplication>[0]),
    update: (id, data) => storage.updateEaApplication(id, data as Parameters<typeof storage.updateEaApplication>[1]),
    remove: (id) => storage.deleteEaApplication(id),
  }, "application");

  // Capabilities CRUD — /api/ea/registry/capabilities
  crudRoutes(router, "/capabilities", insertEaCapabilitySchema, updateEaCapabilitySchema, {
    getAll: () => storage.getAllEaCapabilities(),
    getOne: (id) => storage.getEaCapability(id),
    create: (data) => storage.createEaCapability(data as Parameters<typeof storage.createEaCapability>[0]),
    update: (id, data) => storage.updateEaCapability(id, data as Parameters<typeof storage.updateEaCapability>[1]),
    remove: (id) => storage.deleteEaCapability(id),
  }, "capability");

  // Data Domains CRUD — /api/ea/registry/data-domains
  crudRoutes(router, "/data-domains", insertEaDataDomainSchema, updateEaDataDomainSchema, {
    getAll: () => storage.getAllEaDataDomains(),
    getOne: (id) => storage.getEaDataDomain(id),
    create: (data) => storage.createEaDataDomain(data as Parameters<typeof storage.createEaDataDomain>[0]),
    update: (id, data) => storage.updateEaDataDomain(id, data as Parameters<typeof storage.updateEaDataDomain>[1]),
    remove: (id) => storage.deleteEaDataDomain(id),
  }, "data domain");

  // Technology Standards CRUD — /api/ea/registry/technology-standards
  crudRoutes(router, "/technology-standards", insertEaTechnologyStandardSchema, updateEaTechnologyStandardSchema, {
    getAll: () => storage.getAllEaTechnologyStandards(),
    getOne: (id) => storage.getEaTechnologyStandard(id),
    create: (data) => storage.createEaTechnologyStandard(data as Parameters<typeof storage.createEaTechnologyStandard>[0]),
    update: (id, data) => storage.updateEaTechnologyStandard(id, data as Parameters<typeof storage.updateEaTechnologyStandard>[1]),
    remove: (id) => storage.deleteEaTechnologyStandard(id),
  }, "technology standard");

  // Integrations CRUD — /api/ea/registry/integrations
  crudRoutes(router, "/integrations", insertEaIntegrationSchema, updateEaIntegrationSchema, {
    getAll: () => storage.getAllEaIntegrations(),
    getOne: (id) => storage.getEaIntegration(id),
    create: (data) => storage.createEaIntegration(data as Parameters<typeof storage.createEaIntegration>[0]),
    update: (id, data) => storage.updateEaIntegration(id, data as Parameters<typeof storage.updateEaIntegration>[1]),
    remove: (id) => storage.deleteEaIntegration(id),
  }, "integration");

  // Baseline summary — /api/ea/registry/baseline
  router.get("/baseline", async (req, res) => {
    if (!hasPermission(req, "ea:registry:read")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const [apps, caps, domains, tech, integrations, docs] = await Promise.all([
        storage.getAllEaApplications(),
        storage.getAllEaCapabilities(),
        storage.getAllEaDataDomains(),
        storage.getAllEaTechnologyStandards(),
        storage.getAllEaIntegrations(),
        deps.documents.listAll(),
      ]);

      // Compute provenance + verification stats
      const allEntries = [...apps, ...caps, ...domains, ...tech, ...integrations] as Array<{
        sourceType?: string; verificationStatus?: string;
      }>;
      const pendingVerification = allEntries.filter(e => e.verificationStatus === "pending_verification").length;
      const demandIngested = allEntries.filter(e => e.sourceType === "demand_ingested").length;

      return res.json({
        success: true,
        data: {
          summary: {
            applications: apps.length,
            capabilities: caps.length,
            dataDomains: domains.length,
            technologyStandards: tech.length,
            integrations: integrations.length,
            documents: docs.length,
            pendingVerification,
            demandIngested,
            total: allEntries.length,
          },
          applications: apps,
          capabilities: caps,
          dataDomains: domains,
          technologyStandards: tech,
          integrations,
        },
      });
    } catch (err) {
      logger.error("[EA Registry] Baseline failed:", err);
      return res.status(500).json({ success: false, error: "Failed to load baseline" });
    }
  });

  // ── Document Upload ─────────────────────────────────────────────────
  const uploadDir = path.join(os.tmpdir(), "ea-documents");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const eaUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${unique}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });

  /** Document templates per sub-service */
  router.get("/documents/templates", async (_req, res) => {
    res.json({
      success: true,
      templates: {
        applications: [
          { id: "app_architecture_diagram", name: "Application Architecture Diagram", description: "System architecture and deployment diagrams (Visio/Draw.io/PNG)", accepts: ".vsdx,.drawio,.png,.pdf" },
          { id: "app_data_flow", name: "Data Flow Diagram", description: "Data flow between application components", accepts: ".vsdx,.drawio,.png,.pdf" },
          { id: "app_security_assessment", name: "Security Assessment Report", description: "Application security posture and vulnerability assessment", accepts: ".pdf,.docx" },
          { id: "app_disaster_recovery", name: "Disaster Recovery Plan", description: "DR procedures and RTO/RPO documentation", accepts: ".pdf,.docx" },
          { id: "app_vendor_contract", name: "Vendor Contract / SLA", description: "Vendor agreement, SLA terms, and support coverage", accepts: ".pdf,.docx" },
          { id: "app_user_manual", name: "User Manual / Documentation", description: "End-user or technical documentation", accepts: ".pdf,.docx,.md" },
        ],
        capabilities: [
          { id: "cap_value_stream_map", name: "Value Stream Map", description: "End-to-end value stream visualization", accepts: ".vsdx,.drawio,.png,.pdf" },
          { id: "cap_maturity_assessment", name: "Capability Maturity Assessment", description: "CMMI or custom maturity level assessment report", accepts: ".pdf,.docx,.xlsx" },
          { id: "cap_gap_analysis", name: "Gap Analysis Report", description: "Current vs target capability gap assessment", accepts: ".pdf,.docx,.xlsx" },
          { id: "cap_business_process", name: "Business Process Model", description: "BPMN or process flow documentation", accepts: ".bpmn,.vsdx,.drawio,.pdf" },
        ],
        data_domains: [
          { id: "dd_data_dictionary", name: "Data Dictionary", description: "Complete data dictionary with field definitions and types", accepts: ".xlsx,.csv,.pdf" },
          { id: "dd_data_lineage", name: "Data Lineage Diagram", description: "Data flow and transformation lineage visualization", accepts: ".vsdx,.drawio,.png,.pdf" },
          { id: "dd_pia", name: "Privacy Impact Assessment (PIA)", description: "UAE PDPL-compliant privacy impact assessment", accepts: ".pdf,.docx" },
          { id: "dd_data_quality", name: "Data Quality Report", description: "Data profiling and quality metrics report", accepts: ".pdf,.xlsx" },
          { id: "dd_retention_policy", name: "Data Retention Policy", description: "Retention schedule and archival procedures", accepts: ".pdf,.docx" },
        ],
        technology_standards: [
          { id: "ts_standard_spec", name: "Standard Specification", description: "Detailed technical standard specification document", accepts: ".pdf,.docx" },
          { id: "ts_compliance_matrix", name: "Compliance Matrix", description: "Standards compliance checklist and evidence", accepts: ".xlsx,.pdf" },
          { id: "ts_migration_plan", name: "Migration / Transition Plan", description: "Technology migration roadmap and execution plan", accepts: ".pdf,.docx,.xlsx" },
          { id: "ts_benchmark", name: "Performance Benchmark", description: "Technology performance benchmarks and test results", accepts: ".pdf,.xlsx" },
        ],
        integrations: [
          { id: "int_api_spec", name: "API Specification (OpenAPI/Swagger)", description: "Interface contract and API documentation", accepts: ".yaml,.json,.pdf" },
          { id: "int_sequence_diagram", name: "Sequence Diagram", description: "Integration message flow and sequence diagrams", accepts: ".vsdx,.drawio,.png,.pdf" },
          { id: "int_error_handling", name: "Error Handling Specification", description: "Error codes, retry policies, and circuit breaker design", accepts: ".pdf,.docx" },
          { id: "int_test_report", name: "Integration Test Report", description: "Integration test results and coverage report", accepts: ".pdf,.xlsx" },
        ],
      },
    });
  });

  /** List documents for a registry type (optionally filtered by entry) */
  router.get("/documents/:registryType", async (req, res) => {
    if (!hasPermission(req, "ea:registry:read")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const { registryType } = req.params;
      const entryId = req.query.entryId as string | undefined;
      const docs = await deps.documents.listByEntry(registryType as string, entryId);
      return res.json({ success: true, data: docs, total: docs.length });
    } catch (err) {
      logger.error("[EA Registry] List documents failed:", err);
      return res.status(500).json({ success: false, error: "Failed to list documents" });
    }
  });

  /** Upload document for a registry sub-service */
  router.post("/documents/:registryType/upload", uploadLimiter, eaUpload.single("file"), async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: "No file provided" });

      const { registryType } = req.params;
      const { entryId, templateType, category, description } = req.body;
      const userId = ((req as unknown as Record<string, unknown>).user as { id?: string })?.id;

      const doc = await deps.documents.create({
        registryType: registryType as string,
        registryEntryId: entryId || null,
        templateType: templateType || null,
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        category: category || "other",
        description: description || null,
        uploadedBy: userId || null,
        sourceDemandId: null,
        extractedData: null,
      });

      return res.status(201).json({ success: true, data: doc });
    } catch (err) {
      logger.error("[EA Registry] Upload document failed:", err);
      return res.status(500).json({ success: false, error: "Failed to upload document" });
    }
  });

  /** Delete a document */
  router.delete("/documents/remove/:id", async (req, res) => {
    if (!hasPermission(req, "ea:registry:admin")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const deleted = await deps.documents.remove(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, error: "Document not found" });
      return res.json({ success: true });
    } catch (err) {
      logger.error("[EA Registry] Delete document failed:", err);
      return res.status(500).json({ success: false, error: "Failed to delete document" });
    }
  });

  // ── Document Upload & Extract (AI-powered) ─────────────────────────
  /**
   * POST /api/ea/registry/documents/:registryType/upload-extract
   * 1. Uploads the document (PDF, DOCX, XLSX, etc.)
   * 2. Extracts text using documentProcessorService
   * 3. Sends text to AI with a service-specific prompt
   * 4. Returns structured data matching the registry schema
   * The user reviews and confirms to create registry entries.
   */
  const EA_EXTRACTION_TEMPLATES: Record<string, { fields: string; example: string }> = {
    applications: {
      fields: `Extract an array of application entries. For each application extract:
- name (string, required): Application/system name
- vendor (string): Software vendor or provider
- version (string): Current version number
- description (string): What the application does
- criticality (string: "critical"|"high"|"medium"|"low"): Business criticality
- lifecycle (string: "active"|"planned"|"sunset"|"retired"): Current lifecycle stage
- hosting (string): Hosting model (on-premise, cloud, hybrid, SaaS)
- department (string): Owning department/division
- owner (string): Application owner name/role
- tier (string: "tier1"|"tier2"|"tier3"): Application tier
- userCount (number): Approximate number of users
- annualCost (number): Annual cost in USD
- contractExpiry (string): Contract expiry date (YYYY-MM-DD)
- dataClassification (string): Data sensitivity level (public, internal, confidential, restricted)
- disasterRecovery (string): DR classification (active-active, active-passive, cold-standby, none)`,
      example: `[{"name":"SAP S/4HANA","vendor":"SAP","version":"2023","description":"Enterprise ERP system","criticality":"critical","lifecycle":"active","hosting":"cloud","department":"Finance","owner":"CFO Office","tier":"tier1","userCount":5000,"annualCost":2000000,"dataClassification":"confidential","disasterRecovery":"active-active"}]`,
    },
    capabilities: {
      fields: `Extract an array of business capability entries. For each capability extract:
- name (string, required): Capability name
- level (number): Capability hierarchy level (1=L0, 2=L1, etc.)
- domain (string): Business domain (e.g., Finance, HR, Operations)
- owner (string): Capability owner
- maturity (string): Current maturity level (initial, managed, defined, quantitatively_managed, optimizing)
- strategicImportance (string: "critical"|"high"|"medium"|"low"): Strategic importance
- description (string): What this capability enables
- supportingApplications (string[]): List of application names that support this capability`,
      example: `[{"name":"Financial Reporting","level":2,"domain":"Finance","owner":"CFO","maturity":"defined","strategicImportance":"critical","description":"Ability to generate financial statements and reports","supportingApplications":["SAP S/4HANA","Power BI"]}]`,
    },
    "data-domains": {
      fields: `Extract an array of data domain entries. For each data domain extract:
- name (string, required): Data domain name
- classification (string: "public"|"internal"|"confidential"|"restricted"|"top_secret"): Data classification
- owner (string): Data domain owner
- steward (string): Data steward responsible for quality
- description (string): What data this domain encompasses
- piiFlag (boolean): Contains personally identifiable information
- crossBorderRestriction (boolean): Has cross-border data transfer restrictions
- retentionPeriod (string): Data retention period (e.g., "7 years", "indefinite")
- storageLocation (string): Where data is stored (e.g., UAE, GCC, Global)
- qualityScore (number 0-100): Data quality score if mentioned
- sourceSystem (string): Primary source system
- regulatoryFramework (string): Governing regulation (e.g., UAE PDPL, GDPR)`,
      example: `[{"name":"Customer Data","classification":"confidential","owner":"CDO","steward":"Data Quality Team","description":"All customer-related data including profiles and transactions","piiFlag":true,"crossBorderRestriction":true,"retentionPeriod":"7 years","storageLocation":"UAE","qualityScore":85,"sourceSystem":"CRM","regulatoryFramework":"UAE PDPL"}]`,
    },
    "technology-standards": {
      fields: `Extract an array of technology standard entries. For each standard extract:
- name (string, required): Technology or standard name
- layer (string, required: "infrastructure"|"platform"|"application"|"data"|"security"|"integration"): Architecture layer
- category (string): Category within the layer (e.g., "Database", "API Gateway", "Container Platform")
- vendor (string): Technology vendor
- version (string): Current version
- status (string: "approved"|"under_review"|"deprecated"|"prohibited"): Adoption status
- lifecycle (string: "active"|"planned"|"sunset"|"retired"): Lifecycle stage
- description (string): Purpose and usage context
- owner (string): Technology owner/sponsor
- supportExpiry (string): Support end date (YYYY-MM-DD)
- replacementPlan (string): Migration/replacement plan if sunsetting`,
      example: `[{"name":"PostgreSQL","layer":"data","category":"Relational Database","vendor":"PostgreSQL Global Development Group","version":"16","status":"approved","lifecycle":"active","description":"Primary relational database for transactional workloads","owner":"Platform Team"}]`,
    },
    integrations: {
      fields: `Extract an array of integration entries. For each integration extract:
- sourceName (string, required): Source system/application name
- targetName (string, required): Target system/application name
- protocol (string): Integration protocol (REST, SOAP, GraphQL, gRPC, SFTP, MQ, Kafka)
- pattern (string): Integration pattern (sync, async, batch, event-driven, pub-sub)
- frequency (string): How often (real-time, hourly, daily, weekly, on-demand)
- dataFlow (string: "unidirectional"|"bidirectional"): Data flow direction
- criticality (string: "critical"|"high"|"medium"|"low"): Integration criticality
- status (string: "active"|"planned"|"deprecated"): Current status
- description (string): What data flows and why
- owner (string): Integration owner`,
      example: `[{"sourceName":"SAP S/4HANA","targetName":"Power BI","protocol":"REST","pattern":"batch","frequency":"daily","dataFlow":"unidirectional","criticality":"high","status":"active","description":"Financial data extract for reporting dashboards","owner":"Integration Team"}]`,
    },
  };

  router.post("/documents/:registryType/upload-extract", uploadLimiter, eaUpload.single("file"), async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: "No file provided" });
      if (file.size > 10 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: "File too large for extraction. Maximum size is 10 MB." });
      }

      const { registryType } = req.params;
      const template = EA_EXTRACTION_TEMPLATES[registryType as string];
      if (!template) {
        return res.status(400).json({ success: false, error: `Unknown registry type: ${registryType}` });
      }

      // 1. Save the document record
      const userId = ((req as unknown as Record<string, unknown>).user as { id?: string })?.id;
      const { templateType, description } = req.body;

      const docRecord = await deps.documents.create({
        registryType: registryType as string,
        registryEntryId: null,
        templateType: templateType || null,
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        category: "extraction",
        description: description || "Uploaded for AI extraction",
        uploadedBy: userId || null,
        sourceDemandId: null,
        extractedData: null,
      });

      // 2. Extract text from the document
      const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
      let extractedText = "";
      try {
        const extraction = await deps.extraction.extractText(file.path, ext);
        extractedText = extraction.extractedText || "";
      } catch (extractErr) {
        logger.warn("[EA Registry] Document text extraction failed, trying raw read:", extractErr);
        try {
          extractedText = safeReadManagedUtf8FileFromRoot(uploadDir, file.filename);
        } catch { /* file may be binary */ }
      }

      if (!extractedText || extractedText.trim().length < 20) {
        return res.status(422).json({
          success: false,
          error: "Could not extract meaningful text from the uploaded document. Please ensure it contains readable text content.",
          documentId: docRecord.id,
        });
      }

      // 3. Truncate to prevent token overflow (keep first 30K chars)
      const truncated = extractedText.substring(0, 30000);

      const governance = await decisionOrchestrator.intake(
        {
          intent: `Extract EA registry entries for ${registryType}`,
          decisionType: "ea_registry_document_extract",
          financialImpact: "low",
          urgency: "low",
          sourceType: "ea_registry_document",
          sourceContext: {
            registryType,
            documentId: docRecord.id,
            fileName: file.originalname,
            extractedLength: truncated.length,
          },
        },
        {
          userId: req.session.userId!,
          organizationId: (req.session as unknown as Record<string, unknown>)?.organizationId as string | undefined,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || undefined,
        },
      );

      if (!governance.canProceedToReasoning) {
        return res.status(403).json({
          success: false,
          error: governance.blockedReason || "EA registry extraction blocked by Corevia Brain governance",
          documentId: docRecord.id,
          decisionBrain: {
            requestNumber: governance.requestNumber,
            status: "blocked",
          },
        });
      }

      // 4. Call AI to extract structured data
      let aiResponse: string;
      try {
        aiResponse = await deps.extraction.extractStructuredEntries({
          registryType: registryType as string,
          fields: template.fields,
          example: template.example,
          truncatedDocument: truncated,
          decisionGovernance: {
            approved: true,
            requestNumber: governance.requestNumber,
          },
        });
      } catch (aiErr) {
        logger.error("[EA Registry] AI extraction failed:", aiErr);
        return res.status(502).json({
          success: false,
          error: "AI extraction service is unavailable. The document has been saved — you can retry extraction later.",
          documentId: docRecord.id,
        });
      }

      // 5. Parse AI response
      let extractedEntries: Record<string, unknown>[] = [];
      try {
        // Strip markdown code fences if present
        let cleaned = aiResponse.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        }
        const parsed = JSON.parse(cleaned);
        extractedEntries = Array.isArray(parsed) ? parsed : [parsed];
      } catch (parseErr) {
        logger.error("[EA Registry] AI response parse failed:", { response: aiResponse.substring(0, 500), error: parseErr });
        return res.status(422).json({
          success: false,
          error: "AI returned unparseable response. The document has been saved — you can retry extraction later.",
          documentId: docRecord.id,
          rawResponse: aiResponse.substring(0, 2000),
        });
      }

      // 6. Return extracted data for user review (NOT auto-created — user confirms)
      return res.json({
        success: true,
        documentId: docRecord.id,
        fileName: file.originalname,
        registryType,
        extractedEntries,
        totalExtracted: extractedEntries.length,
        message: `Extracted ${extractedEntries.length} entries from "${file.originalname}". Review and confirm to add to registry.`,
      });
    } catch (err) {
      logger.error("[EA Registry] Upload-extract failed:", err);
      return res.status(500).json({ success: false, error: "Failed to process document" });
    }
  });

  /**
   * POST /api/ea/registry/documents/:registryType/confirm-extract
   * After user reviews extracted data, confirm and create registry entries.
   */
  router.post("/documents/:registryType/confirm-extract", async (req: Request, res: Response) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const { registryType } = req.params;
      const { entries, documentId } = req.body as { entries: Record<string, unknown>[]; documentId?: string };
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ success: false, error: "No entries to confirm" });
      }

      const provenanceBase = {
        sourceType: "document_extracted" as const,
        sourceDemandId: null,
        sourceVersionId: null,
        verificationStatus: "pending_verification" as const,
        confidenceScore: 75,
      };

      const created: unknown[] = [];
      const errors: string[] = [];

      for (const entry of entries) {
        try {
          const name = String(entry.name || entry.sourceName || "").trim();
          if (!name && registryType !== "integrations") continue;

          switch (registryType) {
            case "applications": {
              const record = await storage.createEaApplication({
                name,
                description: entry.description ? String(entry.description) : null,
                criticality: String(entry.criticality || "medium"),
                lifecycle: String(entry.lifecycle || "active"),
                vendor: entry.vendor ? String(entry.vendor) : null,
                version: entry.version ? String(entry.version) : null,
                hosting: entry.hosting ? String(entry.hosting) : null,
                department: entry.department ? String(entry.department) : null,
                owner: entry.owner ? String(entry.owner) : null,
                tier: entry.tier ? String(entry.tier) : null,
                userCount: entry.userCount ? Number(entry.userCount) : null,
                annualCost: entry.annualCost ? Number(entry.annualCost) : null,
                contractExpiry: entry.contractExpiry ? String(entry.contractExpiry) : null,
                dataClassification: entry.dataClassification ? String(entry.dataClassification) : null,
                disasterRecovery: entry.disasterRecovery ? String(entry.disasterRecovery) : null,
                ...provenanceBase,
              } as Parameters<typeof storage.createEaApplication>[0]);
              created.push(record);
              break;
            }
            case "capabilities": {
              const record = await storage.createEaCapability({
                name,
                level: entry.level ? Number(entry.level) : 1,
                domain: entry.domain ? String(entry.domain) : null,
                owner: entry.owner ? String(entry.owner) : null,
                maturity: entry.maturity ? String(entry.maturity) : null,
                strategicImportance: entry.strategicImportance ? String(entry.strategicImportance) : null,
                description: entry.description ? String(entry.description) : null,
                supportingApplications: Array.isArray(entry.supportingApplications) ? entry.supportingApplications.map(String) : null,
                ...provenanceBase,
              } as Parameters<typeof storage.createEaCapability>[0]);
              created.push(record);
              break;
            }
            case "data-domains": {
              const record = await storage.createEaDataDomain({
                name,
                classification: String(entry.classification || "internal"),
                owner: entry.owner ? String(entry.owner) : null,
                steward: entry.steward ? String(entry.steward) : null,
                description: entry.description ? String(entry.description) : null,
                piiFlag: Boolean(entry.piiFlag),
                crossBorderRestriction: Boolean(entry.crossBorderRestriction),
                retentionPeriod: entry.retentionPeriod ? String(entry.retentionPeriod) : null,
                storageLocation: entry.storageLocation ? String(entry.storageLocation) : null,
                qualityScore: entry.qualityScore ? Number(entry.qualityScore) : null,
                sourceSystem: entry.sourceSystem ? String(entry.sourceSystem) : null,
                regulatoryFramework: entry.regulatoryFramework ? String(entry.regulatoryFramework) : null,
                ...provenanceBase,
              } as Parameters<typeof storage.createEaDataDomain>[0]);
              created.push(record);
              break;
            }
            case "technology-standards": {
              const record = await storage.createEaTechnologyStandard({
                name,
                layer: String(entry.layer || "application"),
                category: entry.category ? String(entry.category) : null,
                vendor: entry.vendor ? String(entry.vendor) : null,
                version: entry.version ? String(entry.version) : null,
                status: String(entry.status || "under_review"),
                lifecycle: String(entry.lifecycle || "planned"),
                description: entry.description ? String(entry.description) : null,
                owner: entry.owner ? String(entry.owner) : null,
                supportExpiry: entry.supportExpiry ? String(entry.supportExpiry) : null,
                replacementPlan: entry.replacementPlan ? String(entry.replacementPlan) : null,
                ...provenanceBase,
              } as Parameters<typeof storage.createEaTechnologyStandard>[0]);
              created.push(record);
              break;
            }
            case "integrations": {
              const sn = String(entry.sourceName || "").trim();
              const tn = String(entry.targetName || "").trim();
              if (!sn || !tn) continue;
              const record = await storage.createEaIntegration({
                sourceName: sn,
                targetName: tn,
                protocol: entry.protocol ? String(entry.protocol) : null,
                pattern: entry.pattern ? String(entry.pattern) : null,
                frequency: entry.frequency ? String(entry.frequency) : null,
                dataFlow: String(entry.dataFlow || "bidirectional"),
                criticality: String(entry.criticality || "medium"),
                status: String(entry.status || "planned"),
                description: entry.description ? String(entry.description) : null,
                owner: entry.owner ? String(entry.owner) : null,
                ...provenanceBase,
              } as Parameters<typeof storage.createEaIntegration>[0]);
              created.push(record);
              break;
            }
          }
        } catch (entryErr) {
          const errMsg = entryErr instanceof Error ? entryErr.message : String(entryErr);
          errors.push(`Failed to create entry "${entry.name || "unknown"}": ${errMsg}`);
        }
      }

      return res.json({
        success: true,
        message: `Created ${created.length} entries in ${registryType} registry`,
        totalCreated: created.length,
        errors: errors.length > 0 ? errors : undefined,
        documentId,
      });
    } catch (err) {
      logger.error("[EA Registry] Confirm extract failed:", err);
      return res.status(500).json({ success: false, error: "Failed to confirm extracted entries" });
    }
  });

  // ── Verification Workflow ───────────────────────────────────────────
  router.patch("/verify/:registryType/:id", async (req, res) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const { registryType, id } = req.params;
      const { status } = req.body;
      if (!["pending_verification", "verified", "rejected", "needs_review"].includes(status)) {
        return res.status(400).json({ success: false, error: "Invalid verification status" });
      }
      const tableMap: Record<string, "applications" | "capabilities" | "data_domains" | "technology_standards" | "integrations"> = {
        applications: "applications",
        capabilities: "capabilities",
        "data-domains": "data_domains",
        "technology-standards": "technology_standards",
        integrations: "integrations",
      };
      const table = tableMap[registryType];
      if (!table) return res.status(400).json({ success: false, error: "Invalid registry type" });
      const userId = ((req as unknown as Record<string, unknown>).user as { id?: string })?.id;
      const updated = await deps.documents.updateVerificationStatus(table, id, status, userId);
      if (!updated) return res.status(404).json({ success: false, error: "Entry not found" });
      return res.json({ success: true });
    } catch (err) {
      logger.error("[EA Registry] Verification update failed:", err);
      return res.status(500).json({ success: false, error: "Failed to update verification" });
    }
  });

  // ── Demand Auto-Ingest ──────────────────────────────────────────────
  /**
   * POST /api/ea/registry/ingest-from-demand
   * Takes an approved demand report with approved BC/Requirements/EA versions,
   * parses the EA analysis artifact, and creates registry entries marked as
   * "pending_verification" + sourceType "demand_ingested".
   */
  router.post("/ingest-from-demand", async (req, res) => {
    if (!hasPermission(req, "ea:registry:write")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      const { demandId } = req.body;
      if (!demandId) return res.status(400).json({ success: false, error: "demandId is required" });

      // 1. Fetch the demand report
      const demand = await deps.demand.getById(demandId);
      if (!demand) return res.status(404).json({ success: false, error: "Demand report not found" });

      // 2. Check it's approved (manager_approved or approved)
      if (!["approved", "manager_approved"].includes(demand.workflowStatus)) {
        return res.status(400).json({
          success: false,
          error: `Demand is not approved (current status: ${demand.workflowStatus}). Only approved demands can be ingested.`,
        });
      }

      // 3. Find approved EA/BC/Requirements versions
      const versions = await deps.demand.getApprovedVersions(demandId);

      const eaVersion = versions.find(v => v.versionType === "enterprise_architecture");
      const bcVersion = versions.find(v => v.versionType === "business_case");
      const reqVersion = versions.find(v => v.versionType === "requirements");

      // 4. Extract EA data from the demand's EA analysis artifact
      const eaData = demand.enterpriseArchitectureAnalysis as Record<string, unknown> | null;
      const eaVersionData = eaVersion?.versionData as Record<string, unknown> | null;
      const merged = { ...eaData, ...eaVersionData };

      const created: { applications: unknown[]; capabilities: unknown[]; data_domains: unknown[]; technology_standards: unknown[]; integrations: unknown[] } = {
        applications: [],
        capabilities: [],
        data_domains: [],
        technology_standards: [],
        integrations: [],
      };

      const provenanceBase = {
        sourceType: "demand_ingested" as const,
        sourceDemandId: demandId,
        sourceVersionId: eaVersion?.id || null,
        verificationStatus: "pending_verification" as const,
        confidenceScore: 85,
      };

      // 5. Parse and ingest applications from EA artifact
      const appArch = merged.applicationArchitecture as Record<string, unknown> | undefined;
      const impactedApps = (appArch?.impactedApplications || appArch?.impacted_apps || []) as Array<Record<string, unknown>>;
      const newApps = (appArch?.newApplicationRequirements || appArch?.new_requirements || []) as Array<Record<string, unknown>>;

      for (const app of [...impactedApps, ...newApps]) {
        const name = String(app.name || app.applicationName || app.system || "").trim();
        if (!name) continue;
        // Check if already exists
        const existing = (await storage.getAllEaApplications()).find(
          a => a.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) continue;

        const record = await storage.createEaApplication({
          name,
          description: String(app.impact || app.description || app.purpose || `Identified from demand ${demand.suggestedProjectName || demandId}`),
          criticality: String(app.criticality || "medium"),
          lifecycle: String(app.lifecycle || "planned"),
          department: String(app.department || demand.department || ""),
          vendor: String(app.vendor || ""),
          ...provenanceBase,
        } as Parameters<typeof storage.createEaApplication>[0]);
        created.applications.push(record);
      }

      // 6. Parse capabilities
      const busArch = merged.businessArchitecture as Record<string, unknown> | undefined;
      const capDomains = (busArch?.capabilityDomains || busArch?.capabilities || []) as Array<Record<string, unknown>>;

      for (const cap of capDomains) {
        const name = String(cap.name || cap.domain || cap.capability || "").trim();
        if (!name) continue;
        const existing = (await storage.getAllEaCapabilities()).find(
          c => c.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) continue;

        const record = await storage.createEaCapability({
          name,
          description: String(cap.description || cap.gap || `Capability from demand ${demand.suggestedProjectName || demandId}`),
          domain: String(cap.domain || cap.category || ""),
          maturity: String(cap.maturity || cap.currentMaturity || ""),
          strategicImportance: String(cap.importance || cap.strategicImportance || "medium"),
          level: 1,
          ...provenanceBase,
        } as Parameters<typeof storage.createEaCapability>[0]);
        created.capabilities.push(record);
      }

      // 7. Parse data domains
      const dataArch = merged.dataArchitecture as Record<string, unknown> | undefined;
      const dataDomains = (dataArch?.dataDomains || dataArch?.domains || dataArch?.data_domains || []) as Array<Record<string, unknown>>;

      for (const domain of dataDomains) {
        const name = String(domain.name || domain.domain || "").trim();
        if (!name) continue;
        const existing = (await storage.getAllEaDataDomains()).find(
          d => d.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) continue;

        const record = await storage.createEaDataDomain({
          name,
          description: String(domain.description || `Data domain from demand ${demand.suggestedProjectName || demandId}`),
          classification: String(domain.classification || domain.sensitivity || "internal"),
          piiFlag: Boolean(domain.piiFlag || domain.containsPII || false),
          crossBorderRestriction: Boolean(domain.crossBorder || domain.crossBorderRestriction || false),
          owner: String(domain.owner || domain.steward || ""),
          ...provenanceBase,
        } as Parameters<typeof storage.createEaDataDomain>[0]);
        created.data_domains.push(record);
      }

      // 8. Parse technology standards
      const techArch = merged.technologyArchitecture as Record<string, unknown> | undefined;
      const techStack = (techArch?.technologyStack || techArch?.stack || techArch?.standards || []) as Array<Record<string, unknown>>;

      for (const tech of techStack) {
        const name = String(tech.name || tech.technology || tech.standard || "").trim();
        if (!name) continue;
        const existing = (await storage.getAllEaTechnologyStandards()).find(
          t => t.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) continue;

        const record = await storage.createEaTechnologyStandard({
          name,
          layer: String(tech.layer || tech.category || "application"),
          description: String(tech.description || tech.purpose || `Technology from demand ${demand.suggestedProjectName || demandId}`),
          status: "under_review",
          lifecycle: String(tech.lifecycle || "planned"),
          vendor: String(tech.vendor || ""),
          ...provenanceBase,
        } as Parameters<typeof storage.createEaTechnologyStandard>[0]);
        created.technology_standards.push(record);
      }

      // 9. Parse integrations
      const integrationDeps = (appArch?.integrationDependencies || appArch?.integrations || []) as Array<Record<string, unknown>>;

      for (const integ of integrationDeps) {
        const sourceName = String(integ.source || integ.sourceName || integ.from || "").trim();
        const targetName = String(integ.target || integ.targetName || integ.to || "").trim();
        if (!sourceName || !targetName) continue;

        const record = await storage.createEaIntegration({
          sourceName,
          targetName,
          protocol: String(integ.protocol || integ.type || ""),
          pattern: String(integ.pattern || ""),
          frequency: String(integ.frequency || ""),
          dataFlow: String(integ.dataFlow || integ.direction || "bidirectional"),
          criticality: String(integ.criticality || "medium"),
          status: "planned",
          description: String(integ.description || `Integration from demand ${demand.suggestedProjectName || demandId}`),
          ...provenanceBase,
        } as Parameters<typeof storage.createEaIntegration>[0]);
        created.integrations.push(record);
      }

      const totalCreated =
        created.applications.length +
        created.capabilities.length +
        created.data_domains.length +
        created.technology_standards.length +
        created.integrations.length;

      return res.json({
        success: true,
        message: `Ingested ${totalCreated} entries from demand "${demand.suggestedProjectName || demandId}"`,
        demandTitle: demand.suggestedProjectName,
        demandStatus: demand.workflowStatus,
        approvedVersions: {
          businessCase: bcVersion ? { id: bcVersion.id, version: bcVersion.versionNumber, status: bcVersion.status } : null,
          requirements: reqVersion ? { id: reqVersion.id, version: reqVersion.versionNumber, status: reqVersion.status } : null,
          enterpriseArchitecture: eaVersion ? { id: eaVersion.id, version: eaVersion.versionNumber, status: eaVersion.status } : null,
        },
        created,
        totalCreated,
      });
    } catch (err) {
      logger.error("[EA Registry] Demand ingest failed:", err);
      return res.status(500).json({ success: false, error: "Failed to ingest from demand" });
    }
  });

  /** GET eligible demands for ingest (approved with EA versions) */
  router.get("/eligible-demands", async (req, res) => {
    if (!hasPermission(req, "ea:registry:read")) {
      return res.status(403).json({ success: false, error: "Insufficient permissions" });
    }
    try {
      // Use storage port for demand query if available, fallback to direct db
      let approved: Array<Record<string, unknown>> = [];
      try {
        approved = await deps.demand.getApproved();
      } catch (dbErr) {
        logger.warn("[EA Registry] Could not fetch demands:", { error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
        return res.json({ success: true, data: [], total: 0 });
      }

      // Enrich with version info
      const enriched = await Promise.all(approved.map(async (d) => {
        let vrs: Array<{ id: string; versionType: string | null; versionNumber: string | null; status: string | null }> = [];
        try {
          vrs = await deps.demand.getVersions(d.id as string);
        } catch { /* ignore version fetch errors */ }
        return {
          ...d,
          versions: {
            businessCase: vrs.find(v => v.versionType === "business_case" && v.status === "approved"),
            requirements: vrs.find(v => v.versionType === "requirements" && v.status === "approved"),
            enterpriseArchitecture: vrs.find(v => v.versionType === "enterprise_architecture" && v.status === "approved"),
          },
          hasApprovedEA: vrs.some(v => v.versionType === "enterprise_architecture" && v.status === "approved"),
          hasApprovedBC: vrs.some(v => v.versionType === "business_case" && v.status === "approved"),
          hasApprovedReq: vrs.some(v => v.versionType === "requirements" && v.status === "approved"),
        };
      }));

      return res.json({ success: true, data: enriched, total: enriched.length });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? err.stack : undefined;
      logger.error("[EA Registry] Eligible demands failed:", { error: errMsg, stack: errStack });
      return res.status(500).json({ success: false, error: "Failed to load eligible demands", detail: errMsg });
    }
  });

  return router;
}
