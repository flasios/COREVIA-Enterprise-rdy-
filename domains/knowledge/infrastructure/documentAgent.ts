import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import PptxGenJS from "pptxgenjs";
import { format } from "date-fns";
import * as fs from "node:fs";
import * as path from "node:path";
import type { IStorage } from '@interfaces/storage';
import { logger } from "@platform/logging/Logger";
import { asText, generateChartImage, parseNumeric } from "./documentAgent.utils";
import { COLORS, PPTX_COLORS } from './documentAgent.constants';
import type {
  AssumptionItem,
  AutoTableCellHookData,
  BusinessCaseData,
  BusinessCaseRecord,
  CategorizedRisk,
  ChartAnnotations,
  ClassifiedPhase,
  ComplianceRequirement,
  DeliverableItem,
  DependencyItem,
  DetailedBenefitItem,
  DetailedCostItem,
  DocumentAgentOptions,
  GovernanceFrameworkItem,
  ImplementationPhaseItem,
  KPIItem,
  MeasurementPlanItem,
  NextStepItem,
  PptxSlide,
  StakeholderData,
} from './documentAgent.types';

const PptxGenJSConstructor: typeof PptxGenJS = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);


export class DocumentGenerationAgent {
  private logoBase64: string | null = null;
  private dubaiRegularFont: string | null = null;
  private dubaiBoldFont: string | null = null;

  constructor() {
    this.loadLogo();
    this.loadFonts();
  }

  private loadLogo(): void {
    try {
      const pngLogoPath = path.join(process.cwd(), "attached_assets", "corevia-logo.png");
      const svgLogoPath = path.join(process.cwd(), "attached_assets", "corevia-logo.svg");
      const legacyLogoPath = path.join(process.cwd(), "attached_assets", "image_1768499937059.png");
      if (fs.existsSync(pngLogoPath)) {
        const pngBuffer = fs.readFileSync(pngLogoPath);
        this.logoBase64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      } else if (fs.existsSync(svgLogoPath)) {
        const svgBuffer = fs.readFileSync(svgLogoPath);
        this.logoBase64 = `data:image/svg+xml;base64,${svgBuffer.toString("base64")}`;
      } else if (fs.existsSync(legacyLogoPath)) {
        const logoBuffer = fs.readFileSync(legacyLogoPath);
        this.logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      }
    } catch (error) {
      logger.error("[DocumentAgent] Error loading logo:", error);
    }
  }

  private loadFonts(): void {
    try {
      const regularPath = path.join(process.cwd(), "fonts", "Dubai-Regular.b64");
      const boldPath = path.join(process.cwd(), "fonts", "Dubai-Bold.b64");

      if (fs.existsSync(regularPath)) {
        this.dubaiRegularFont = fs.readFileSync(regularPath, "utf-8");
        logger.info("[DocumentAgent] Dubai Regular font loaded");
      }
      if (fs.existsSync(boldPath)) {
        this.dubaiBoldFont = fs.readFileSync(boldPath, "utf-8");
        logger.info("[DocumentAgent] Dubai Bold font loaded");
      }
    } catch (error) {
      logger.error("[DocumentAgent] Error loading fonts:", error);
    }
  }

  private registerDubaiFonts(doc: jsPDF): string {
    if (this.dubaiRegularFont) {
      doc.addFileToVFS("Dubai-Regular.ttf", this.dubaiRegularFont);
      doc.addFont("Dubai-Regular.ttf", "Dubai", "normal");
    }
    if (this.dubaiBoldFont) {
      doc.addFileToVFS("Dubai-Bold.ttf", this.dubaiBoldFont);
      doc.addFont("Dubai-Bold.ttf", "Dubai", "bold");
    }
    return this.dubaiRegularFont ? "Dubai" : "helvetica";
  }

  async generateDocument(options: DocumentAgentOptions): Promise<Buffer> {
    const { storage, reportId, format, versionId } = options;

    logger.info("[DocumentAgent] Starting document generation for format:", format, "versionId:", versionId);
    const businessCaseData = await this.fetchBusinessCaseData(storage, reportId, versionId);

    if (format === "pdf") {
      return await this.generatePDF(businessCaseData);
    } else {
      return await this.generatePPTX(businessCaseData);
    }
  }

  private async fetchBusinessCaseData(storage: IStorage, reportId: string, versionId?: string): Promise<BusinessCaseData> { // NOSONAR
    const demandReport = await storage.getDemandReport(reportId);
    let businessCase = await storage.getBusinessCaseByDemandReportId(reportId);

    if (!demandReport) {
      throw new Error("Demand report not found");
    }

    // If a specific versionId is requested, use that version's data.
    // Otherwise, always prefer the latest saved version for the most up-to-date data.
    const versions = await storage.getReportVersions(reportId);
    const sortedVersions = (versions || [])
      .filter((v) => v.versionType === 'business_case' || v.versionType === 'both' || !v.versionType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (versionId) {
      const targetVersion = sortedVersions.find(v => String(v.id) === String(versionId));
      if (targetVersion?.versionData) {
        logger.info('[DocumentAgent] Using specific version data for versionId:', versionId);
        businessCase = targetVersion.versionData as unknown as NonNullable<typeof businessCase>;
      }
    } else if (sortedVersions.length > 0 && sortedVersions[0]?.versionData) {
      // Always use the latest version data — it contains the most recent user edits
      logger.info('[DocumentAgent] Using latest version data (most recent edits)');
      const latestVersionData = sortedVersions[0].versionData as Record<string, unknown>;
      // Merge latest version data over the base business case (version data takes priority)
      if (businessCase) {
        businessCase = { ...businessCase, ...latestVersionData } as NonNullable<typeof businessCase>;
      } else {
        businessCase = latestVersionData as unknown as NonNullable<typeof businessCase>;
      }
    }

    // Fallback: some flows store business case outputs only in report_versions.
    if (!businessCase) {
      if (sortedVersions[0]?.versionData) {
        logger.warn('[DocumentAgent] No business_cases record found; falling back to latest report_versions payload');
        businessCase = sortedVersions[0].versionData as unknown as NonNullable<typeof businessCase>;
      }
    }

    if (!businessCase) {
      throw new Error("Business case not found - please generate a business case first");
    }

    const bc = businessCase as BusinessCaseRecord;

    // Use cached computed financial model if available (from unified service)
    const cachedModel = bc.computedFinancialModel;
    if (cachedModel?.generatedAt) {
      logger.info("[DocumentAgent] Using cached unified financial model from database");
    }

    logger.info("[DocumentAgent] Fetching business case data:", {
      reportId,
      hasExecutiveSummary: !!businessCase.executiveSummary,
      hasProblemStatement: !!businessCase.problemStatement,
      hasProposedSolution: !!businessCase.proposedSolution,
      hasCachedFinancialModel: !!cachedModel,
    });

    const parseJSON = <T>(data: string | T | null | undefined, defaultValue: T): T => {
      if (!data) return defaultValue;
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch {
          return defaultValue;
        }
      }
      return data;
    };

    const normalizeInlineText = (value: unknown): string => {
      if (typeof value !== "string") {
        if (value === null || value === undefined) return "";
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value).trim();
        }
        return "";
      }

      return value
        .replaceAll(/[\u2013\u2014]/g, "-")
        .replaceAll("\r", " ")
        .replaceAll(/\s+/g, " ")
        .replaceAll(/\s+([,.;:!?])/g, "$1")
        .replaceAll(/([.?!])\1+/g, "$1")
        .replaceAll(/\.\s*\./g, ".")
        .replaceAll(/;\s*[.]/g, ";")
        .replaceAll(/:\s*[.]/g, ":")
        .replaceAll(/\(\s+/g, "(")
        .replaceAll(/\s+\)/g, ")")
        .trim();
    };

    const normalizeNarrativeText = (value: unknown): string => {
      const text = normalizeInlineText(value);
      return text
        .replaceAll("..", ".")
        .replaceAll(/\s{2,}/g, " ")
        .replaceAll(/\b(it is important to note that|it should be noted that|in order to|for the purpose of|with respect to|in terms of|as a matter of fact|at the end of the day|needless to say|it goes without saying)\b/gi, "")
        .replaceAll(/\b(comprehensive|robust|holistic|synergistic|cutting-edge|state-of-the-art|best-in-class|world-class|next-generation|transformative|revolutionary|paradigm-shifting|mission-critical|game-changing)\b/gi, (m) => {
          const map: Record<string, string> = { comprehensive: "full", robust: "strong", holistic: "integrated", synergistic: "", "cutting-edge": "modern", "state-of-the-art": "modern", "best-in-class": "leading", "world-class": "leading", "next-generation": "new", transformative: "significant", revolutionary: "", "paradigm-shifting": "", "mission-critical": "critical", "game-changing": "significant" };
          return map[m.toLowerCase()] ?? m;
        })
        .replaceAll(/\s{2,}/g, " ")
        .trim();
    };

    const takeSentences = (value: unknown, count: number): string => {
      const text = normalizeNarrativeText(value);
      if (!text) return "";
      const sentences = text
        .match(/[^.!?]+[.!?]?/g)
        ?.map((sentence) => sentence.trim())
        .filter((s) => s && s.length > 12) || [];
      return sentences.slice(0, count).join(" ").trim();
    };

    /** Compress long narrative to N sentences; drop filler. */
    const compressNarrative = (value: unknown, maxSentences: number): string => {
      const text = normalizeNarrativeText(value);
      if (!text) return "";
      const sentences = text
        .match(/[^.!?]+[.!?]/g)
        ?.map((s) => s.trim())
        .filter((s) => s.length > 15) || [];
      if (sentences.length <= maxSentences) return sentences.join(" ");
      return sentences.slice(0, maxSentences).join(" ");
    };

    const formatFullCurrency = (value: number): string => {
      if (!Number.isFinite(value) || value === 0) return "AED 0";
      const rounded = Math.round(Math.abs(value)).toLocaleString("en-US");
      return value < 0 ? `AED -${rounded}` : `AED ${rounded}`;
    };

    const ensureStringList = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === "string") return normalizeInlineText(item);
            if (item && typeof item === "object") {
              const record = item as Record<string, unknown>;
              return normalizeInlineText(
                record.name || record.title || record.label || record.value || record.description || record.text || "",
              );
            }
            return normalizeInlineText(item);
          })
          .filter(Boolean);
      }
      if (typeof value === "string") {
        return value
          .split(/[\n;]/)
          .map((item) => normalizeInlineText(item))
          .filter(Boolean);
      }
      return [];
    };

    const parseFlexibleObject = <T>(value: unknown, defaultValue: T): T => {
      if (!value) return defaultValue;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === "object" ? (parsed as T) : defaultValue;
        } catch {
          return defaultValue;
        }
      }
      return typeof value === "object" ? (value as T) : defaultValue;
    };

    const smartObjectives = parseJSON(bc.smartObjectives, []);
    const scopeDefinition = parseJSON(bc.scopeDefinition, { inScope: [], outOfScope: [] });
    const expectedDeliverables = parseJSON(bc.expectedDeliverables, []);

    // Get saved financial parameters (source of truth for edits)
    const savedTotalCost = bc.totalCostEstimate ? parseNumeric(bc.totalCostEstimate) : 0;
    const projectName = demandReport.suggestedProjectName || '';

    // Detect archetype from project name (matching frontend logic)
    const detectArchetype = (name: string): string => {
      const nameLower = name.toLowerCase();
      const archetypeKeywords: [string, string[]][] = [
        ['Autonomous Vehicle Platform', ['autonomous', 'self-driving', 'driverless', 'robo-taxi', 'av platform', 'mobility rollout']],
        ['Healthcare Digital System', ['healthcare', 'medical', 'hospital', 'patient', 'clinical', 'health system']],
        ['AI/ML Platform', ['ai platform', 'machine learning', 'artificial intelligence', 'ml platform']],
        ['Blockchain Platform', ['blockchain', 'distributed ledger', 'smart contract']],
        ['Cybersecurity Infrastructure', ['cybersecurity', 'security operations', 'soc']],
      ];
      for (const [archetype, keywords] of archetypeKeywords) {
        for (const keyword of keywords) {
          if (nameLower.includes(keyword)) return archetype;
        }
      }
      return 'Government Digital Transformation';
    };

    const archetype = detectArchetype(projectName);
    const totalInvestment = savedTotalCost > 0 ? savedTotalCost : parseNumeric(bc.totalCostEstimate);

    // Recalculate detailedCosts based on archetype and saved totalCostEstimate (matching frontend)
    const getRecalculatedCosts = (): DetailedCostItem[] => {
      if (totalInvestment <= 0) return parseJSON(bc.detailedCosts, []);

      if (archetype === 'Autonomous Vehicle Platform') {
        return [
          { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet Acquisition', description: 'Self-driving vehicles with sensors', year0: totalInvestment * 0.45, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Charging & Maintenance', description: 'Charging stations and service centers', year0: totalInvestment * 0.2, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'Command Center Platform', description: 'Fleet management and AI systems', year0: totalInvestment * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c4', category: 'operational', subcategory: 'Operations', name: 'Annual Fleet Operations', description: 'Maintenance, insurance, energy', year0: 0, year1: totalInvestment * 0.08, year2: totalInvestment * 0.07, year3: totalInvestment * 0.06, year4: totalInvestment * 0.065, year5: totalInvestment * 0.065, isRecurring: true },
        ];
      }
      if (archetype === 'Healthcare Digital System') {
        return [
          { id: 'c1', category: 'implementation', subcategory: 'Platform', name: 'EHR/Clinical Platform', description: 'Electronic health records system', year0: totalInvestment * 0.4, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c2', category: 'implementation', subcategory: 'Integration', name: 'Medical Device Integration', description: 'IoT and device connectivity', year0: totalInvestment * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c3', category: 'implementation', subcategory: 'Compliance', name: 'Regulatory Compliance', description: 'HIPAA, data security certification', year0: totalInvestment * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
          { id: 'c4', category: 'operational', subcategory: 'Operations', name: 'Clinical Support', description: 'Annual support and updates', year0: 0, year1: totalInvestment * 0.08, year2: totalInvestment * 0.08, year3: totalInvestment * 0.08, year4: totalInvestment * 0.08, year5: totalInvestment * 0.08, isRecurring: true },
        ];
      }
      // Default government transformation
      const implementationCost = totalInvestment * 0.8;
      const operationalCost = totalInvestment * 0.1;
      return [
        { id: 'c1', category: 'implementation', subcategory: 'Software', name: 'Software & Development', description: 'Core platform development', year0: implementationCost * 0.4, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Infrastructure Setup', description: 'Hardware and cloud setup', year0: implementationCost * 0.3, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { id: 'c3', category: 'implementation', subcategory: 'Integration', name: 'System Integration', description: 'Integration with existing systems', year0: implementationCost * 0.2, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { id: 'c4', category: 'implementation', subcategory: 'PM', name: 'Project Management', description: 'PMO and governance', year0: implementationCost * 0.1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { id: 'c5', category: 'operational', subcategory: 'Operations', name: 'Annual Operations', description: 'Hosting and support', year0: 0, year1: operationalCost, year2: operationalCost * 1.03, year3: operationalCost * 1.06, year4: operationalCost * 1.09, year5: operationalCost * 1.12, isRecurring: true },
      ];
    };

    // Recalculate detailedBenefits based on archetype and saved totalCostEstimate (matching frontend)
    const getRecalculatedBenefits = (): DetailedBenefitItem[] => {
      if (totalInvestment <= 0) return parseJSON(bc.detailedBenefits, []);

      if (archetype === 'Autonomous Vehicle Platform') {
        const annualRevenue = totalInvestment * 0.25;
        return [
          { id: 'b1', category: 'revenue', name: 'Ride Fare Revenue', description: 'Per-trip passenger revenue', year1: annualRevenue * 0.3, year2: annualRevenue * 0.6, year3: annualRevenue * 0.85, year4: annualRevenue, year5: annualRevenue * 1.1, realization: 'gradual', confidence: 'medium' },
          { id: 'b2', category: 'cost_savings', name: 'Driver Cost Elimination', description: 'No driver wages or benefits', year1: totalInvestment * 0.08, year2: totalInvestment * 0.12, year3: totalInvestment * 0.15, year4: totalInvestment * 0.18, year5: totalInvestment * 0.2, realization: 'gradual', confidence: 'high' },
          { id: 'b3', category: 'strategic', name: 'UAE Mobility Leadership', description: 'Global smart city positioning', year1: totalInvestment * 0.02, year2: totalInvestment * 0.04, year3: totalInvestment * 0.06, year4: totalInvestment * 0.08, year5: totalInvestment * 0.1, realization: 'delayed', confidence: 'medium' },
        ];
      }
      if (archetype === 'Healthcare Digital System') {
        return [
          { id: 'b1', category: 'productivity', name: 'Clinical Efficiency', description: 'Reduced documentation time', year1: totalInvestment * 0.1, year2: totalInvestment * 0.15, year3: totalInvestment * 0.2, year4: totalInvestment * 0.22, year5: totalInvestment * 0.25, realization: 'gradual', confidence: 'high' },
          { id: 'b2', category: 'strategic', name: 'Patient Outcome Improvement', description: 'Reduced readmissions, better care', year1: totalInvestment * 0.05, year2: totalInvestment * 0.1, year3: totalInvestment * 0.15, year4: totalInvestment * 0.18, year5: totalInvestment * 0.2, realization: 'delayed', confidence: 'medium' },
          { id: 'b3', category: 'risk_reduction', name: 'Regulatory Compliance', description: 'Audit efficiency, reduced penalties', year1: totalInvestment * 0.03, year2: totalInvestment * 0.05, year3: totalInvestment * 0.06, year4: totalInvestment * 0.07, year5: totalInvestment * 0.08, realization: 'immediate', confidence: 'high' },
        ];
      }
      // Default government transformation
      const annualBenefit = totalInvestment * 0.2;
      return [
        { id: 'b1', category: 'productivity', name: 'Efficiency Gains', description: 'Time savings from automation', year1: annualBenefit * 0.2, year2: annualBenefit * 0.5, year3: annualBenefit * 0.8, year4: annualBenefit, year5: annualBenefit, realization: 'gradual', confidence: 'medium' },
        { id: 'b2', category: 'cost_savings', name: 'Cost Reduction', description: 'Reduced operational costs', year1: annualBenefit * 0.15, year2: annualBenefit * 0.4, year3: annualBenefit * 0.7, year4: annualBenefit * 0.9, year5: annualBenefit, realization: 'gradual', confidence: 'high' },
        { id: 'b3', category: 'risk_reduction', name: 'Risk Mitigation', description: 'Reduced errors and compliance risk', year1: annualBenefit * 0.1, year2: annualBenefit * 0.3, year3: annualBenefit * 0.5, year4: annualBenefit * 0.7, year5: annualBenefit * 0.8, realization: 'delayed', confidence: 'medium' },
      ];
    };

    const hasNumericCostBreakdown = (items: DetailedCostItem[]): boolean => items.some((item) => (
      Number(item.year0 || 0) > 0 || Number(item.year1 || 0) > 0 || Number(item.year2 || 0) > 0 ||
      Number(item.year3 || 0) > 0 || Number(item.year4 || 0) > 0 || Number(item.year5 || 0) > 0
    ));

    const hasNumericBenefitBreakdown = (items: DetailedBenefitItem[]): boolean => items.some((item) => (
      Number(item.year1 || 0) > 0 || Number(item.year2 || 0) > 0 || Number(item.year3 || 0) > 0 ||
      Number(item.year4 || 0) > 0 || Number(item.year5 || 0) > 0
    ));

    const buildFallbackDetailedCosts = (authoritativeCost: number): DetailedCostItem[] => {
      if (authoritativeCost <= 0) return [];
      const implementationBase = authoritativeCost * 0.82;
      const annualRunCost = (authoritativeCost - implementationBase) / 5;
      return [
        { category: 'implementation', subcategory: 'Software', name: 'Core Software & Development', description: 'Core platform development', year0: implementationBase * 0.35, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { category: 'implementation', subcategory: 'Infrastructure', name: 'Infrastructure Setup', description: 'Infrastructure and hosting setup', year0: implementationBase * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { category: 'implementation', subcategory: 'Integration', name: 'Enterprise Integration', description: 'System integration and data onboarding', year0: implementationBase * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { category: 'implementation', subcategory: 'PM', name: 'PMO & Governance', description: 'Program governance and delivery control', year0: implementationBase * 0.1, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { category: 'implementation', subcategory: 'Enablement', name: 'Change Management & Training', description: 'Adoption, training, and operating readiness', year0: implementationBase * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
        { category: 'operational', subcategory: 'Operations', name: 'Annual Operations', description: 'Hosting, support, and managed operations', year0: 0, year1: annualRunCost, year2: annualRunCost, year3: annualRunCost, year4: annualRunCost, year5: annualRunCost, isRecurring: true },
      ];
    };

    const buildFallbackDetailedBenefits = (authoritativeBenefit: number): DetailedBenefitItem[] => {
      if (authoritativeBenefit <= 0) return [];
      return [
        { category: 'productivity', name: 'Operational Productivity Gains', description: 'Recovered capacity from automation and workflow simplification', year1: authoritativeBenefit * 0.08, year2: authoritativeBenefit * 0.14, year3: authoritativeBenefit * 0.22, year4: authoritativeBenefit * 0.26, year5: authoritativeBenefit * 0.3, realization: 'gradual', confidence: 'medium' },
        { category: 'cost_savings', name: 'Operating Cost Avoidance', description: 'Lower operating effort and service-delivery costs', year1: authoritativeBenefit * 0.07, year2: authoritativeBenefit * 0.13, year3: authoritativeBenefit * 0.2, year4: authoritativeBenefit * 0.24, year5: authoritativeBenefit * 0.26, realization: 'gradual', confidence: 'high' },
        { category: 'risk_reduction', name: 'Control and Compliance Risk Reduction', description: 'Reduced operational risk and compliance exposure', year1: authoritativeBenefit * 0.05, year2: authoritativeBenefit * 0.09, year3: authoritativeBenefit * 0.15, year4: authoritativeBenefit * 0.17, year5: authoritativeBenefit * 0.2, realization: 'delayed', confidence: 'medium' },
      ];
    };

    const authoritativeTotalCost = Number(cachedModel?.metrics?.totalCosts || cachedModel?.metrics?.totalCost || bc.totalCostEstimate || 0);
    const authoritativeTotalBenefit = Number(cachedModel?.metrics?.totalBenefits || cachedModel?.metrics?.totalBenefit || bc.totalBenefitEstimate || 0);

    const cachedDetailedCosts = Array.isArray(cachedModel?.costs) ? (cachedModel.costs as DetailedCostItem[]) : [];
    const cachedDetailedBenefits = Array.isArray(cachedModel?.benefits) ? (cachedModel.benefits as DetailedBenefitItem[]) : [];
    const storedDetailedCosts = parseJSON(bc.detailedCosts, [] as DetailedCostItem[]);
    const storedDetailedBenefits = parseJSON(bc.detailedBenefits, [] as DetailedBenefitItem[]);

    const resolveDetailedCosts = (): DetailedCostItem[] => {
      if (hasNumericCostBreakdown(cachedDetailedCosts)) {
        return cachedDetailedCosts;
      }

      if (hasNumericCostBreakdown(storedDetailedCosts)) {
        return storedDetailedCosts;
      }

      if (authoritativeTotalCost > 0) {
        return buildFallbackDetailedCosts(authoritativeTotalCost);
      }

      return savedTotalCost > 0 ? getRecalculatedCosts() : [];
    };

    const resolveDetailedBenefits = (): DetailedBenefitItem[] => {
      if (hasNumericBenefitBreakdown(cachedDetailedBenefits)) {
        return cachedDetailedBenefits;
      }

      if (hasNumericBenefitBreakdown(storedDetailedBenefits)) {
        return storedDetailedBenefits;
      }

      if (authoritativeTotalBenefit > 0) {
        return buildFallbackDetailedBenefits(authoritativeTotalBenefit);
      }

      return savedTotalCost > 0 ? getRecalculatedBenefits() : [];
    };

    const detailedCosts = resolveDetailedCosts();
    const detailedBenefits = resolveDetailedBenefits();

    logger.info('[DocumentAgent] Financial recalculation:', {
      archetype,
      savedTotalCost,
      useRecalculated: savedTotalCost > 0,
      detailedCostsCount: detailedCosts.length,
      detailedBenefitsCount: detailedBenefits.length
    });
    const strategicObjectives = parseJSON(bc.strategicObjectives, []);
    const departmentImpact = parseJSON(bc.departmentImpact, []);
    const complianceRequirements = parseJSON(bc.complianceRequirements, []);
    const policyReferences = parseJSON(bc.policyReferences, []);
    const kpis = parseJSON(bc.kpis, []);
    const governanceFramework = parseFlexibleObject<GovernanceFrameworkItem>(bc.governanceFramework, {});
    const measurementPlan = parseFlexibleObject<MeasurementPlanItem>(bc.measurementPlan, {});
    const successCriteria = parseJSON(bc.successCriteria, []);
    const performanceTargets = parseJSON(bc.performanceTargets, []);
    const stakeholderAnalysis = parseJSON(bc.stakeholderAnalysis, []);
    const identifiedRisks = parseJSON(bc.identifiedRisks, []);
    const implementationPhases = parseJSON(bc.implementationPhases, []);
    const milestones = parseJSON(bc.milestones, []);
    const keyAssumptions = parseJSON(bc.keyAssumptions, []);
    const rawProjectDeps = parseJSON(bc.projectDependencies || bc.dependencies, []);
    const projectDependencies = Array.isArray(rawProjectDeps)
      ? rawProjectDeps
      : ((rawProjectDeps as { dependencies?: unknown[] })?.dependencies || []);
    const recommendations = typeof bc.recommendations === "string"
      ? (() => {
          try {
            return JSON.parse(bc.recommendations);
          } catch {
            return bc.recommendations.trim();
          }
        })()
      : (bc.recommendations || {});
    const nextSteps = parseJSON(bc.nextSteps, []);

    const normalizedGovernance = {
      oversight: ensureStringList(governanceFramework.oversight),
      cadence: governanceFramework.cadence || "Monthly delivery and quarterly steering reviews",
      approvals: ensureStringList(governanceFramework.approvals),
    };

    const normalizedMeasurementOwners = ensureStringList(measurementPlan.owners);
    const normalizedMeasurementKpis = Array.isArray(measurementPlan.kpis)
      ? measurementPlan.kpis
          .map((item) => {
            if (typeof item === "string") {
              return { name: normalizeInlineText(item), baseline: "Current state", target: "Target state" };
            }
            return {
              name: normalizeInlineText(item?.name || "KPI"),
              baseline: normalizeInlineText(item?.baseline || "Current state"),
              target: normalizeInlineText(item?.target || "Target state"),
              owner: normalizeInlineText(item?.owner),
            };
          })
          .filter((item) => item.name)
      : [];

    const normalizedKpis = Array.isArray(kpis)
      ? (kpis as Array<string | Record<string, unknown>>)
          .map((item) => {
            if (typeof item === "string") {
              return {
                name: normalizeInlineText(item),
                description: "",
                target: "Target state",
                baseline: "Current state",
              };
            }
            const owner = typeof item.owner === "string" ? normalizeInlineText(item.owner) : undefined;
            return {
              name: normalizeInlineText(item.name || item.metric || item.kpi || "KPI"),
              description: typeof item.description === "string" ? normalizeNarrativeText(item.description) : undefined,
              target: normalizeInlineText(item.target || item.goal || "Target state"),
              baseline: normalizeInlineText(item.baseline || item.current || "Current state"),
              unit: typeof item.unit === "string" ? normalizeInlineText(item.unit) : undefined,
              owner,
            };
          })
          .filter((item) => item.name)
      : [];

    const normalizedSuccessCriteria = (() => {
      const combined = [
        ...(Array.isArray(successCriteria) ? successCriteria : []),
        ...(Array.isArray(performanceTargets) ? performanceTargets : []),
      ];
      return combined
        .map((item) => {
          if (typeof item === "string") {
            return { criterion: normalizeInlineText(item), target: "Target state" };
          }
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          let measurement: string | undefined;
          if (typeof record.measurement === "string") {
            measurement = normalizeInlineText(record.measurement);
          } else if (typeof record.howMeasured === "string") {
            measurement = normalizeInlineText(record.howMeasured);
          }
          return {
            criterion: normalizeInlineText(record.criterion || record.name || record.metric || record.targetName || "Success criterion"),
            target: normalizeInlineText(record.target || record.goal || record.expected || "Target state"),
            measurement,
          };
        })
        .filter((item): item is { criterion: string; target: string; measurement?: string } => Boolean(item?.criterion));
    })();

    const normalizedStrategicObjectives = Array.isArray(strategicObjectives)
      ? (strategicObjectives as Array<string | Record<string, unknown>>)
          .map((item) => {
            if (typeof item === "string") {
              return {
                name: normalizeInlineText(item),
                description: "",
              };
            }
            let description = "";
            if (typeof item.description === "string") {
              description = normalizeNarrativeText(item.description);
            } else if (typeof item.alignment === "string") {
              description = normalizeNarrativeText(item.alignment);
            }
            return {
              name: normalizeInlineText(item.name || item.objective || item.title || item.description || "Strategic objective"),
              description,
              alignment: typeof item.alignment === "string" ? normalizeInlineText(item.alignment) : undefined,
              objective: typeof item.objective === "string" ? normalizeInlineText(item.objective) : undefined,
            };
          })
          .filter((item) => item.name)
      : [];

    const normalizedDepartmentImpact = (() => {
      if (Array.isArray(departmentImpact)) {
        return (departmentImpact as Array<string | Record<string, unknown>>)
          .map((item) => {
            if (typeof item === "string") {
              return {
                department: "Enterprise",
                impact: normalizeNarrativeText(item),
                type: "Direct",
              };
            }
            return {
              department: normalizeInlineText(item.department || item.name || "Enterprise"),
              impact: normalizeNarrativeText(item.impact || item.description || item.value || "Impact to be confirmed"),
              type: typeof item.type === "string" ? normalizeInlineText(item.type) : "Direct",
            };
          })
          .filter((item) => item.impact);
      }

      if (departmentImpact && typeof departmentImpact === "object") {
        const impactRecord = departmentImpact as Record<string, unknown>;
        const mapList = (items: unknown, type: string) => ensureStringList(items).map((impact) => ({
          department: "Digital Transformation Office",
          impact: normalizeNarrativeText(impact),
          type,
        }));
        return [
          ...mapList(impactRecord.positive, "Positive"),
          ...mapList(impactRecord.negative, "Constraint"),
          ...mapList(impactRecord.mitigation, "Mitigation"),
        ];
      }

      return [];
    })();

    const getStakeholders = (data: StakeholderData | StakeholderData[] | null | undefined): StakeholderData[] => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (data.stakeholders && Array.isArray(data.stakeholders)) return data.stakeholders;
      return [];
    };

    const getAssumptions = (data: string | AssumptionItem | AssumptionItem[] | null | undefined): string[] => {
      if (!data) return [];
      if (Array.isArray(data)) {
        return data.map((a: string | AssumptionItem) => typeof a === "string" ? a : a.assumption || a.description || a.text || asText(a));
      }
      if (typeof data === "object" && data.keyAssumptions && Array.isArray(data.keyAssumptions)) {
        return data.keyAssumptions.map((a: string | AssumptionItem) => typeof a === "string" ? a : a.assumption || a.description || asText(a));
      }
      return [];
    };

    const classifyPhase = (p: ImplementationPhaseItem): "quick_win" | "strategic" | "unknown" => {
      if (p.type === "quick_win" || p.category === "quick_win") return "quick_win";
      if (p.type === "strategic" || p.category === "strategic") return "strategic";
      if (p.phase?.toLowerCase().includes("quick")) return "quick_win";
      if (p.phase?.toLowerCase().includes("strategic")) return "strategic";
      const timeline = (p.timeline || "").toLowerCase();
      if (timeline.includes("0-3") || timeline.includes("month 1") || timeline.includes("week")) return "quick_win";
      if (timeline.includes("6-12") || timeline.includes("q3") || timeline.includes("q4") || timeline.includes("year")) return "strategic";
      if (timeline.includes("3-6") || timeline.includes("q2")) return "strategic";
      return "unknown";
    };

    const classifiedPhases = (implementationPhases as ImplementationPhaseItem[]).map((p: ImplementationPhaseItem) => ({
      ...p,
      _classification: classifyPhase(p),
    }));

    const quickWins = classifiedPhases.filter((p: ClassifiedPhase) => p._classification === "quick_win");
    const strategicInitiatives = classifiedPhases.filter((p: ClassifiedPhase) => p._classification === "strategic");
    const unknownPhases = classifiedPhases.filter((p: ClassifiedPhase) => p._classification === "unknown");

    if (unknownPhases.length > 0 && quickWins.length === 0 && strategicInitiatives.length === 0) {
      const mid = Math.ceil(unknownPhases.length / 2);
      unknownPhases.slice(0, mid).forEach((p: ClassifiedPhase) => quickWins.push(p));
      unknownPhases.slice(mid).forEach((p: ClassifiedPhase) => strategicInitiatives.push(p));
    } else if (unknownPhases.length > 0) {
      unknownPhases.forEach((p: ClassifiedPhase) => {
        if (quickWins.length <= strategicInitiatives.length) {
          quickWins.push(p);
        } else {
          strategicInitiatives.push(p);
        }
      });
    }

    // Helper function to calculate TCO from detailed costs (sum of all year costs)
    const calculateTCO = (costs: DetailedCostItem[]): number => {
      return (costs || []).reduce((total: number, cost: DetailedCostItem) => {
        const yearSum = (['year0', 'year1', 'year2', 'year3', 'year4', 'year5'] as const).reduce((sum, key) => {
          return sum + parseNumeric(cost[key]);
        }, 0);
        return total + yearSum;
      }, 0);
    };

    // Helper function to calculate total benefits from detailed benefits
    const calculateTotalBenefits = (benefits: DetailedBenefitItem[]): number => {
      return (benefits || []).reduce((total: number, benefit: DetailedBenefitItem) => {
        const yearSum = (['year1', 'year2', 'year3', 'year4', 'year5'] as const).reduce((sum, key) => {
          return sum + parseNumeric(benefit[key]);
        }, 0);
        return total + yearSum;
      }, 0);
    };

    const computedTCO = calculateTCO(detailedCosts);
    const computedTotalBenefit = calculateTotalBenefits(detailedBenefits);
    const resolvedTotalCost = authoritativeTotalCost > 0 ? authoritativeTotalCost : computedTCO;
    const resolvedTotalBenefit = authoritativeTotalBenefit > 0 ? authoritativeTotalBenefit : computedTotalBenefit;

    const result: BusinessCaseData = {
      projectName: demandReport.suggestedProjectName || (demandReport as { businessObjective?: string }).businessObjective?.substring(0, 60) || "Not recorded",
      demandId: demandReport.projectId || reportId.substring(0, 12),
      generatedAt: bc.generatedAt || new Date(),
      executiveSummary: bc.executiveSummary || "",
      backgroundContext: bc.backgroundContext || "",
      problemStatement: bc.problemStatement || "",
      proposedSolution: bc.proposedSolution || bc.solutionOverview || "",
      businessRequirements: bc.businessRequirements || "",
      smartObjectives: Array.isArray(smartObjectives) ? smartObjectives as BusinessCaseData["smartObjectives"] : [],
      scopeDefinition: {
        inScope: scopeDefinition.inScope || [],
        outOfScope: scopeDefinition.outOfScope || [],
      },
      expectedDeliverables: Array.isArray(expectedDeliverables)
        ? (expectedDeliverables as Array<string | DeliverableItem>).map((d: string | DeliverableItem) => {
            if (typeof d === "string") return d;
            return {
              name: d.name || d.deliverable || "Deliverable",
              owner: d.owner || d.assignee || "",
              timeline: d.timeline || d.dueDate || (d.startDate && d.endDate ? `${d.startDate} - ${d.endDate}` : ""),
              status: d.status || d.state || "",
              startDate: d.startDate || "",
              endDate: d.endDate || ""
            };
          })
        : [],
      financialMetrics: (() => {
        // PRIORITY 1: Use cached unified financial model from database (source of truth)
        if (cachedModel?.metrics) {
          const cachedTotalCost = cachedModel.metrics.totalCosts || cachedModel.metrics.totalCost || computedTCO;
          const cachedTotalBenefit = cachedModel.metrics.totalBenefits || cachedModel.metrics.totalBenefit || computedTotalBenefit;
          logger.info("[DocumentAgent] Using cached unified model metrics for PDF export:", {
            roi: cachedModel.metrics.roi,
            npv: cachedModel.metrics.npv,
            irr: cachedModel.metrics.irr,
            paybackMonths: cachedModel.metrics.paybackMonths,
          });
          // Note: ROI and IRR are already stored as percentages in the unified model
          return {
            roi: cachedModel.metrics.roi, // Already a percentage (e.g., 150 for 150%)
            npv: cachedModel.metrics.npv,
            paybackPeriod: cachedModel.metrics.paybackMonths / 12, // Convert months to years
            totalCost: cachedTotalCost,
            totalBenefit: cachedTotalBenefit,
            tco: cachedTotalCost,
            irr: cachedModel.metrics.irr || null, // Already a percentage
          };
        }
        // FALLBACK: Use original business case values (also stored as percentages)
        const fallbackTotalCost = parseNumeric(bc.totalCostEstimate);
        const fallbackTotalBenefit = parseNumeric(bc.totalBenefitEstimate);
        const fallbackPayback = parseNumeric(bc.paybackMonths);
        return {
          roi: parseNumeric(bc.roiPercentage), // Already a percentage
          npv: parseNumeric(bc.npvValue),
          paybackPeriod: fallbackPayback > 0 ? fallbackPayback / 12 : 0, // Convert months to years
          totalCost: fallbackTotalCost || resolvedTotalCost,
          totalBenefit: fallbackTotalBenefit || resolvedTotalBenefit,
          tco: resolvedTotalCost,
          irr: null,
        };
      })(),
      totalCostOfOwnership: resolvedTotalCost,
      detailedCosts: Array.isArray(detailedCosts) ? detailedCosts as BusinessCaseData["detailedCosts"] : [],
      detailedBenefits: Array.isArray(detailedBenefits) ? detailedBenefits as BusinessCaseData["detailedBenefits"] : [],
      strategicAlignment: {
        objectives: normalizedStrategicObjectives,
        departmentImpact: normalizedDepartmentImpact,
      },
      compliance: {
        requirements: Array.isArray(complianceRequirements) ? complianceRequirements as BusinessCaseData["compliance"]["requirements"] : [],
        policyReferences: Array.isArray(policyReferences) ? policyReferences : [],
      },
      governance: normalizedGovernance,
      kpis: normalizedKpis,
      measurementPlan: {
        cadence: measurementPlan.cadence || normalizedGovernance.cadence,
        owners: normalizedMeasurementOwners,
        kpis: normalizedMeasurementKpis.length > 0 ? normalizedMeasurementKpis : normalizedKpis.map((item) => ({
          name: item.name,
          baseline: item.baseline,
          target: item.target,
          owner: item.owner,
        })),
      },
      successCriteria: normalizedSuccessCriteria,
      stakeholders: getStakeholders(stakeholderAnalysis as StakeholderData | StakeholderData[] | null),
      risks: Array.isArray(identifiedRisks) ? identifiedRisks as BusinessCaseData["risks"] : [],
      riskLevel: bc.riskLevel || "medium",
      riskScore: bc.riskScore || 50,
      implementationRoadmap: {
        quickWins: quickWins.map(p => ({ action: p.action || p.name || "", timeline: p.timeline || "", owner: p.owner, impact: p.impact, effort: p.effort })),
        strategicInitiatives: strategicInitiatives.map(p => ({ action: p.action || p.name || "", timeline: p.timeline || "", owner: p.owner, impact: p.impact, effort: p.effort, dependencies: p.dependencies })),
        milestones: Array.isArray(milestones) ? milestones as BusinessCaseData["implementationRoadmap"]["milestones"] : [],
      },
      implementationPhases: Array.isArray(implementationPhases) ? (implementationPhases as ImplementationPhaseItem[]).map((p: ImplementationPhaseItem) => ({
        name: p.name || p.phaseName || p.phase || `Phase`,
        duration: p.duration || p.timeline || "",
        deliverables: [
          ...(Array.isArray(p.deliverables) ? p.deliverables.map(d => typeof d === "string" ? d : d.name || d.deliverable || "") : []),
          ...(p.description ? [p.description] : []),
          ...(Array.isArray(p.tasks) ? p.tasks.map((task: string | Record<string, unknown>) => typeof task === "string" ? task : asText(task.name || task.task)).filter(Boolean) : []),
          ...(p.owner ? [`Owner: ${p.owner}`] : []),
        ].filter(Boolean),
        startDate: p.startDate || "",
        endDate: p.endDate || "",
      })) : [],
      cashFlowProjection: (() => {
        if (Array.isArray(cachedModel?.cashFlows) && cachedModel.cashFlows.length > 0) {
          return cachedModel.cashFlows.map((row, idx) => ({
            year: typeof row.label === 'string' && row.label.trim() ? row.label : `Year ${row.year ?? idx}`,
            costs: Number(row.costs || 0),
            benefits: Number(row.benefits || 0),
            cumulative: Number(row.cumulativeCashFlow ?? row.cumulative ?? 0),
          }));
        }
        // Build cash flows from detailed costs and benefits (matching UI's buildCashFlows function)
        let cumulative = 0;
        return [0, 1, 2, 3, 4, 5].map((yearNum) => {
          const yearKey = `year${yearNum}`;

          // Sum all costs for this year from detailedCosts
          const yearCosts = (Array.isArray(detailedCosts) ? detailedCosts : []).reduce((sum: number, cost: DetailedCostItem) => {
            return sum + parseNumeric(cost[yearKey]);
          }, 0);

          // Sum all benefits for this year from detailedBenefits (no benefits in year 0)
          let yearBenefits = 0;
          if (yearNum !== 0) {
            yearBenefits = detailedBenefits.reduce((sum: number, benefit: DetailedBenefitItem) => {
              return sum + parseNumeric(benefit[yearKey]);
            }, 0);
          }

          const netCashFlow = yearBenefits - yearCosts;
          cumulative += netCashFlow;

          return {
            year: yearNum === 0 ? 'Year 0' : `Year ${yearNum}`,
            costs: yearCosts,
            benefits: yearBenefits,
            cumulative
          };
        });
      })(),
      assumptions: getAssumptions(keyAssumptions as AssumptionItem[]),
      dependencies: Array.isArray(projectDependencies)
        ? (projectDependencies as Array<string | DependencyItem>).map((d: string | DependencyItem) => typeof d === "string" ? d : d.dependency || d.description || d.name || asText(d))
        : [],
      recommendations: {
        decision: typeof recommendations === "string"
          ? normalizeInlineText(recommendations)
          : normalizeInlineText((recommendations as Record<string, string>).decision || (recommendations as Record<string, string>).recommendation || (recommendations as Record<string, string>).overallRecommendation || bc.recommendation || "Pending review"),
        rationale: typeof recommendations === "string"
          ? normalizeNarrativeText(bc.conclusionSummary || "")
          : normalizeNarrativeText((recommendations as Record<string, string>).rationale || (recommendations as Record<string, string>).justification || (recommendations as Record<string, string>).reasoning || ""),
        commercialCase: typeof recommendations === "string"
          ? ""
          : normalizeNarrativeText((recommendations as Record<string, string>).commercialCase || ""),
        publicValueCase: typeof recommendations === "string"
          ? ""
          : normalizeNarrativeText((recommendations as Record<string, string>).publicValueCase || ""),
        nextSteps: Array.isArray(nextSteps)
          ? (nextSteps as Array<string | NextStepItem>).map((s: string | NextStepItem) => {
              const rawText = typeof s === "string" ? s : s.action || s.step || s.description || "";
              return normalizeInlineText(rawText);
            })
          : [],
      },
      conclusionSummary: normalizeNarrativeText(bc.conclusionSummary || "") || undefined,
      qualityScore: bc.qualityScore,
    };

    const authoritativeInvestment = result.financialMetrics.totalCost || result.financialMetrics.tco || result.totalCostOfOwnership || 0;
    const paybackMonths = Math.max(0, Math.round(result.financialMetrics.paybackPeriod * 12));
    const summaryLead = takeSentences(result.conclusionSummary || result.executiveSummary || result.proposedSolution || result.problemStatement, 2);
    const npvClause = Number.isFinite(result.financialMetrics.npv)
      ? `, NPV ${formatFullCurrency(result.financialMetrics.npv)}`
      : "";
    const financialSentence = authoritativeInvestment > 0
      ? `Total investment: ${formatFullCurrency(authoritativeInvestment)}, ROI ${result.financialMetrics.roi.toFixed(1)}%${npvClause}.`
      : "";
    const governanceSentence = paybackMonths > 0
      ? `Payback modeled at ${paybackMonths} months; ${normalizeInlineText(result.governance.cadence || "monthly governance checkpoints").toLowerCase()} with named benefits ownership from mobilization.`
      : `Governance: ${normalizeInlineText(result.governance.cadence || "monthly governance checkpoints").toLowerCase()} with named benefits ownership from mobilization.`;

    result.executiveSummary = normalizeNarrativeText([
      summaryLead || `${normalizeInlineText(result.projectName)} should proceed as a governed program subject to stage gates, measurable outcomes, and controlled release approvals.`,
      financialSentence,
      governanceSentence,
    ].filter(Boolean).join(" "));
    result.backgroundContext = compressNarrative(result.backgroundContext, 8);
    result.problemStatement = compressNarrative(result.problemStatement, 6);
    result.proposedSolution = compressNarrative(result.proposedSolution, 6);
    result.businessRequirements = compressNarrative(result.businessRequirements, 8);
    result.assumptions = result.assumptions.map((item) => normalizeInlineText(item));
    result.dependencies = result.dependencies.map((item) => normalizeInlineText(item));
    result.expectedDeliverables = result.expectedDeliverables.map((item) => {
      if (typeof item === "string") return normalizeInlineText(item);
      return {
        ...item,
        name: normalizeInlineText(item.name || "Deliverable"),
        owner: normalizeInlineText(item.owner || ""),
        timeline: normalizeInlineText(item.timeline || ""),
        status: normalizeInlineText(item.status || ""),
      };
    });

    logger.info("[DocumentAgent] Extracted data summary:", {
      projectName: result.projectName,
      executiveSummaryLength: result.executiveSummary.length,
      backgroundContextLength: result.backgroundContext.length,
      problemStatementLength: result.problemStatement.length,
      proposedSolutionLength: result.proposedSolution.length,
      smartObjectivesCount: result.smartObjectives.length,
      scopeInCount: result.scopeDefinition.inScope.length,
      scopeOutCount: result.scopeDefinition.outOfScope.length,
      roi: result.financialMetrics.roi,
      npv: result.financialMetrics.npv,
      detailedCostsCount: result.detailedCosts.length,
      detailedBenefitsCount: result.detailedBenefits.length,
      risksCount: result.risks.length,
      stakeholdersCount: result.stakeholders.length,
      kpisCount: result.kpis.length,
      quickWinsCount: result.implementationRoadmap.quickWins.length,
      strategicInitiativesCount: result.implementationRoadmap.strategicInitiatives.length,
      assumptionsCount: result.assumptions.length,
      dependenciesCount: result.dependencies.length,
    });

    return result;
  }

  private async generatePDF(data: BusinessCaseData): Promise<Buffer> { // NOSONAR
    logger.info("[DocumentAgent] Starting comprehensive PDF generation");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Register Dubai fonts if available
    const fontFamily = this.registerDubaiFonts(doc);
    logger.info("[DocumentAgent] Using font family:", fontFamily);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;
    let pageNum = 1;

    const hexToRgb = (hex: string) => {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    // ============================================
    // UNIFIED DESIGN SYSTEM - Professional Report
    // ============================================

    // Typography - Single professional font family with readable sizes
    const FONTS = {
      FAMILY: fontFamily as "Dubai" | "helvetica",
      SIZES: {
        TITLE: 16,           // Document title only
        SECTION: 12,         // All section headers (uniform)
        SUBSECTION: 11,      // Sub-headers within sections
        BODY: 10,            // Standard body text (uniform)
        LABEL: 8,            // Labels, captions, badges
        SMALL: 7,            // Footnotes, metadata
      },
      COLORS: {
        PRIMARY: { r: 30, g: 41, b: 59 },      // Dark text
        SECONDARY: { r: 71, g: 85, b: 105 },   // Body text
        MUTED: { r: 100, g: 116, b: 139 },     // Light text
        LIGHT: { r: 148, g: 163, b: 184 },     // Disabled/hint text
      },
      LINE_HEIGHT: 1.4,
    };

    // Color Palette - Minimal corporate colors
    const PALETTE = {
      // Primary brand color (deep blue)
      PRIMARY: { r: 15, g: 76, b: 117 },
      PRIMARY_LIGHT: { r: 219, g: 234, b: 254 },
      // Secondary accent (teal/green)
      ACCENT: { r: 13, g: 148, b: 136 },
      ACCENT_LIGHT: { r: 204, g: 251, b: 241 },
      // Neutral greys
      GREY_50: { r: 249, g: 250, b: 251 },
      GREY_100: { r: 243, g: 244, b: 246 },
      GREY_200: { r: 229, g: 231, b: 235 },
      GREY_300: { r: 209, g: 213, b: 219 },
      GREY_600: { r: 75, g: 85, b: 99 },
      GREY_800: { r: 31, g: 41, b: 55 },
      // Status colors (used sparingly)
      SUCCESS: { r: 22, g: 163, b: 74 },
      WARNING: { r: 217, g: 119, b: 6 },
      DANGER: { r: 185, g: 28, b: 28 },
      WHITE: { r: 255, g: 255, b: 255 },
    };

    // Spacing system - consistent throughout
    const SPACING = {
      SECTION_GAP: 4,        // Between major sections
      INNER_PAD: 4,          // Inside cards/containers
      CARD_GAP: 4,           // Between cards
      LINE_GAP: 3.5,         // Between text lines
      TABLE_CELL: 2.5,       // Table cell padding
      HERO_PAD: 8,           // Extra padding around hero elements
    };

    // ============================================
    // VISUAL HIERARCHY - Decision Support Slides
    // ============================================
    // Each section has ONE dominant "hero" data point

    const HIERARCHY = {
      // Hero: The single most important data point - visually dominant
      HERO: {
        fontSize: 26,          // 2x larger than section headers
        labelSize: 10,         // Clear label for hero
        padding: 12,           // Generous white space
        color: PALETTE.PRIMARY,
      },
      // Secondary: Supporting data points - visually quieter
      SECONDARY: {
        fontSize: 14,
        labelSize: 8,
        padding: 6,
        color: PALETTE.GREY_600,
      },
      // Supporting: Tables and lists - de-emphasized but readable
      SUPPORTING: {
        fontSize: 8,           // Readable table text
        headerOpacity: 0.7,    // Lighter headers
        bgColor: PALETTE.GREY_50,
        borderColor: PALETTE.GREY_200,
      },
    };

    // Helper: Render a HERO metric (single dominant data point)
    // Returns consumed height for proper downstream layout
    function _renderHeroMetric(
      label: string,
      value: string,
      subtitle?: string,
      accentColor?: { r: number; g: number; b: number }
    ): number {
      const heroColor = accentColor || HIERARCHY.HERO.color;
      const heroWidth = contentWidth * 0.4;  // More compact width
      const heroX = margin + (contentWidth - heroWidth) / 2;
      const heroHeight = subtitle ? 24 : 20;  // Smaller, more refined

      // Hero container - clean professional look
      doc.setFillColor(PALETTE.WHITE.r, PALETTE.WHITE.g, PALETTE.WHITE.b);
      doc.setDrawColor(heroColor.r, heroColor.g, heroColor.b);
      doc.setLineWidth(0.3);
      doc.roundedRect(heroX, y, heroWidth, heroHeight, 2, 2, "FD");

      // Thin accent bar at top
      doc.setFillColor(heroColor.r, heroColor.g, heroColor.b);
      doc.rect(heroX, y, heroWidth, 2, "F");

      // Hero label (compact)
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setFontSize(FONTS.SIZES.LABEL);
      doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
      doc.text(label.toUpperCase(), heroX + heroWidth / 2, y + 7, { align: "center" });

      // Hero value (prominent but not oversized)
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setFontSize(18);  // Balanced size
      doc.setTextColor(heroColor.r, heroColor.g, heroColor.b);
      doc.text(value, heroX + heroWidth / 2, y + 15, { align: "center" });

      // Subtitle if provided
      if (subtitle) {
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setFontSize(FONTS.SIZES.SMALL);
        doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
        doc.text(subtitle, heroX + heroWidth / 2, y + 21, { align: "center" });
      }

      const consumed = heroHeight + 4;  // Tighter spacing
      y += consumed;
      return consumed;
    }

    // Helper: Render SECONDARY metrics (supporting data, visually quieter)
    // Fixed-width cards centered in row, handles any count gracefully
    const renderSecondaryMetrics = (
      metrics: Array<{ label: string; value: string; color?: { r: number; g: number; b: number } }>
    ): number => {
      const numMetrics = Math.min(metrics.length, 4);
      const maxCardWidth = 44;  // Slightly wider for larger fonts
      const cardGap = 4;
      const cardHeight = 18;    // Taller for larger fonts

      // Calculate centered position
      const totalWidth = numMetrics * maxCardWidth + (numMetrics - 1) * cardGap;
      const startX = margin + (contentWidth - totalWidth) / 2;

      metrics.slice(0, numMetrics).forEach((metric, idx) => {
        const cardX = startX + idx * (maxCardWidth + cardGap);

        // Light background, minimal border
        doc.setFillColor(PALETTE.GREY_50.r, PALETTE.GREY_50.g, PALETTE.GREY_50.b);
        doc.setDrawColor(PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b);
        doc.setLineWidth(0.1);
        doc.roundedRect(cardX, y, maxCardWidth, cardHeight, 2, 2, "FD");

        // Small label
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setFontSize(HIERARCHY.SECONDARY.labelSize);
        doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
        doc.text(metric.label, cardX + 3, y + 6);

        // Value
        const valueColor = metric.color || HIERARCHY.SECONDARY.color;
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setFontSize(HIERARCHY.SECONDARY.fontSize);
        doc.setTextColor(valueColor.r, valueColor.g, valueColor.b);
        doc.text(metric.value, cardX + 3, y + 14);
      });

      const consumed = cardHeight + 8;  // Add spacing after secondary row
      y += consumed;
      return consumed;
    };

    const setSectionFont = () => {
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setFontSize(FONTS.SIZES.SECTION);
      doc.setTextColor(FONTS.COLORS.PRIMARY.r, FONTS.COLORS.PRIMARY.g, FONTS.COLORS.PRIMARY.b);
    };

    const setBodyFont = () => {
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setFontSize(FONTS.SIZES.BODY);
      doc.setTextColor(FONTS.COLORS.SECONDARY.r, FONTS.COLORS.SECONDARY.g, FONTS.COLORS.SECONDARY.b);
    };

    const _setLabelFont = (bold: boolean = false) => {
      doc.setFont(FONTS.FAMILY, bold ? "bold" : "normal");
      doc.setFontSize(FONTS.SIZES.LABEL);
      doc.setTextColor(FONTS.COLORS.SECONDARY.r, FONTS.COLORS.SECONDARY.g, FONTS.COLORS.SECONDARY.b);
    };


    const addHeader = () => {
      doc.setFillColor(10, 38, 71);
      doc.rect(0, 0, pageWidth, 20, "F");

      if (this.logoBase64) {
        try {
          doc.addImage(this.logoBase64, "PNG", margin, 3, 14, 14);
        } catch {
          // Ignore logo rendering errors.
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.text("COREVIA", margin + 17, 10);
      doc.setFontSize(6);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.text("Enterprise Intelligence Platform", margin + 17, 14);

      doc.setFontSize(7);
      doc.text(`Generated: ${format(new Date(), "dd MMM yyyy")}`, pageWidth - margin - 35, 12);
    };

    const addFooter = () => {
      doc.setFillColor(248, 250, 252);
      doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
      doc.setDrawColor(226, 232, 240);
      doc.line(0, pageHeight - 10, pageWidth, pageHeight - 10);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6);
      doc.text("Confidential - For Management Review Only", margin, pageHeight - 4);
      doc.text(`Page ${pageNum}`, pageWidth - margin - 12, pageHeight - 4);
    };

    // Hook for autoTable's didDrawPage — autoTable has already created the new page,
    // so go back to the previous page for footer, then forward for header.
    const autoTablePageHook = () => {
      const currentPage = doc.getNumberOfPages();
      if (currentPage > 1) {
        doc.setPage(currentPage - 1);
        addFooter();
        doc.setPage(currentPage);
        pageNum++;
        addHeader();
      }
    };

    const newPage = () => {
      addFooter();
      doc.addPage();
      pageNum++;
      addHeader();
      return 28;
    };

    const checkPageBreak = (neededHeight: number): number => {
      if (y + neededHeight > pageHeight - 15) {
        return newPage();
      }
      return y;
    };

    // Unified section title - uses PALETTE for consistent styling
    const drawSectionTitle = (title: string, usePrimary: boolean = true) => {
      y = checkPageBreak(15);

      // Use only primary or accent color for sections
      const color = usePrimary ? PALETTE.PRIMARY : PALETTE.ACCENT;
      doc.setFillColor(color.r, color.g, color.b);
      doc.roundedRect(margin, y, 3, 8, 0.5, 0.5, "F");

      setSectionFont();
      doc.text(title, margin + 6, y + 6);

      y += 9;
    };

    const drawPageHeading = (title: string, subtitle?: string, usePrimary: boolean = true) => {
      const color = usePrimary ? PALETTE.PRIMARY : PALETTE.ACCENT;
      y = checkPageBreak(subtitle ? 20 : 14);
      doc.setFillColor(color.r, color.g, color.b);
      doc.roundedRect(margin, y, 3, 10, 0.75, 0.75, "F");
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setFontSize(FONTS.SIZES.TITLE);
      doc.setTextColor(FONTS.COLORS.PRIMARY.r, FONTS.COLORS.PRIMARY.g, FONTS.COLORS.PRIMARY.b);
      doc.text(title, margin + 6, y + 7);
      if (subtitle) {
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setFontSize(FONTS.SIZES.BODY - 1);
        doc.setTextColor(FONTS.COLORS.MUTED.r, FONTS.COLORS.MUTED.g, FONTS.COLORS.MUTED.b);
        doc.text(subtitle, margin + 6, y + 13);
        y += 17;
      } else {
        y += 11;
      }
      doc.setDrawColor(PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b);
      doc.setLineWidth(0.25);
      doc.line(margin, y, margin + 48, y);
      y += 5;
    };


    // Simplified section divider using palette colors
    const drawSectionDivider = (color: string) => {
      const c = hexToRgb(color);
      doc.setDrawColor(c.r, c.g, c.b);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + 40, y);
      y += 2;
    };

    // Unified padding constants (using SPACING system)
    const SIDE_PADDING = SPACING.INNER_PAD + 2;
    const TOP_PADDING = SPACING.INNER_PAD + 1;
    const BOTTOM_PADDING = SPACING.INNER_PAD - 1;
    const SECTION_GAP = SPACING.SECTION_GAP;

    const drawTextBlock = (text: string, maxLines: number = 20) => {
      if (!text) {
        doc.setTextColor(FONTS.COLORS.LIGHT.r, FONTS.COLORS.LIGHT.g, FONTS.COLORS.LIGHT.b);
        doc.setFontSize(FONTS.SIZES.BODY);
        doc.setFont(FONTS.FAMILY, "italic");
        doc.text("No information available", margin + SIDE_PADDING, y);
        y += 6;
        return;
      }

      setBodyFont();
      const textWidth = contentWidth - (SIDE_PADDING * 2);
      const lines = doc.splitTextToSize(text, textWidth);
      const displayLines = lines.slice(0, maxLines);

      for (const line of displayLines) {
        y = checkPageBreak(5);
        doc.text(line, margin + SIDE_PADDING, y);
        y += 4;
      }
      y += 1;
    };


    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `AED ${(val / 1000).toFixed(0)}K`;
      return `AED ${val.toFixed(0)}`;
    };

    const investmentValue = data.financialMetrics.totalCost || data.financialMetrics.tco || data.totalCostOfOwnership || 0;
    const conciseGovernanceCadence = (() => {
      const cadence = (data.governance.cadence || "Monthly stage-gate review").trim();
      if (/monthly/i.test(cadence)) return "Monthly stage-gate reviews";
      if (/weekly/i.test(cadence)) return "Weekly delivery reviews";
      return cadence.length > 30 ? `${cadence.substring(0, 27).trim()}...` : cadence;
    })();

    // ============================================
    // COVER PAGE - Premium Executive Design
    // ============================================
    doc.setFillColor(10, 38, 71);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    // Subtle geometric accent pattern (top-right)
    doc.setFillColor(15, 50, 85);
    doc.rect(pageWidth - 60, 0, 60, 80, "F");
    doc.setFillColor(20, 60, 95);
    doc.rect(pageWidth - 40, 0, 40, 50, "F");

    // Left accent bar
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 0, 4, pageHeight, "F");

    if (this.logoBase64) {
      try {
        doc.addImage(this.logoBase64, "PNG", margin + 10, 30, 35, 35);
      } catch {
        logger.info("[DocumentExport] Cover page logo skipped");
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.text("COREVIA", margin + 10, 90);

    doc.setFontSize(11);
    doc.setFont(FONTS.FAMILY, "normal");
    doc.setTextColor(148, 180, 210);
    doc.text("Human-Centered Enterprise Intelligence Platform", margin + 10, 100);

    // Accent divider line
    doc.setFillColor(20, 184, 166);
    doc.rect(margin + 10, 112, 50, 2, "F");

    // Document type badge
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(margin + 10, 125, 50, 10, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.text("BUSINESS CASE REPORT", margin + 12, 132);

    // Project title
    doc.setFontSize(20);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(255, 255, 255);
    const coverTitle = data.projectName.length > 80 ? data.projectName.substring(0, 77) + "..." : data.projectName;
    const titleLines = doc.splitTextToSize(coverTitle, contentWidth - 20);
    titleLines.slice(0, 3).forEach((line: string, idx: number) => {
      doc.text(line, margin + 10, 150 + idx * 10);
    });

    // Info panel
    const infoBoxWidth = contentWidth - 20;
    const infoBoxX = margin + 10;
    const infoBoxY = 185;

    doc.setFillColor(15, 50, 85);
    doc.setDrawColor(40, 70, 110);
    doc.setLineWidth(0.3);
    doc.roundedRect(infoBoxX, infoBoxY, infoBoxWidth, 60, 4, 4, "FD");

    // 2x3 info grid
    const infoColW = infoBoxWidth / 3;
    const infoItems = [
      { label: "Request ID", value: data.demandId, color: { r: 255, g: 255, b: 255 } },
      { label: "Date Generated", value: format(new Date(), "dd MMM yyyy"), color: { r: 255, g: 255, b: 255 } },
      { label: "Quality Score", value: data.qualityScore ? `${data.qualityScore}/100` : "N/A", color: { r: 20, g: 184, b: 166 } },
      { label: "Total Investment", value: formatCurrency(investmentValue), color: { r: 239, g: 68, b: 68 } },
      { label: "ROI", value: `${data.financialMetrics.roi.toFixed(1)}%`, color: data.financialMetrics.roi >= 0 ? { r: 16, g: 185, b: 129 } : { r: 239, g: 68, b: 68 } },
      { label: "Risk Level", value: data.riskLevel.toUpperCase(), color: data.riskLevel.toLowerCase().includes("high") ? { r: 239, g: 68, b: 68 } : data.riskLevel.toLowerCase().includes("low") ? { r: 16, g: 185, b: 129 } : { r: 245, g: 158, b: 11 } },
    ];

    infoItems.forEach((item, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const ix = infoBoxX + col * infoColW + 10;
      const iy = infoBoxY + row * 28 + 10;

      doc.setFontSize(7);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(120, 150, 180);
      doc.text(item.label.toUpperCase(), ix, iy);

      doc.setFontSize(12);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(item.color.r, item.color.g, item.color.b);
      doc.text(item.value, ix, iy + 10);
    });

    // Footer classification
    doc.setFontSize(7);
    doc.setTextColor(80, 100, 120);
    doc.text("Strictly Private & Confidential - For Management Review Only", margin + 10, pageHeight - 20);
    doc.setTextColor(60, 80, 100);
    doc.text("Governance-first AI architecture. Decision DNA technology. Built for UAE Data Sovereignty.", margin + 10, pageHeight - 14);

    doc.addPage();
    pageNum++;
    addHeader();
    y = 28;

    // ============================================
    // TABLE OF CONTENTS - Professional Navigation
    // ============================================
    doc.setFontSize(18);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(PALETTE.PRIMARY.r, PALETTE.PRIMARY.g, PALETTE.PRIMARY.b);
    doc.text("Table of Contents", margin, y);
    y += 4;

    // Decorative line under title
    doc.setFillColor(PALETTE.ACCENT.r, PALETTE.ACCENT.g, PALETTE.ACCENT.b);
    doc.rect(margin, y, 40, 1.5, "F");
    y += 10;

    const tocSections = [
      { num: "01", title: "Executive Summary", desc: "Project overview and key highlights" },
      { num: "02", title: "Background & Context", desc: "Problem statement, solution, and business requirements" },
      { num: "03", title: "Objectives & Scope", desc: "SMART objectives and scope definition" },
      { num: "04", title: "Financial Overview", desc: "Investment analysis, NPV, ROI, and 5-year projections" },
      { num: "05", title: "Cost & Benefit Breakdown", desc: "Detailed cost structure and benefit realization" },
      { num: "06", title: "Strategic Alignment", desc: "Strategic objectives and department impact" },
      { num: "07", title: "Risk Assessment", desc: "Risk matrix, identified risks, and mitigation strategies" },
      { num: "08", title: "Stakeholder Analysis", desc: "Stakeholder mapping and engagement strategy" },
      { num: "09", title: "Implementation Plan", desc: "Phases, milestones, and timeline" },
      { num: "10", title: "KPIs, Benefits & Success", desc: "KPIs, benefits realization, and success criteria" },
      { num: "11", title: "Compliance & Governance", desc: "Regulatory requirements and operating controls" },
      { num: "12", title: "Recommendation", desc: "Board decision, rationale, and immediate next steps" },
    ];

    tocSections.forEach((section) => {
      // Section number badge
      doc.setFillColor(PALETTE.PRIMARY.r, PALETTE.PRIMARY.g, PALETTE.PRIMARY.b);
      doc.roundedRect(margin, y, 10, 8, 1.5, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(section.num, margin + 5, y + 5.5, { align: "center" });

      // Section title
      doc.setFontSize(11);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(PALETTE.PRIMARY.r, PALETTE.PRIMARY.g, PALETTE.PRIMARY.b);
      doc.text(section.title, margin + 14, y + 4);

      // Section description
      doc.setFontSize(7.5);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
      doc.text(section.desc, margin + 14, y + 8);

      // Dotted line
      doc.setDrawColor(PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b);
      doc.setLineWidth(0.15);
      const lineStartX = margin + 14 + doc.getTextWidth(section.desc) + 3;
      if (lineStartX < pageWidth - margin - 5) {
        doc.setLineDashPattern([1, 1.5], 0);
        doc.line(lineStartX, y + 7, pageWidth - margin, y + 7);
        doc.setLineDashPattern([], 0);
      }

      y += 14;
    });

    // Document metadata at bottom of TOC
    y += 6;
    doc.setFillColor(PALETTE.GREY_50.r, PALETTE.GREY_50.g, PALETTE.GREY_50.b);
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont(FONTS.FAMILY, "normal");
    doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
    doc.text(`Document ID: ${data.demandId}`, margin + 4, y + 5);
    doc.text(`Generated: ${format(new Date(), "dd MMMM yyyy, HH:mm")}`, margin + 4, y + 10);
    doc.text(`Classification: Confidential - For Management Review Only`, margin + 4, y + 15);
    if (data.qualityScore) {
      doc.text(`Quality Score: ${data.qualityScore}/100`, margin + contentWidth / 2, y + 5);
    }

    // Start with Executive Summary on new page
    addFooter();
    doc.addPage();
    pageNum++;
    addHeader();
    y = 28;

    // Start with Executive Summary (Financial Overview removed per user request)
    drawSectionTitle("Executive Summary", true);
    drawSectionDivider(COLORS.primary);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    const execStartY = y;
    y += 6;

    const execCardGap = 4;
    const executiveCardWidths = [contentWidth * 0.42, (contentWidth - (contentWidth * 0.42) - (execCardGap * 2)) / 2, (contentWidth - (contentWidth * 0.42) - (execCardGap * 2)) / 2];
    const executiveHighlights = [
      {
        label: "Decision",
        value: data.recommendations.decision || "Proceed with Implementation",
        color: PALETTE.PRIMARY,
      },
      {
        label: "Investment",
        value: formatCurrency(investmentValue),
        color: { r: 220, g: 38, b: 38 },
      },
      {
        label: "Governance Cadence",
        value: conciseGovernanceCadence,
        color: PALETTE.ACCENT,
      },
    ];

    const executiveCardLineSets = executiveHighlights.map((item, idx) => doc.splitTextToSize(item.value, executiveCardWidths[idx]! - 10).slice(0, 3));
    const executiveCardHeight = Math.max(18, ...executiveCardLineSets.map((lines) => 11 + (lines.length * 4)));

    executiveHighlights.forEach((item, idx) => {
      const previousWidth = executiveCardWidths.slice(0, idx).reduce((sum, width) => sum + width, 0);
      const cardX = margin + previousWidth + (idx * execCardGap);
      const cardWidth = executiveCardWidths[idx]!;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX, y, cardWidth, executiveCardHeight, 2, 2, "FD");
      doc.setFillColor(item.color.r, item.color.g, item.color.b);
      doc.rect(cardX, y, 2.5, executiveCardHeight, "F");
      doc.setFontSize(6.5);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), cardX + 5, y + 5);
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(executiveCardLineSets[idx]!, cardX + 5, y + 10);
    });

    y += executiveCardHeight + 6;
    drawTextBlock(data.executiveSummary, 10);
    y += BOTTOM_PADDING;
    doc.roundedRect(margin, execStartY, contentWidth, y - execStartY, 1.5, 1.5, "D");
    y += SECTION_GAP;

    y = checkPageBreak(40);
    drawSectionTitle("Background & Context", true);
    drawSectionDivider(COLORS.primary);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    const bgStartY = y;
    y += TOP_PADDING;
    drawTextBlock(data.backgroundContext, 7);
    y += BOTTOM_PADDING;
    doc.roundedRect(margin, bgStartY, contentWidth, y - bgStartY, 1.5, 1.5, "D");
    y += SECTION_GAP;

    y = checkPageBreak(40);
    drawSectionTitle("Problem Statement", true);
    drawSectionDivider(COLORS.primary);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    const probStartY = y;
    y += TOP_PADDING;
    drawTextBlock(data.problemStatement, 6);
    y += BOTTOM_PADDING;
    doc.roundedRect(margin, probStartY, contentWidth, y - probStartY, 1.5, 1.5, "D");
    y += SECTION_GAP;

    y = checkPageBreak(40);
    drawSectionTitle("Solution Overview", false);
    drawSectionDivider(COLORS.accent);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    const solStartY = y;
    y += TOP_PADDING;
    drawTextBlock(data.proposedSolution, 6);
    y += BOTTOM_PADDING;
    doc.roundedRect(margin, solStartY, contentWidth, y - solStartY, 1.5, 1.5, "D");
    y += SECTION_GAP;

    // Business Requirements Section - formatted as bullet list
    if (data.businessRequirements?.trim()) {
      y = checkPageBreak(40);
      drawSectionTitle("Business Requirements", true);
      drawSectionDivider(COLORS.primary);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      const brStartY = y;
      y += TOP_PADDING;

      // Parse requirements into bullet points if they contain line breaks or bullet markers
      const reqText = data.businessRequirements.trim();
      const bulletMarkers = /(?:^|\n)\s*(?:[-•*]\s*|\d+\.\s*)/;
      const hasBullets = bulletMarkers.test(reqText);

      if (hasBullets) {
        // Split into lines and render as bullet list
        const reqLines = reqText.split(/\n/).filter(line => line.trim());
        doc.setFontSize(7);
        reqLines.slice(0, 6).forEach((line) => {
          y = checkPageBreak(6);
          const cleanLine = line.replace(/^\s*[-•*]\s*/, "").replace(/^\d+\.\s*/, "").trim();
          if (cleanLine) {
            doc.setFillColor(139, 92, 246);
            doc.circle(margin + 6, y + 1.5, 1.2, "F");
            doc.setFont(FONTS.FAMILY, "normal");
            doc.setTextColor(51, 65, 85);
            const textLines = doc.splitTextToSize(cleanLine, contentWidth - 16);
            textLines.slice(0, 1).forEach((tl: string) => {
              doc.text(tl, margin + 12, y + 2);
              y += 3.5;
            });
          }
        });
      } else {
        drawTextBlock(data.businessRequirements, 6);
      }

      y += BOTTOM_PADDING;
      doc.roundedRect(margin, brStartY, contentWidth, y - brStartY, 1.5, 1.5, "D");
      y += SECTION_GAP;
    }

    // Expected Deliverables Section
    if (data.expectedDeliverables.length > 0) {
      y = checkPageBreak(50);
      drawSectionTitle("Expected Deliverables", false);
      drawSectionDivider(COLORS.accent);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      const delStartY = y;
      y += 4;

      data.expectedDeliverables.slice(0, 6).forEach((del) => {
        y = checkPageBreak(14);

        const isStructured = typeof del === "object" && del !== null;
        const delObj = del as DeliverableItem;
        const delName = isStructured ? (delObj.name || delObj.deliverable || "Deliverable") : String(del);
        const delOwner = isStructured ? delObj.owner : null;
        const delTimeline = isStructured ? delObj.timeline : null;
        const delStatus = isStructured ? delObj.status : null;

        doc.setFillColor(20, 184, 166);
        doc.circle(margin + 6, y + 3, 1.5, "F");

        doc.setFontSize(7);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        const delLines = doc.splitTextToSize(delName, contentWidth - 50);
        doc.text(delLines[0] || "", margin + 12, y + 3.5);

        // Show status badge if available with canonical status mapping
        if (delStatus) {
          const statusLower = delStatus.toLowerCase().replaceAll("_", " ");
          let statusColor = { r: 148, g: 163, b: 184 };
          if (statusLower.includes("complete") || statusLower.includes("done")) {
            statusColor = { r: 34, g: 197, b: 94 };
          } else if (statusLower.includes("progress") || statusLower.includes("on track") || statusLower === "on_track") {
            statusColor = { r: 59, g: 130, b: 246 };
          } else if (statusLower.includes("delay") || statusLower.includes("at risk") || statusLower === "at_risk") {
            statusColor = { r: 239, g: 68, b: 68 };
          } else if (statusLower.includes("not started") || statusLower === "pending") {
            statusColor = { r: 251, g: 191, b: 36 };
          }
          doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
          doc.roundedRect(margin + contentWidth - 25, y + 0.5, 22, 5, 1, 1, "F");
          doc.setFontSize(5);
          doc.setTextColor(255, 255, 255);
          const displayStatus = delStatus.replaceAll("_", " ");
          const statusLines = doc.splitTextToSize(displayStatus, 20);
          doc.text(statusLines[0] || "", margin + contentWidth - 24, y + 3.5);
        }

        // Show owner and timeline on second line - render up to 2 lines
        let metaHeight = 0;
        if (delOwner || delTimeline) {
          doc.setFont(FONTS.FAMILY, "normal");
          doc.setFontSize(6);
          doc.setTextColor(100, 116, 139);
          const metaText = [delOwner && `Owner: ${delOwner}`, delTimeline && `Timeline: ${delTimeline}`].filter(Boolean).join(" | ");
          const metaLines = doc.splitTextToSize(metaText, contentWidth - 30);
          const linesToRender = metaLines.slice(0, 1);
          linesToRender.forEach((line: string, lineIdx: number) => {
            doc.text(line, margin + 12, y + 7 + (lineIdx * 3));
          });
          metaHeight = 5 + (linesToRender.length - 1) * 3;
        }

        y += (delOwner || delTimeline) ? 8 + metaHeight : 8;
      });

      y += 2;
      doc.roundedRect(margin, delStartY, contentWidth, y - delStartY, 1.5, 1.5, "D");
      y += SECTION_GAP;
    }

    // ============================================
    // OBJECTIVES & SCOPE - CONTINUES ON CURRENT PAGE WHEN SPACE ALLOWS
    // ============================================
    if (data.smartObjectives.length > 0 || data.scopeDefinition.inScope.length > 0) {
      y = checkPageBreak(85);
      y += 2;

      drawPageHeading("Objectives & Scope", "Objectives, scope boundaries, and decision framing");

      // ── SECTION 1: SMART Objectives with full details ──
      if (data.smartObjectives.length > 0) {
        doc.setFontSize(10);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("SMART Objectives", margin, y);
        y += 5;

        // Show up to 4 objectives with full SMART details
        data.smartObjectives.slice(0, 3).forEach((obj, idx) => {
          // Card with amber accent
          const cardHeight = 30;
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(251, 191, 36);
          doc.setLineWidth(0.4);
          doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, "FD");

          // Left accent bar
          doc.setFillColor(251, 191, 36);
          doc.rect(margin, y + 2, 2.5, cardHeight - 4, "F");

          // Objective title
          doc.setFontSize(8);
          doc.setFont(FONTS.FAMILY, "bold");
          doc.setTextColor(30, 41, 59);
          const objText = obj.objective || `Objective ${idx + 1}`;
          const objLines = doc.splitTextToSize(objText, contentWidth - 10);
          doc.text(objLines.slice(0, 1).join(" "), margin + 6, y + 6);

          // SMART dimensions in 5-column grid
          const dimY = y + 10;
          const dimWidth = (contentWidth - 10) / 5;

          const smartDims = [
            { letter: "S", label: "Specific", value: obj.specific, color: { r: 59, g: 130, b: 246 } },
            { letter: "M", label: "Measurable", value: obj.measurable, color: { r: 16, g: 185, b: 129 } },
            { letter: "A", label: "Achievable", value: obj.achievable, color: { r: 139, g: 92, b: 246 } },
            { letter: "R", label: "Relevant", value: obj.relevant, color: { r: 236, g: 72, b: 153 } },
            { letter: "T", label: "Time-bound", value: obj.timeBound, color: { r: 245, g: 158, b: 11 } },
          ];

          smartDims.forEach((dim, dIdx) => {
            const dimX = margin + 5 + dIdx * dimWidth;

            // Letter badge
            doc.setFillColor(dim.color.r, dim.color.g, dim.color.b);
            doc.roundedRect(dimX, dimY, 6, 4, 1, 1, "F");
            doc.setFontSize(5);
            doc.setFont(FONTS.FAMILY, "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(dim.letter, dimX + 2, dimY + 3);

            // Label
            doc.setFontSize(5);
            doc.setFont(FONTS.FAMILY, "bold");
            doc.setTextColor(dim.color.r, dim.color.g, dim.color.b);
            doc.text(dim.label, dimX + 8, dimY + 3);

            // Value (2 lines max)
            if (dim.value) {
              doc.setFont(FONTS.FAMILY, "normal");
              doc.setTextColor(71, 85, 105);
              const valLines = doc.splitTextToSize(dim.value, dimWidth - 4);
              valLines.slice(0, 1).forEach((line: string, lIdx: number) => {
                doc.text(line, dimX, dimY + 8 + lIdx * 4);
              });
            }
          });

          y += cardHeight + 2;
        });

        y += 2;
      }

      // ── SECTION 2: Scope Definition with full text ──
      if (data.scopeDefinition.inScope.length > 0 || data.scopeDefinition.outOfScope.length > 0) {
        doc.setFontSize(10);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("Scope Definition", margin, y);
        y += 5;

        const halfWidth = (contentWidth - 6) / 2;

        // Headers
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(134, 239, 172);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, halfWidth, 6, 1.5, 1.5, "FD");
        doc.setFontSize(8);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(22, 163, 74);
        doc.text("In Scope", margin + 3, y + 4.5);

        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(252, 165, 165);
        doc.roundedRect(margin + halfWidth + 6, y, halfWidth, 6, 1.5, 1.5, "FD");
        doc.setTextColor(220, 38, 38);
        doc.text("Out of Scope", margin + halfWidth + 9, y + 4.5);

        y += 8;
        const scopeStartY = y;

        // In Scope items with full text wrapping
        doc.setFontSize(6.5);
        doc.setFont(FONTS.FAMILY, "normal");
        let leftY = scopeStartY;
        const inScopeItems = data.scopeDefinition.inScope.slice(0, 8);
        inScopeItems.forEach((item) => {
          doc.setFillColor(34, 197, 94);
          doc.circle(margin + 3, leftY + 1, 0.8, "F");
          doc.setTextColor(51, 65, 85);
          const itemLines = doc.splitTextToSize(item, halfWidth - 8);
          itemLines.slice(0, 1).forEach((line: string, lIdx: number) => {
            doc.text(line, margin + 6, leftY + 2 + lIdx * 3.5);
          });
          leftY += 4.5;
        });

        // Out of Scope items with full text wrapping
        let rightY = scopeStartY;
        const outScopeItems = data.scopeDefinition.outOfScope.slice(0, 8);
        outScopeItems.forEach((item) => {
          doc.setFillColor(239, 68, 68);
          doc.circle(margin + halfWidth + 9, rightY + 1, 0.8, "F");
          doc.setTextColor(51, 65, 85);
          const itemLines = doc.splitTextToSize(item, halfWidth - 8);
          itemLines.slice(0, 1).forEach((line: string, lIdx: number) => {
            doc.text(line, margin + halfWidth + 12, rightY + 2 + lIdx * 3.5);
          });
          rightY += 4.5;
        });

        y = Math.max(leftY, rightY) + 4;
      }
    }

    // ============================================
    // FINANCIAL OVERVIEW - DEDICATED SINGLE PAGE
    // ============================================
    addFooter();
    doc.addPage();
    pageNum++;
    addHeader();
    y = 28;

    drawPageHeading("Financial Overview", "Investment analysis, 5-year cash flow, and scenario position");

    const tcoValue = data.financialMetrics.tco || data.financialMetrics.totalCost || 0;
    const npvValue = data.financialMetrics.npv;

    // ── SECTION 1: Key Financial Metrics (2x3 grid) ──
    const metricBoxWidth = (contentWidth - 8) / 3;
    const metricBoxHeight = 22;

    const keyMetrics = [
      { label: "Net Present Value", value: formatCurrency(npvValue), color: npvValue >= 0 ? { r: 16, g: 185, b: 129 } : { r: 220, g: 38, b: 38 }, primary: true },
      { label: "Return on Investment", value: `${data.financialMetrics.roi.toFixed(1)}%`, color: data.financialMetrics.roi >= 0 ? { r: 16, g: 185, b: 129 } : { r: 220, g: 38, b: 38 }, primary: true },
      { label: "Payback Period", value: data.financialMetrics.paybackPeriod > 0 ? `${data.financialMetrics.paybackPeriod.toFixed(1)} Years` : "N/A", color: { r: 71, g: 85, b: 105 }, primary: false },
      { label: "Total Investment", value: formatCurrency(tcoValue), color: { r: 220, g: 38, b: 38 }, primary: false },
      { label: "Total Benefits", value: formatCurrency(data.financialMetrics.totalBenefit || 0), color: { r: 16, g: 185, b: 129 }, primary: false },
      { label: "Net Benefit", value: formatCurrency((data.financialMetrics.totalBenefit || 0) - tcoValue), color: (data.financialMetrics.totalBenefit || 0) - tcoValue >= 0 ? { r: 16, g: 185, b: 129 } : { r: 220, g: 38, b: 38 }, primary: false },
    ];

    keyMetrics.forEach((m, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const mX = margin + col * (metricBoxWidth + 4);
      const mY = y + row * (metricBoxHeight + 4);

      // Box background
      doc.setFillColor(m.primary ? 248 : 255, m.primary ? 250 : 255, m.primary ? 252 : 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(mX, mY, metricBoxWidth, metricBoxHeight, 2, 2, "FD");

      // Label
      doc.setFontSize(7);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), mX + 4, mY + 6);

      // Value
      doc.setFontSize(m.primary ? 14 : 12);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(m.color.r, m.color.g, m.color.b);
      doc.text(m.value, mX + 4, mY + 17);
    });

    y += (metricBoxHeight + 4) * 2 + 8;

    // 5-Year Value Trajectory Chart with Break-Even Point
    // Use actual cash flow data from the saved financial model
    logger.info("[DocumentExport] Using actual cash flow projection data:", data.cashFlowProjection);

    // Build chart data from actual saved cash flows
    let breakEvenYear = -1;
    const computedCashFlows = data.cashFlowProjection.map((row, idx) => {
      const year = idx;
      const costs = row.costs || 0;
      const benefits = row.benefits || 0;
      const netCashFlow = benefits - costs;
      const cumulativeCashFlow = row.cumulative || 0;

      // Detect break-even point (first year where cumulative goes from negative to positive)
      if (breakEvenYear === -1 && idx > 0) {
        const prevCumulative = data.cashFlowProjection[idx - 1]?.cumulative || 0;
        if (prevCumulative < 0 && cumulativeCashFlow >= 0) {
          breakEvenYear = year;
        }
      }

      return {
        year: year,
        costs: costs,
        benefits: benefits,
        netCashFlow: Math.round(netCashFlow),
        cumulativeCashFlow: Math.round(cumulativeCashFlow)
      };
    });

    logger.info("[DocumentExport] Break-even year detected:", breakEvenYear);

    // Build annotations for break-even point and zero line
    const annotations: ChartAnnotations = {
      zeroLine: {
        type: "line",
        yMin: 0,
        yMax: 0,
        borderColor: "#ef4444",
        borderWidth: 2,
        borderDash: [6, 4],
        label: {
          display: true,
          content: "Break-Even Line",
          position: "end",
          backgroundColor: "#ef4444",
          color: "#ffffff",
          font: { size: 12, weight: "bold" }
        }
      }
    };

    // Add break-even point annotation if detected
    if (breakEvenYear > 0) {
      annotations.breakEvenPoint = {
        type: "point",
        xValue: `Y${breakEvenYear}`,
        yValue: computedCashFlows[breakEvenYear]!.cumulativeCashFlow,
        backgroundColor: "#22c55e",
        borderColor: "#16a34a",
        borderWidth: 3,
        radius: 10
      };
      annotations.breakEvenLabel = {
        type: "label",
        xValue: `Y${breakEvenYear}`,
        yValue: computedCashFlows[breakEvenYear]!.cumulativeCashFlow,
        content: [`BREAK-EVEN`, `Year ${breakEvenYear}`],
        backgroundColor: "rgba(34, 197, 94, 0.9)",
        color: "#ffffff",
        font: { size: 11, weight: "bold" },
        padding: 6,
        yAdjust: -35
      };
    }

    // Generate combo chart with bars (net cash flow) + line (cumulative) + break-even
    const chartConfig = {
      type: "bar",
      data: {
        labels: computedCashFlows.map(cf => `Y${cf.year}`),
        datasets: [
          {
            type: "bar",
            label: "Annual Net Cash Flow",
            data: computedCashFlows.map(cf => cf.netCashFlow),
            backgroundColor: computedCashFlows.map(cf => cf.netCashFlow >= 0 ? "rgba(34, 197, 94, 0.7)" : "rgba(239, 68, 68, 0.7)"),
            borderColor: computedCashFlows.map(cf => cf.netCashFlow >= 0 ? "#16a34a" : "#dc2626"),
            borderWidth: 2,
            borderRadius: 4,
            order: 2
          },
          {
            type: "line",
            label: "Cumulative Value",
            data: computedCashFlows.map(cf => cf.cumulativeCashFlow),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            fill: true,
            tension: 0.3,
            borderWidth: 4,
            pointRadius: 8,
            pointBackgroundColor: computedCashFlows.map(cf => cf.cumulativeCashFlow >= 0 ? "#22c55e" : "#ef4444"),
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: {
          padding: { top: 20, right: 25, bottom: 15, left: 15 }
        },
        plugins: {
          title: {
            display: true,
            text: "5-Year Value Trajectory with Break-Even Analysis",
            font: { size: 22, weight: "bold" },
            color: "#1e293b",
            padding: { bottom: 20 }
          },
          subtitle: {
            display: true,
            text: breakEvenYear > 0 ? `Break-even achieved in Year ${breakEvenYear}` : "Break-even not yet achieved",
            font: { size: 14 },
            color: breakEvenYear > 0 ? "#16a34a" : "#dc2626",
            padding: { bottom: 10 }
          },
          legend: {
            display: true,
            position: "top",
            labels: {
              font: { size: 12 },
              usePointStyle: true,
              padding: 15
            }
          },
          annotation: {
            annotations: annotations
          }
        },
        scales: {
          x: {
            grid: { display: true, color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: 14, weight: "bold" },
              color: "#475569",
              padding: 10
            },
            title: {
              display: true,
              text: "Project Year",
              font: { size: 14, weight: "bold" },
              color: "#334155"
            }
          },
          y: {
            grid: { display: true, color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: 12 },
              color: "#475569",
              padding: 10,
              callback: function(value: number) {
                if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + "M";
                if (Math.abs(value) >= 1000) return (value / 1000).toFixed(0) + "K";
                return value;
              }
            },
            title: {
              display: true,
              text: "Value (AED)",
              font: { size: 14, weight: "bold" },
              color: "#334155"
            }
          }
        }
      }
    };

    // ── SECTION 2: 5-Year Value Trajectory Chart ──
    doc.setFontSize(10);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("5-Year Value Trajectory", margin, y);
    y += 5;

    const chartImage = await generateChartImage(chartConfig);

    if (chartImage) {
      doc.addImage(chartImage, "PNG", margin, y, contentWidth, 55);
      y += 58;
    } else {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, y, contentWidth, 40, 2, 2, "FD");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Chart unavailable", margin + contentWidth / 2 - 15, y + 20);
      y += 43;
    }

    // ── SECTION 3: Scenario Analysis ──
    doc.setFontSize(10);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Scenario Analysis", margin, y);
    y += 5;

    const baseNpv = data.financialMetrics.npv || 0;
    const scenarios = [
      { name: "Best Case", npv: baseNpv * 1.2, roi: data.financialMetrics.roi * 1.15, color: { r: 22, g: 163, b: 74 }, bg: { r: 240, g: 253, b: 244 } },
      { name: "Base Case", npv: baseNpv, roi: data.financialMetrics.roi, color: { r: 71, g: 85, b: 105 }, bg: { r: 248, g: 250, b: 252 } },
      { name: "Worst Case", npv: baseNpv * 0.6, roi: data.financialMetrics.roi * 0.7, color: { r: 185, g: 28, b: 28 }, bg: { r: 254, g: 242, b: 242 } },
    ];

    const scWidth = (contentWidth - 8) / 3;
    scenarios.forEach((sc, i) => {
      const scX = margin + i * (scWidth + 4);
      doc.setFillColor(sc.bg.r, sc.bg.g, sc.bg.b);
      doc.setDrawColor(sc.color.r, sc.color.g, sc.color.b);
      doc.setLineWidth(0.5);
      doc.roundedRect(scX, y, scWidth, 18, 2, 2, "FD");

      // Scenario name
      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(sc.color.r, sc.color.g, sc.color.b);
      doc.text(sc.name, scX + 4, y + 6);

      // NPV and ROI
      doc.setFontSize(7);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`NPV: ${formatCurrency(sc.npv)}`, scX + 4, y + 12);
      doc.text(`ROI: ${sc.roi.toFixed(1)}%`, scX + 4, y + 16);
    });
    y += 22;

    // Calculate all the metrics matching the UI's fiveYearProjections calculation
    const discountRate = 0.08; // 8% standard discount rate

    // Build yearly projections from cash flow data with proper calculations
    const yearlyProjections: Array<{
      year: number;
      yearLabel: string;
      revenue: number;
      costs: number;
      netCashFlow: number;
      cumulativeCashFlow: number;
      operatingMargin: number;
      yoyGrowth: number;
      discountFactor: number;
      presentValue: number;
    }> = [];

    let cumulativeCF = 0;
    data.cashFlowProjection.forEach((row, idx) => {
      const revenue = row.benefits || 0;
      const costs = row.costs || 0;
      const netCashFlow = revenue - costs;
      cumulativeCF += netCashFlow;

      const operatingMargin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;
      const prevRevenue = idx > 0 ? (data.cashFlowProjection[idx - 1]?.benefits || 0) : 0;
      const yoyGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      const year = idx;
      const discountFactor = Math.pow(1 + discountRate, -year);

      yearlyProjections.push({
        year,
        yearLabel: year === 0 ? 'Year 0' : `Year ${year}`,
        revenue,
        costs,
        netCashFlow,
        cumulativeCashFlow: cumulativeCF,
        operatingMargin,
        yoyGrowth,
        discountFactor,
        presentValue: netCashFlow * discountFactor
      });
    });

    // Summary metrics matching UI calculation
    const projTotalRevenue = yearlyProjections.reduce((sum, p) => sum + p.revenue, 0);
    const projTotalCosts = yearlyProjections.reduce((sum, p) => sum + p.costs, 0);
    const avgOperatingMargin = projTotalRevenue > 0 ? ((projTotalRevenue - projTotalCosts) / projTotalRevenue) * 100 : 0;
    const efficiencyRatio = projTotalCosts > 0 ? projTotalRevenue / projTotalCosts : 0;
    const lastProjection = yearlyProjections.at(-1);
    const cagr = yearlyProjections.length > 2 && (yearlyProjections[1]?.revenue ?? 0) > 0 && (lastProjection?.revenue ?? 0) > 0
      ? (Math.pow(lastProjection!.revenue / yearlyProjections[1]!.revenue, 1 / 4) - 1) * 100
      : 0;
    const totalPresentValue = yearlyProjections.reduce((sum, p) => sum + p.presentValue, 0);

    // ── SECTION 4: 5-Year Projections Table ──
    doc.setFontSize(10);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("5-Year Cash Flow Projections", margin, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [["Year", "Benefits", "Costs", "Net Cash Flow", "Cumulative", "Margin"]],
      body: yearlyProjections.map((proj) => [
        proj.yearLabel,
        formatCurrency(proj.revenue),
        formatCurrency(proj.costs),
        formatCurrency(proj.netCashFlow),
        formatCurrency(proj.cumulativeCashFlow),
        proj.revenue > 0 ? `${proj.operatingMargin.toFixed(0)}%` : '-'
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 22, halign: "left" },
        1: { cellWidth: 28, halign: "right", textColor: [16, 185, 129] },
        2: { cellWidth: 26, halign: "right", textColor: [220, 38, 38] },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right", textColor: [37, 99, 235] },
        5: { cellWidth: 20, halign: "right", textColor: [71, 85, 105] },
      },
      margin: { left: margin, right: margin },
      theme: "striped",
      didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
      didParseCell: function(hookData: unknown) {
        const data = hookData as AutoTableCellHookData;
        if (data.column.index === 3 && data.section === 'body') {
          const value = parseNumeric(String(data.cell.raw).replaceAll(/[^0-9.-]/g, ''));
          (data.cell.styles as { textColor?: number[] }).textColor = value < 0 ? [220, 38, 38] : [16, 185, 129];
        }
      }
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // ── SECTION 5: Key Performance Indicators ──
    doc.setFontSize(10);
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Key Performance Indicators", margin, y);
    y += 5;

    const kpiMetrics = [
      { label: "Operating Margin", value: `${avgOperatingMargin.toFixed(1)}%`, desc: "Avg. annual margin" },
      { label: "Efficiency Ratio", value: `${efficiencyRatio.toFixed(2)}x`, desc: "Benefit per AED invested" },
      { label: "Growth Rate (CAGR)", value: `${cagr.toFixed(1)}%`, desc: "Compound annual growth" },
      { label: "Present Value", value: formatCurrency(totalPresentValue), desc: "Total discounted value" },
    ];

    const kpiWidth = (contentWidth - 12) / 4;
    kpiMetrics.forEach((kpi, idx) => {
      const kX = margin + idx * (kpiWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(kX, y, kpiWidth, 20, 2, 2, "FD");

      doc.setFontSize(6);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label.toUpperCase(), kX + 3, y + 5);

      doc.setFontSize(11);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(kpi.value, kX + 3, y + 13);

      doc.setFontSize(5);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(kpi.desc, kX + 3, y + 18);
    });

    // ============================================
    // DETAILED COST & BENEFIT BREAKDOWN - NEW PAGE
    // ============================================
    if (data.detailedCosts.length > 0 || data.detailedBenefits.length > 0) {
      addFooter();
      doc.addPage();
      pageNum++;
      addHeader();
      y = 28;

      drawPageHeading("Cost & Benefit Breakdown", "Detailed investment structure and benefit realization schedule");

      // ── Cost Breakdown Table ──
      if (data.detailedCosts.length > 0) {
        doc.setFontSize(11);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(PALETTE.DANGER.r, PALETTE.DANGER.g, PALETTE.DANGER.b);
        doc.text("Investment Cost Structure", margin, y);
        y += 5;

        // Prepare cost data with year columns
        const costRows = data.detailedCosts.map((cost) => {
          const y0 = parseNumeric(cost.year0);
          const y1 = parseNumeric(cost.year1);
          const y2 = parseNumeric(cost.year2);
          const y3 = parseNumeric(cost.year3);
          const y4 = parseNumeric(cost.year4);
          const y5 = parseNumeric(cost.year5);
          const total = y0 + y1 + y2 + y3 + y4 + y5;
          return [
            cost.name || cost.description || "Cost Item",
            cost.category || "—",
            y0 > 0 ? formatCurrency(y0) : "—",
            y1 > 0 ? formatCurrency(y1) : "—",
            y2 > 0 ? formatCurrency(y2) : "—",
            y3 > 0 ? formatCurrency(y3) : "—",
            y4 > 0 ? formatCurrency(y4) : "—",
            y5 > 0 ? formatCurrency(y5) : "—",
            formatCurrency(total),
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [["Cost Item", "Category", "Year 0", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Total"]],
          body: costRows,
          styles: {
            fontSize: 6.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [185, 28, 28],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 6.5,
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 41, halign: "left", fontStyle: "bold" },
            1: { cellWidth: 13, halign: "center", fontSize: 5.8 },
            2: { cellWidth: 15, halign: "right" },
            3: { cellWidth: 15, halign: "right" },
            4: { cellWidth: 15, halign: "right" },
            5: { cellWidth: 15, halign: "right" },
            6: { cellWidth: 15, halign: "right" },
            7: { cellWidth: 15, halign: "right" },
            8: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [185, 28, 28] },
          },
          margin: { left: margin, right: margin },
          theme: "striped",
          alternateRowStyles: { fillColor: [254, 242, 242] },
          didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      // ── Benefit Realization Table ──
      if (data.detailedBenefits.length > 0) {
        y = checkPageBreak(50);
        doc.setFontSize(11);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(PALETTE.SUCCESS.r, PALETTE.SUCCESS.g, PALETTE.SUCCESS.b);
        doc.text("Benefit Realization Schedule", margin, y);
        y += 5;

        const benefitRows = data.detailedBenefits.map((benefit) => {
          const y1 = parseNumeric(benefit.year1);
          const y2 = parseNumeric(benefit.year2);
          const y3 = parseNumeric(benefit.year3);
          const y4 = parseNumeric(benefit.year4);
          const y5 = parseNumeric(benefit.year5);
          const total = y1 + y2 + y3 + y4 + y5;
          return [
            benefit.name || benefit.description || "Benefit Item",
            benefit.category || "—",
            benefit.confidence || "—",
            y1 > 0 ? formatCurrency(y1) : "—",
            y2 > 0 ? formatCurrency(y2) : "—",
            y3 > 0 ? formatCurrency(y3) : "—",
            y4 > 0 ? formatCurrency(y4) : "—",
            y5 > 0 ? formatCurrency(y5) : "—",
            formatCurrency(total),
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [["Benefit Item", "Category", "Confidence", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Total"]],
          body: benefitRows,
          styles: {
            fontSize: 6.5,
            cellPadding: 1.8,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [22, 163, 74],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 6.5,
            halign: "center",
          },
          columnStyles: {
            0: { cellWidth: 40, halign: "left", fontStyle: "bold" },
            1: { cellWidth: 13, halign: "center", fontSize: 5.8 },
            2: { cellWidth: 11, halign: "center", fontSize: 5.8 },
            3: { cellWidth: 15, halign: "right" },
            4: { cellWidth: 15, halign: "right" },
            5: { cellWidth: 15, halign: "right" },
            6: { cellWidth: 15, halign: "right" },
            7: { cellWidth: 15, halign: "right" },
            8: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [22, 163, 74] },
          },
          margin: { left: margin, right: margin },
          theme: "striped",
          alternateRowStyles: { fillColor: [240, 253, 244] },
          didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      // Cost vs Benefit Summary Comparison
      y = checkPageBreak(35);
      doc.setFontSize(10);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Investment vs. Return Summary", margin, y);
      y += 5;

      const summaryBarWidth = contentWidth - 8;
      const totalCostVal = data.financialMetrics.tco || data.financialMetrics.totalCost || 0;
      const totalBenefitVal = data.financialMetrics.totalBenefit || 0;
      const maxBarVal = Math.max(totalCostVal, totalBenefitVal, 1);

      // Cost bar
      const costBarLen = (totalCostVal / maxBarVal) * (summaryBarWidth - 40);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(margin + 4, y, summaryBarWidth, 12, 2, 2, "F");
      doc.setFillColor(220, 38, 38);
      doc.roundedRect(margin + 4, y, Math.max(costBarLen, 10), 12, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`Total Investment: ${formatCurrency(totalCostVal)}`, margin + 8, y + 7.5);
      y += 16;

      // Benefit bar
      const benefitBarLen = (totalBenefitVal / maxBarVal) * (summaryBarWidth - 40);
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin + 4, y, summaryBarWidth, 12, 2, 2, "F");
      doc.setFillColor(22, 163, 74);
      doc.roundedRect(margin + 4, y, Math.max(benefitBarLen, 10), 12, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`Total Benefits: ${formatCurrency(totalBenefitVal)}`, margin + 8, y + 7.5);
      y += 16;

      // Net value
      const netValue = totalBenefitVal - totalCostVal;
      const netColor = netValue >= 0 ? PALETTE.SUCCESS : PALETTE.DANGER;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin + 4, y, summaryBarWidth, 10, 2, 2, "F");
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(netColor.r, netColor.g, netColor.b);
      doc.text(`Net Value: ${formatCurrency(netValue)}  |  ROI: ${data.financialMetrics.roi.toFixed(1)}%`, margin + 8, y + 7);
      y += 14;
    }

    // ============================================
    // STRATEGIC ALIGNMENT - NEW SECTION
    // ============================================
    if (data.strategicAlignment.objectives.length > 0 || data.strategicAlignment.departmentImpact.length > 0) {
      y = checkPageBreak(60);
      drawSectionTitle("Strategic Alignment", true);
      drawSectionDivider(COLORS.primary);

      const stratStartY = y;
      const stratStartPage = doc.getNumberOfPages();
      y += 4;

      // Strategic Objectives
      if (data.strategicAlignment.objectives.length > 0) {
        doc.setFontSize(9);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("Strategic Objectives", margin + 4, y);
        y += 5;

        data.strategicAlignment.objectives.slice(0, 6).forEach((obj, idx) => {
          y = checkPageBreak(12);
          const objName = obj.name || obj.objective || `Objective ${idx + 1}`;
          const objDesc = obj.description || obj.alignment || "";

          // Numbered circle
          doc.setFillColor(PALETTE.PRIMARY.r, PALETTE.PRIMARY.g, PALETTE.PRIMARY.b);
          doc.circle(margin + 8, y + 2, 3, "F");
          doc.setFontSize(7);
          doc.setFont(FONTS.FAMILY, "bold");
          doc.setTextColor(255, 255, 255);
          doc.text(String(idx + 1), margin + 8, y + 3, { align: "center" });

          // Objective name
          doc.setFontSize(8);
          doc.setFont(FONTS.FAMILY, "bold");
          doc.setTextColor(51, 65, 85);
          const nameLines = doc.splitTextToSize(objName, contentWidth - 20);
          doc.text(nameLines[0] || "", margin + 14, y + 3);

          // Description
          if (objDesc) {
            doc.setFontSize(7);
            doc.setFont(FONTS.FAMILY, "normal");
            doc.setTextColor(100, 116, 139);
            const descLines = doc.splitTextToSize(objDesc, contentWidth - 20);
            descLines.slice(0, 2).forEach((line: string, lIdx: number) => {
              doc.text(line, margin + 14, y + 7 + lIdx * 3.5);
            });
            y += 8 + Math.min(descLines.length, 2) * 3.5;
          } else {
            y += 8;
          }
        });
        y += 4;
      }

      // Department Impact
      if (data.strategicAlignment.departmentImpact.length > 0) {
        y = checkPageBreak(30);
        doc.setFontSize(9);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("Department Impact Assessment", margin + 4, y);
        y += 5;

        autoTable(doc, {
          startY: y,
          head: [["Department", "Impact", "Type"]],
          body: data.strategicAlignment.departmentImpact.slice(0, 8).map((di) => [
            di.department || "—",
            di.impact || "—",
            di.type || "Direct",
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [226, 232, 240],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [PALETTE.PRIMARY.r, PALETTE.PRIMARY.g, PALETTE.PRIMARY.b],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
          },
          bodyStyles: {
            textColor: [71, 85, 105],
          },
          alternateRowStyles: {
            fillColor: [PALETTE.GREY_50.r, PALETTE.GREY_50.g, PALETTE.GREY_50.b],
          },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: "bold" },
            1: { cellWidth: contentWidth - 70 },
            2: { cellWidth: 25 },
          },
          margin: { left: margin + 4, right: margin + 4 },
          didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      }

      // Only draw wrapper border if content stayed on the same page
      if (doc.getNumberOfPages() === stratStartPage && y > stratStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, stratStartY, contentWidth, y - stratStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    // ============================================
    // RISK ASSESSMENT - NEW PAGE
    // ============================================
    addFooter();
    doc.addPage();
    pageNum++;
    addHeader();
    y = 28;
    drawSectionTitle("Risk Assessment", false);
    const riskStartY = y;  // Track start for border
    const riskStartPage = doc.getNumberOfPages();

    // HERO METRIC: Risk Level - full-width professional banner
    const riskLevelKey = data.riskLevel.toLowerCase();
    let riskLevelColor = PALETTE.SUCCESS;
    let riskSubtitle = "Acceptable risk profile";
    if (riskLevelKey.includes("high")) {
      riskLevelColor = PALETTE.DANGER;
      riskSubtitle = "Requires immediate attention and executive oversight";
    } else if (riskLevelKey.includes("medium")) {
      riskLevelColor = { r: 245, g: 158, b: 11 };
      riskSubtitle = "Monitor closely - active mitigation recommended";
    }

    // Full-width risk level banner
    const riskBannerHeight = 32;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(riskLevelColor.r, riskLevelColor.g, riskLevelColor.b);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, riskBannerHeight, 3, 3, "FD");

    // Color accent bar on left
    doc.setFillColor(riskLevelColor.r, riskLevelColor.g, riskLevelColor.b);
    doc.roundedRect(margin, y, 5, riskBannerHeight, 3, 0, "F");
    doc.rect(margin + 3, y, 2, riskBannerHeight, "F");

    // Label
    doc.setFont(FONTS.FAMILY, "normal");
    doc.setFontSize(FONTS.SIZES.LABEL);
    doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
    doc.text("OVERALL RISK LEVEL", margin + 12, y + 8);

    // Risk level value - large prominent text
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setFontSize(20);
    doc.setTextColor(riskLevelColor.r, riskLevelColor.g, riskLevelColor.b);
    doc.text(data.riskLevel.toUpperCase(), margin + 12, y + 20);

    // Subtitle
    doc.setFont(FONTS.FAMILY, "normal");
    doc.setFontSize(FONTS.SIZES.SMALL);
    doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
    doc.text(riskSubtitle, margin + 12, y + 27);

    // Risk score badge on the right
    const scoreBadgeX = margin + contentWidth - 40;
    doc.setFillColor(riskLevelColor.r, riskLevelColor.g, riskLevelColor.b);
    doc.roundedRect(scoreBadgeX, y + 6, 32, 20, 3, 3, "F");
    doc.setFont(FONTS.FAMILY, "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(`${data.riskScore}`, scoreBadgeX + 16, y + 16, { align: "center" });
    doc.setFontSize(6);
    doc.setFont(FONTS.FAMILY, "normal");
    doc.text("RISK SCORE", scoreBadgeX + 16, y + 23, { align: "center" });

    y += riskBannerHeight + 6;

    // SECONDARY METRICS: Risk count details
    renderSecondaryMetrics([
      { label: "Total Risks", value: `${data.risks.length}`, color: PALETTE.GREY_600 },
      { label: "High Priority", value: `${data.risks.filter(r => (r.impact || r.severity || "").toLowerCase().includes("high")).length}`, color: PALETTE.DANGER },
      { label: "Mitigations", value: `${data.risks.filter(r => r.mitigation).length}`, color: PALETTE.SUCCESS },
      { label: "Score", value: `${data.riskScore}/100`, color: riskLevelColor },
    ]);

    // Normalize function for risk categorization - properly handles high/medium/low
    const normalizeLevel = (val: string): string => {
      const v = (val || "").toLowerCase().trim();
      if (v.includes("high") || v.includes("critical") || v.includes("severe") || v === "3") return "high";
      if (v.includes("low") || v.includes("minor") || v === "1") return "low";
      // Medium or unspecified values default to medium for accurate matrix distribution
      return "medium";
    };

    if (data.risks.length > 0) {
      // SUPPORTING: Risk Matrix (de-emphasized, supporting detail)
      // Add visual separator before supporting content
      y += 2;  // Extra padding before supporting content
      doc.setDrawColor(PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b);
      doc.setLineWidth(0.2);
      doc.line(margin + 20, y, margin + contentWidth - 20, y);
      y += 4;

      doc.setFontSize(HIERARCHY.SUPPORTING.fontSize + 2);  // Slightly larger for sub-header
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b);
      doc.text("Risk Matrix", margin + 4, y);
      y += 4;

      const matrixWidth = contentWidth - 8;
      const cellWidth = matrixWidth / 2;
      const cellHeight = 22;
      const matrixY = y;

      // Categorize risks into 4 quadrants (medium maps to high for conservative risk assessment)
      const highImpactHighProb: CategorizedRisk[] = [];
      const highImpactLowProb: CategorizedRisk[] = [];
      const lowImpactHighProb: CategorizedRisk[] = [];
      const lowImpactLowProb: CategorizedRisk[] = [];

      // Helper to map medium to high for 2x2 matrix (conservative approach)
      const mapToHighLow = (level: string): string => {
        return level === "low" ? "low" : "high"; // medium maps to high
      };

      data.risks.forEach((risk) => {
        const rawImpact = normalizeLevel(risk.impact || risk.severity || "");
        const rawProb = normalizeLevel(risk.probability || risk.likelihood || "");
        const impact = mapToHighLow(rawImpact);
        const prob = mapToHighLow(rawProb);
        const riskName = typeof risk === "string" ? risk : risk.name || risk.description || "Risk";
        const categorizedRisk: CategorizedRisk = { name: riskName, impact: rawImpact, probability: rawProb };

        if (impact === "high" && prob === "high") {
          highImpactHighProb.push(categorizedRisk);
        } else if (impact === "high" && prob === "low") {
          highImpactLowProb.push(categorizedRisk);
        } else if (impact === "low" && prob === "high") {
          lowImpactHighProb.push(categorizedRisk);
        } else {
          lowImpactLowProb.push(categorizedRisk);
        }
      });

      // Draw 2x2 matrix quadrants
      const quadrants = [
        { x: 0, y: 0, title: "High Impact / Low Probability", color: { r: 254, g: 243, b: 199 }, borderColor: { r: 234, g: 179, b: 8 }, risks: highImpactLowProb },
        { x: 1, y: 0, title: "High Impact / High Probability", color: { r: 254, g: 226, b: 226 }, borderColor: { r: 239, g: 68, b: 68 }, risks: highImpactHighProb },
        { x: 0, y: 1, title: "Low Impact / Low Probability", color: { r: 241, g: 245, b: 249 }, borderColor: { r: 148, g: 163, b: 184 }, risks: lowImpactLowProb },
        { x: 1, y: 1, title: "Low Impact / High Probability", color: { r: 219, g: 234, b: 254 }, borderColor: { r: 59, g: 130, b: 246 }, risks: lowImpactHighProb },
      ];

      quadrants.forEach((q) => {
        const qx = margin + 4 + q.x * cellWidth;
        const qy = matrixY + q.y * cellHeight;

        doc.setFillColor(q.color.r, q.color.g, q.color.b);
        doc.setDrawColor(q.borderColor.r, q.borderColor.g, q.borderColor.b);
        doc.setLineWidth(0.3);
        doc.rect(qx, qy, cellWidth - 2, cellHeight, "FD");

        // Quadrant title
        doc.setFontSize(7);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text(q.title, qx + 3, qy + 5);

        // Risk names in quadrant
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setFontSize(6);
        doc.setTextColor(71, 85, 105);
        q.risks.slice(0, 2).forEach((riskItem, idx) => {
          const riskLines = doc.splitTextToSize(riskItem.name, cellWidth - 8);
          doc.text(riskLines[0] || "", qx + 3, qy + 10 + idx * 5);
        });
        if (q.risks.length > 2) {
          doc.setTextColor(100, 116, 139);
          doc.text(`+${q.risks.length - 2} more`, qx + 3, qy + 20);
        }
      });

      y = matrixY + cellHeight * 2 + 4;

      // Identified Risks section with professional list
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Identified Risks", margin + 4, y);
      y += 5;

      // Render identified risks as compact executive rows
      data.risks.forEach((risk, idx) => {
        const riskName = typeof risk === "string" ? risk : risk.name || risk.description || `Risk ${idx + 1}`;
        const mitigation = typeof risk === "string" ? "" : (risk.mitigation || risk.mitigationStrategy || "");
        const rowHeight = 13;
        const textWidth = contentWidth - 38;
        const riskLines = doc.splitTextToSize(riskName, textWidth);
        const mitigationSummary = mitigation ? `Mitigation: ${mitigation}` : "Mitigation to be confirmed during mobilization";
        const mitigationLines = doc.splitTextToSize(mitigationSummary, textWidth);
        const riskTitle = riskLines.length > 1 ? `${String(riskLines[0]).replace(/[.,;:]?$/, "")}...` : String(riskLines[0] || riskName);
        const riskMitigation = mitigationLines.length > 1 ? `${String(mitigationLines[0]).replace(/[.,;:]?$/, "")}...` : String(mitigationLines[0] || mitigationSummary);

        y = checkPageBreak(rowHeight + 3);

        // Get severity from multiple possible fields
        let rawSeverity = "";
        if (typeof risk === "string") {
          rawSeverity = "medium"; // Default for string-only risks
        } else {
          rawSeverity = (risk.impact || risk.severity || (risk as { level?: string }).level || (risk as { riskLevel?: string }).riskLevel || "").toString().toLowerCase();
        }

        // Properly classify severity level
        const isHigh = rawSeverity.includes("high") || rawSeverity.includes("critical") || rawSeverity.includes("severe") || rawSeverity === "3";
        const isLow = rawSeverity.includes("low") || rawSeverity.includes("minor") || rawSeverity === "1";

        // Determine severity level (default to medium if unclear)
        let severityLevel: "high" | "medium" | "low";
        if (isHigh) {
          severityLevel = "high";
        } else if (isLow) {
          severityLevel = "low";
        } else {
          severityLevel = "medium"; // Default to medium for safety
        }

        // Severity badge colors
        const severityColors = {
          high: { r: 220, g: 38, b: 38, bg: { r: 254, g: 226, b: 226 } },
          medium: { r: 202, g: 138, b: 4, bg: { r: 254, g: 249, b: 195 } },
          low: { r: 22, g: 163, b: 74, bg: { r: 220, g: 252, b: 231 } }
        };
        const severityColor = severityColors[severityLevel];
        const rowY = y;

        // Row container
        doc.setFillColor(PALETTE.WHITE.r, PALETTE.WHITE.g, PALETTE.WHITE.b);
        doc.setDrawColor(PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin + 4, rowY, contentWidth - 8, rowHeight, 1.8, 1.8, "FD");

        // Severity pill
        doc.setFillColor(severityColor.bg.r, severityColor.bg.g, severityColor.bg.b);
        doc.setDrawColor(severityColor.r, severityColor.g, severityColor.b);
        doc.roundedRect(margin + 7, rowY + 3.5, 16, 5, 1.2, 1.2, "FD");
        doc.setFontSize(5);
        doc.setTextColor(severityColor.r, severityColor.g, severityColor.b);
        doc.setFont(FONTS.FAMILY, "bold");
        const severityLabel = severityLevel === "high" ? "HIGH" :
                              severityLevel === "medium" ? "MED" : "LOW";
        doc.text(severityLabel, margin + 15, rowY + 7, { align: "center" });

        // Risk title
        doc.setFontSize(7.5);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text(riskTitle, margin + 27, rowY + 5.3);

        // Mitigation summary
        doc.setFontSize(6.5);
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(riskMitigation, margin + 27, rowY + 9.6);

        if (idx < data.risks.length - 1) {
          doc.setDrawColor(PALETTE.GREY_100.r, PALETTE.GREY_100.g, PALETTE.GREY_100.b);
          doc.setLineWidth(0.1);
          doc.line(margin + 10, rowY + rowHeight + 1.5, margin + contentWidth - 10, rowY + rowHeight + 1.5);
        }

        y = rowY + rowHeight + 3;
      });

    } else {
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("No risks identified", margin + 4, y);
      y += 4;
    }

    // Only draw wrapper border if content stayed on the same page
    if (doc.getNumberOfPages() === riskStartPage && y > riskStartY) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.roundedRect(margin, riskStartY, contentWidth, y - riskStartY + 2, 1.5, 1.5, "D");
    }
    y += 6;

    // Enhanced Stakeholder Analysis with professional table
    y = checkPageBreak(80);
    drawSectionTitle("Stakeholder Analysis", false);
    drawSectionDivider(COLORS.accent);

    doc.setDrawColor(226, 232, 240);
    const stakeStartY = y;
    const stakeStartPage = doc.getNumberOfPages();
    y += 4;

    if (data.stakeholders.length > 0) {
      // Stakeholder Details Table using autoTable for professional formatting
      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Stakeholder Details", margin + 4, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [["Name", "Role", "Influence", "Interest", "Engagement Strategy"]],
        body: data.stakeholders.map((s) => [
          s.name || "Unknown",
          s.role || "-",
          s.influence || "Medium",
          s.interest || "Medium",
          s.engagement || s.engagementStrategy || "Regular updates"
        ]),
        styles: {
          fontSize: FONTS.SIZES.BODY,
          cellPadding: SPACING.TABLE_CELL + 0.5,
          lineColor: [PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [PALETTE.GREY_100.r, PALETTE.GREY_100.g, PALETTE.GREY_100.b],
          textColor: [PALETTE.GREY_800.r, PALETTE.GREY_800.g, PALETTE.GREY_800.b],
          fontStyle: "bold",
          fontSize: FONTS.SIZES.BODY,
        },
        bodyStyles: {
          textColor: [PALETTE.GREY_600.r, PALETTE.GREY_600.g, PALETTE.GREY_600.b],
        },
        alternateRowStyles: {
          fillColor: [PALETTE.GREY_50.r, PALETTE.GREY_50.g, PALETTE.GREY_50.b],
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: "bold", textColor: [51, 65, 85] },
          1: { cellWidth: 30 },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: contentWidth - 109 },
        },
        margin: { left: margin + 4, right: margin + 4 },
        didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
      });

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

      // Power/Interest Matrix summary
      const computePowerInterestMatrix = () => {
        const matrix = {
          manageClosely: [] as string[],
          keepSatisfied: [] as string[],
          keepInformed: [] as string[],
          monitor: [] as string[],
        };

        data.stakeholders.forEach((s) => {
          const influence = (s.influence || "").toLowerCase();
          const interest = (s.interest || "").toLowerCase();
          const name = s.name || "Unknown";

          if (influence.includes("high") && interest.includes("high")) {
            matrix.manageClosely.push(name);
          } else if (influence.includes("high") && interest.includes("low")) {
            matrix.keepSatisfied.push(name);
          } else if (influence.includes("low") && interest.includes("high")) {
            matrix.keepInformed.push(name);
          } else {
            matrix.monitor.push(name);
          }
        });

        return matrix;
      };

      const matrix = computePowerInterestMatrix();

      // Compact matrix summary
      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Stakeholder Matrix Summary:", margin + 4, y);
      y += 4;

      const summaryItems = [
        { label: "Manage Closely", count: matrix.manageClosely.length, color: { r: 254, g: 226, b: 226 } },
        { label: "Keep Satisfied", count: matrix.keepSatisfied.length, color: { r: 254, g: 243, b: 199 } },
        { label: "Keep Informed", count: matrix.keepInformed.length, color: { r: 219, g: 234, b: 254 } },
        { label: "Monitor", count: matrix.monitor.length, color: { r: 241, g: 245, b: 249 } },
      ];

      let summaryX = margin + 4;
      summaryItems.forEach((item) => {
        doc.setFillColor(item.color.r, item.color.g, item.color.b);
        doc.roundedRect(summaryX, y, 40, 8, 1, 1, "F");
        doc.setFontSize(6);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text(item.label, summaryX + 2, y + 3.5);
        doc.setFontSize(7);
        doc.text(`${item.count}`, summaryX + 35, y + 5);
        summaryX += 44;
      });

      y += 12;
    } else {
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("No stakeholders identified", margin + 4, y);
      y += 8;
    }

    if (doc.getNumberOfPages() === stakeStartPage && y > stakeStartY) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.roundedRect(margin, stakeStartY, contentWidth, y - stakeStartY + 2, 1.5, 1.5, "D");
    }
    y += 6;

    if (data.implementationPhases.length > 0) {
      y = checkPageBreak(100);
      drawSectionTitle("Implementation Plan", true);
      drawSectionDivider(COLORS.primary);

      // Parse durations and calculate timeline
      const parseDuration = (duration: string | undefined): number => {
        if (!duration) return 3;
        const match = /(\d+)/.exec(duration);
        if (!match) return 3;
        const num = Number.parseInt(match[1]!, 10);
        if (duration.toLowerCase().includes('week')) return Math.max(1, Math.ceil(num / 4));
        if (duration.toLowerCase().includes('month')) return num;
        if (duration.toLowerCase().includes('year')) return num * 12;
        return num;
      };

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      let projectBaseDate: Date | null = null;

      data.implementationPhases.forEach(phase => {
        if (phase.startDate) {
          try {
            const d = new Date(phase.startDate);
            if (!Number.isNaN(d.getTime()) && (!projectBaseDate || d < projectBaseDate)) {
              projectBaseDate = d;
            }
          } catch {
            // Ignore invalid date values.
          }
        }
      });

      if (!projectBaseDate) {
        projectBaseDate = new Date();
        projectBaseDate.setMonth(Math.ceil((projectBaseDate.getMonth() + 1) / 3) * 3);
      }

      const formatMonthYear = (dateStr: string | undefined, fallbackMonthOffset: number): string => {
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!Number.isNaN(d.getTime())) {
              return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            }
          } catch {
            // Ignore invalid date values.
          }
        }
        const baseMonth = projectBaseDate!.getMonth();
        const baseYear = projectBaseDate!.getFullYear();
        const targetMonth = baseMonth + fallbackMonthOffset;
        const monthIndex = ((targetMonth % 12) + 12) % 12;
        const yearOffset = Math.floor(targetMonth / 12);
        return `${monthNames[monthIndex]} ${baseYear + yearOffset}`;
      };

      let cumulativeMonths = 0;
      const timeline = data.implementationPhases.map((phase, idx) => {
        const durationMonths = parseDuration(phase.duration);
        const start = cumulativeMonths;
        const end = start + durationMonths;
        cumulativeMonths = end;
        return {
          ...phase, start, end, durationMonths, index: idx,
          startLabel: formatMonthYear(phase.startDate, start),
          endLabel: formatMonthYear(phase.endDate, end - 1)
        };
      });
      const totalDuration = cumulativeMonths || 12;

      // Professional color palette - single unified scheme
      const phaseColors = [
        { bar: { r: 37, g: 99, b: 235 }, bg: { r: 239, g: 246, b: 255 } },   // Blue
        { bar: { r: 109, g: 40, b: 217 }, bg: { r: 245, g: 243, b: 255 } },  // Purple
        { bar: { r: 13, g: 148, b: 136 }, bg: { r: 240, g: 253, b: 250 } },  // Teal
        { bar: { r: 217, g: 119, b: 6 }, bg: { r: 255, g: 251, b: 235 } },   // Amber
        { bar: { r: 190, g: 24, b: 93 }, bg: { r: 253, g: 242, b: 248 } },   // Rose
        { bar: { r: 51, g: 65, b: 85 }, bg: { r: 248, g: 250, b: 252 } },    // Slate
      ];

      // Simple clean timeline - horizontal bars only
      const totalDeliverables = data.implementationPhases.reduce((sum, p) => sum + (p.deliverables?.length || 0), 0);
      const projectStart = timeline.length > 0 ? timeline[0]!.startLabel : "TBD";
      const projectEnd = timeline.length > 0 ? timeline.at(-1)!.endLabel : "TBD";

      // Summary header
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentWidth, 12, 2, 2, "F");
      doc.setFontSize(FONTS.SIZES.LABEL);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(`${projectStart} - ${projectEnd}`, margin + 6, y + 7);
      doc.setTextColor(100, 116, 139);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.text(`${totalDuration} months`, margin + 60, y + 7);
      doc.text(`${data.implementationPhases.length} phases`, margin + 95, y + 7);
      doc.text(`${totalDeliverables} deliverables`, margin + 130, y + 7);
      y += 16;

      // Clean phase list - simple rows
      timeline.slice(0, 6).forEach((phase, idx) => {
        const colors = phaseColors[idx % phaseColors.length]!;
        const rowHeight = 14;

        // Simple row with left accent
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, rowHeight, 1.5, 1.5, "FD");

        // Color accent on left
        doc.setFillColor(colors.bar.r, colors.bar.g, colors.bar.b);
        doc.rect(margin, y, 3, rowHeight, "F");

        // Phase name
        doc.setFontSize(FONTS.SIZES.BODY);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        const rawName = phase.name || `Phase ${idx + 1}`;
        const hasPhasePrefix = /^phase\s*\d+/i.test(rawName);
        const phaseName = hasPhasePrefix ? rawName : `Phase ${idx + 1}: ${rawName}`;
        const nameLines = doc.splitTextToSize(phaseName, 85);
        doc.text(nameLines[0] || phaseName, margin + 6, y + 9);

        // Timeline text
        doc.setFontSize(FONTS.SIZES.SMALL);
        doc.setFont(FONTS.FAMILY, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`${phase.startLabel} - ${phase.endLabel}`, margin + 95, y + 9);

        // Duration badge
        doc.setFillColor(colors.bg.r, colors.bg.g, colors.bg.b);
        doc.roundedRect(margin + 145, y + 3, 18, 8, 2, 2, "F");
        doc.setFontSize(FONTS.SIZES.SMALL);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(colors.bar.r, colors.bar.g, colors.bar.b);
        doc.text(`${phase.durationMonths}mo`, margin + 148, y + 8);

        y += rowHeight + 3;
      });

      y += 8;

      // Phase Details Section - paginated grid
      y = checkPageBreak(30);
      doc.setFontSize(FONTS.SIZES.SUBSECTION);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Phase Details", margin, y);
      y += 8;

      // Grid layout: 2 columns, row-by-row with page break support
      const gridCols = 2;
      const cardGap = 5;
      const cardWidth = (contentWidth - cardGap) / gridCols;

      const phaseItems = timeline.slice(0, 6);
      const numRows = Math.ceil(phaseItems.length / gridCols);

      for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
        const rowItems = phaseItems.slice(rowIdx * gridCols, (rowIdx + 1) * gridCols);

        // Calculate max card height for this row — show ALL deliverables
        const rowCardHeights = rowItems.map((item, itemIdx) => {
          const globalIdx = rowIdx * gridCols + itemIdx;
          const itemDeliverables = item.deliverables || [];
          const itemTitleLines = doc.splitTextToSize(`Phase ${globalIdx + 1}: ${(item.name || "Untitled Phase")}`, cardWidth - 12);
          let delTextHeight = 0;
          itemDeliverables.forEach((d: string | DeliverableItem) => {
            const dName = typeof d === 'string' ? d : d.name || d.title || "Deliverable";
            const dLines = doc.splitTextToSize(`• ${dName}`, cardWidth - 12);
            delTextHeight += dLines.length * 3.8;
          });
          return Math.max(24, 18 + (itemTitleLines.length > 1 ? 4 : 0) + delTextHeight + 2);
        });
        const maxRowHeight = Math.max(...rowCardHeights);

        // Check page break BEFORE rendering this row
        y = checkPageBreak(maxRowHeight + cardGap + 4);

        rowItems.forEach((phase, colIdx) => {
          const globalIdx = rowIdx * gridCols + colIdx;
          const colors = phaseColors[globalIdx % phaseColors.length]!;
          const deliverables = phase.deliverables || [];
          const _maxVisibleDeliverables = Math.min(deliverables.length, 2);
          const titleLines = doc.splitTextToSize(`Phase ${globalIdx + 1}: ${(phase.name || "Untitled Phase")}`, cardWidth - 12);
          const cardHeight = maxRowHeight;

          const cardX = margin + colIdx * (cardWidth + cardGap);
          const cardY = y;

          // Clean card with subtle border
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, "FD");

          // Thin left accent only
          doc.setFillColor(colors.bar.r, colors.bar.g, colors.bar.b);
          doc.rect(cardX, cardY, 3, cardHeight, "F");

          // Phase title
          doc.setFontSize(FONTS.SIZES.BODY);
          doc.setFont(FONTS.FAMILY, "bold");
          doc.setTextColor(51, 65, 85);
          const phaseTitle = `Phase ${globalIdx + 1}: ${(phase.name || "Untitled Phase")}`;
          doc.text(titleLines[0] || phaseTitle, cardX + 7, cardY + 8);
          if (titleLines[1]) {
            doc.text(titleLines[1], cardX + 7, cardY + 12);
          }

          // Timeline and duration
          doc.setFontSize(FONTS.SIZES.SMALL);
          doc.setFont(FONTS.FAMILY, "normal");
          doc.setTextColor(100, 116, 139);
          const phaseTimelineY = cardY + (titleLines[1] ? 17 : 14);
          doc.text(`${phase.startLabel} - ${phase.endLabel}  •  ${phase.durationMonths} months`, cardX + 7, phaseTimelineY);

          // Deliverables (full list)
          doc.setFontSize(FONTS.SIZES.SMALL);
          doc.setTextColor(71, 85, 105);

          if (deliverables.length > 0) {
            let delY = phaseTimelineY + 6;
            deliverables.forEach((d: string | DeliverableItem) => {
              const delName = typeof d === 'string' ? d : d.name || d.title || "Deliverable";
              const delText = doc.splitTextToSize(`• ${delName}`, cardWidth - 12);
              delText.forEach((line: string) => {
                doc.text(line, cardX + 7, delY);
                delY += 3.8;
              });
            });
          } else {
            doc.setTextColor(148, 163, 184);
            doc.text("Key activities for this phase", cardX + 7, phaseTimelineY + 6);
          }
        });

        y += maxRowHeight + cardGap;
      }

      y += 2;
    }

    if (data.implementationRoadmap.milestones.length > 0) {
      y = checkPageBreak(50);
      drawSectionTitle("Critical Milestones", false);
      drawSectionDivider(COLORS.accent);

      const msStartY = y;
      const msStartPage = doc.getNumberOfPages();
      y += TOP_PADDING + 3;

      const msCount = Math.min(data.implementationRoadmap.milestones.length, 5);
      const msAreaWidth = contentWidth - (SIDE_PADDING * 2);
      const msWidth = msAreaWidth / msCount;
      const msAreaX = margin + SIDE_PADDING;
      const lineY = y + 10;

      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.4);
      doc.line(msAreaX, lineY, msAreaX + msAreaWidth, lineY);

      const msInnerPad = 3;
      const msTextWidth = msWidth - (msInnerPad * 2);

      data.implementationRoadmap.milestones.slice(0, 5).forEach((ms, idx) => {
        const columnLeft = msAreaX + idx * msWidth;
        const circleX = columnLeft + msWidth / 2;

        doc.setFillColor(245, 158, 11);
        doc.circle(circleX, lineY, 4, "F");

        doc.setFillColor(255, 255, 255);
        doc.circle(circleX, lineY, 2, "F");

        let textY = lineY + 9;

        doc.setFontSize(6.5);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        const msNameLines = doc.splitTextToSize(ms.name || `Milestone ${idx + 1}`, msTextWidth);
        msNameLines.slice(0, 2).forEach((line: string) => {
          doc.text(line, columnLeft + msInnerPad, textY);
          textY += 3;
        });

        doc.setFont(FONTS.FAMILY, "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(ms.date || "", columnLeft + msInnerPad, textY);
        textY += 3.5;

        if (ms.deliverable) {
          const delLines = doc.splitTextToSize(ms.deliverable, msTextWidth);
          doc.setFontSize(5);
          delLines.slice(0, 2).forEach((line: string) => {
            doc.text(line, columnLeft + msInnerPad, textY);
            textY += 2.8;
          });
        }
      });

      y += 28;
      if (doc.getNumberOfPages() === msStartPage && y > msStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, msStartY, contentWidth, y - msStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    // Implementation Roadmap section removed per user request

    if (data.kpis.length > 0) {
      y = checkPageBreak(60);
      drawSectionTitle("KPIs & Success Metrics", false);
      drawSectionDivider(COLORS.accent);

      const kpiStartY = y;
      const kpiStartPage = doc.getNumberOfPages();
      y += 6;

      const kpiTableWidth = contentWidth - 8;
      const col1Width = kpiTableWidth * 0.4;
      const col2Width = kpiTableWidth * 0.3;
      const col3Width = kpiTableWidth * 0.3;

      autoTable(doc, {
        startY: y,
        head: [["KPI Name", "Target", "Baseline"]],
        body: data.kpis.slice(0, 8).map((kpi) => [
          typeof kpi === "string" ? kpi : kpi.name || "KPI",
          kpi.target || "TBD",
          kpi.baseline || "N/A",
        ]),
        margin: { left: margin + 4, right: margin + 4 },
        styles: {
          fontSize: FONTS.SIZES.BODY,
          cellPadding: SPACING.TABLE_CELL + 1,
          overflow: 'linebreak',
          textColor: [PALETTE.GREY_800.r, PALETTE.GREY_800.g, PALETTE.GREY_800.b],
          lineColor: [PALETTE.GREY_200.r, PALETTE.GREY_200.g, PALETTE.GREY_200.b],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [PALETTE.ACCENT.r, PALETTE.ACCENT.g, PALETTE.ACCENT.b],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fillColor: [PALETTE.WHITE.r, PALETTE.WHITE.g, PALETTE.WHITE.b],
        },
        alternateRowStyles: {
          fillColor: [PALETTE.GREY_50.r, PALETTE.GREY_50.g, PALETTE.GREY_50.b],
        },
        columnStyles: {
          0: { cellWidth: col1Width, fontStyle: 'normal' },
          1: { cellWidth: col2Width },
          2: { cellWidth: col3Width },
        },
        tableWidth: kpiTableWidth,
        theme: 'grid',
        didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      if (doc.getNumberOfPages() === kpiStartPage && y > kpiStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, kpiStartY, contentWidth, y - kpiStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    if (data.measurementPlan.kpis.length > 0 || data.successCriteria.length > 0) {
      y = checkPageBreak(48);
      drawSectionTitle("Benefits Realization", false);
      drawSectionDivider(COLORS.accent);

      const benefitStartY = y;
      const benefitStartPage = doc.getNumberOfPages();
      y += 6;

      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(`Measurement cadence: ${data.measurementPlan.cadence || "Monthly tracking and stage-gate review"}`, margin + 4, y);
      y += 5;

      if (data.measurementPlan.owners.length > 0) {
        doc.setFont(FONTS.FAMILY, "normal");
        doc.text(`Benefit owners: ${data.measurementPlan.owners.slice(0, 4).join(", ")}`, margin + 4, y);
        y += 5;
      }

      if (data.measurementPlan.kpis.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Outcome Metric", "Target", "Owner"]],
          body: data.measurementPlan.kpis.slice(0, 6).map((kpi) => [
            kpi.name || "KPI",
            `${kpi.baseline || "Current state"} -> ${kpi.target || "Target state"}`,
            kpi.owner || data.measurementPlan.owners[0] || "Assigned in mobilization",
          ]),
          margin: { top: 31, left: margin + 4, right: margin + 4 },
          styles: {
            fontSize: FONTS.SIZES.LABEL,
            cellPadding: SPACING.TABLE_CELL,
            overflow: 'linebreak',
          },
          headStyles: {
            fillColor: [PALETTE.ACCENT.r, PALETTE.ACCENT.g, PALETTE.ACCENT.b],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
          },
          columnStyles: {
            0: { cellWidth: 52 },
            1: { cellWidth: 70 },
            2: { cellWidth: 46 },
          },
          theme: 'grid',
          didDrawPage: (function() { let first = true; return function() { if (first) { first = false; return; } autoTablePageHook(); }; })(),
        });
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      }

      if (data.successCriteria.length > 0) {
        doc.setFontSize(8);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.text("Success criteria:", margin + 4, y);
        y += 5;
        data.successCriteria.slice(0, 5).forEach((criterion) => {
          const measurementSuffix = criterion.measurement ? ` (${criterion.measurement})` : "";
          const text = `${criterion.criterion}: ${criterion.target}${measurementSuffix}`;
          const lines = doc.splitTextToSize(`• ${text}`, contentWidth - 12);
          doc.setFontSize(7);
          doc.setFont(FONTS.FAMILY, "normal");
          lines.forEach((line: string) => {
            doc.text(line, margin + 6, y);
            y += 3.5;
          });
        });
      }

      if (doc.getNumberOfPages() === benefitStartPage && y > benefitStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, benefitStartY, contentWidth, y - benefitStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    if (data.compliance.requirements.length > 0 || data.compliance.policyReferences.length > 0 || data.governance.oversight.length > 0 || data.governance.approvals.length > 0) {
      y = checkPageBreak(48);
      drawSectionTitle("Compliance & Governance", true);
      drawSectionDivider(COLORS.primary);

      doc.setDrawColor(226, 232, 240);
      const compStartY = y;
      const compStartPage = doc.getNumberOfPages();
      y += 4;

      if (data.compliance.requirements.length > 0) {
        doc.setFontSize(8);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.setTextColor(51, 65, 85);
        doc.text("Compliance Requirements:", margin + 4, y);
        y += 5;

        data.compliance.requirements.slice(0, 8).forEach((req) => {
          const name = typeof req === "string" ? req : req.name || req.description || "";
          const lines = doc.splitTextToSize(`• ${name}`, contentWidth - 12);
          doc.setFontSize(7);
          doc.setFont(FONTS.FAMILY, "normal");
          lines.forEach((line: string) => {
            doc.text(line, margin + 6, y);
            y += 3.5;
          });
        });
        y += 3;
      }

      if (data.compliance.policyReferences.length > 0) {
        doc.setFontSize(8);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.text("Policy References:", margin + 4, y);
        y += 5;

        data.compliance.policyReferences.slice(0, 6).forEach((ref) => {
          const lines = doc.splitTextToSize(`• ${ref}`, contentWidth - 12);
          doc.setFontSize(7);
          doc.setFont(FONTS.FAMILY, "normal");
          lines.forEach((line: string) => {
            doc.text(line, margin + 6, y);
            y += 3.5;
          });
        });
        y += 3;
      }

      if (data.governance.oversight.length > 0 || data.governance.approvals.length > 0) {
        doc.setFontSize(8);
        doc.setFont(FONTS.FAMILY, "bold");
        doc.text("Governance Framework:", margin + 4, y);
        y += 5;

        const governanceLines = [
          ...data.governance.oversight.slice(0, 4).map((item) => `Oversight: ${item}`),
          ...(data.governance.cadence ? [`Cadence: ${data.governance.cadence}`] : []),
          ...data.governance.approvals.slice(0, 3).map((item) => `Approval gate: ${item}`),
        ];

        governanceLines.forEach((item) => {
          const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 12);
          doc.setFontSize(7);
          doc.setFont(FONTS.FAMILY, "normal");
          lines.forEach((line: string) => {
            doc.text(line, margin + 6, y);
            y += 3.5;
          });
        });
        y += 2;
      }

      if (doc.getNumberOfPages() === compStartPage && y > compStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, compStartY, contentWidth, y - compStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    if (data.assumptions.length > 0 || data.dependencies.length > 0) {
      y = checkPageBreak(50);
      drawSectionTitle("Assumptions & Dependencies", true);
      drawSectionDivider(COLORS.primary);

      const assumStartY = y;
      const assumStartPage = doc.getNumberOfPages();
      y += 8;

      const halfWidth = (contentWidth - 20) / 2;
      const leftColX = margin + 8;
      const rightColX = margin + halfWidth + 16;
      const colTextWidth = halfWidth - 8;

      doc.setFillColor(254, 252, 232);
      doc.roundedRect(leftColX - 2, y - 2, halfWidth, 8, 1.5, 1.5, "F");
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(rightColX - 2, y - 2, halfWidth, 8, 1.5, 1.5, "F");

      doc.setFontSize(9);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(161, 98, 7);
      doc.text("Key Assumptions", leftColX, y + 4);
      doc.setTextColor(30, 64, 175);
      doc.text("Dependencies", rightColX, y + 4);
      y += 12;

      const startY = y;
      let leftY = startY;
      let rightY = startY;

      doc.setFontSize(8);
      doc.setFont(FONTS.FAMILY, "normal");
      doc.setTextColor(51, 65, 85);

      data.assumptions.slice(0, 8).forEach((a) => {
        const lines = doc.splitTextToSize(`• ${a}`, colTextWidth);
        lines.forEach((line: string) => {
          doc.text(line, leftColX, leftY);
          leftY += 4;
        });
      });
      if (data.assumptions.length === 0) {
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "italic"); // Fallback to helvetica for italic style
        doc.text("No assumptions documented", leftColX, leftY);
        leftY += 5;
      }

      doc.setTextColor(51, 65, 85);
      doc.setFont(FONTS.FAMILY, "normal");
      data.dependencies.slice(0, 8).forEach((d) => {
        const lines = doc.splitTextToSize(`• ${d}`, colTextWidth);
        lines.forEach((line: string) => {
          doc.text(line, rightColX, rightY);
          rightY += 4;
        });
      });
      if (data.dependencies.length === 0) {
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "italic"); // Fallback to helvetica for italic style
        doc.text("No dependencies documented", rightColX, rightY);
        rightY += 5;
      }

      y = Math.max(leftY, rightY) + 6;
      if (doc.getNumberOfPages() === assumStartPage && y > assumStartY) {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, assumStartY, contentWidth, y - assumStartY + 2, 1.5, 1.5, "D");
      }
      y += 6;
    }

    y = checkPageBreak(40);
    drawSectionTitle("Recommendation", false);
    drawSectionDivider(COLORS.accent);

    doc.setDrawColor(226, 232, 240);
    const recStartY = y;
    const recStartPage = doc.getNumberOfPages();
    y += 4;

    // Calculate dynamic height for the recommendation box
    const decisionText = data.recommendations.decision || "Proceed with Implementation";
    const rationaleText = data.recommendations.rationale || data.conclusionSummary || "Business case demonstrates positive ROI and strategic alignment.";
    const decisionLines = doc.splitTextToSize(decisionText, contentWidth - 24);
    const rationaleLines = doc.splitTextToSize(rationaleText, contentWidth - 24);
    const rationaleDisplayLines = rationaleLines.slice(0, 6);
    const decisionHeight = decisionLines.length * 5.5;
    const recBoxHeight = 8 + decisionHeight + 4 + (rationaleDisplayLines.length * 4.5) + 4;

    y = checkPageBreak(recBoxHeight + 4);
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.roundedRect(margin + 4, y, contentWidth - 8, recBoxHeight, 2, 2, "FD");

    doc.setTextColor(22, 163, 74);
    doc.setFontSize(FONTS.SIZES.SECTION);
    doc.setFont(FONTS.FAMILY, "bold");
    let decTextY = y + 8;
    decisionLines.forEach((line: string) => {
      doc.text(line, margin + 8, decTextY);
      decTextY += 5.5;
    });

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(FONTS.SIZES.BODY);
    doc.setFont(FONTS.FAMILY, "normal");
    let ratTextY = decTextY + 3;
    rationaleDisplayLines.forEach((line: string) => {
      doc.text(line, margin + 8, ratTextY);
      ratTextY += 4.5;
    });

    y += recBoxHeight + 4;

    if (data.recommendations.nextSteps.length > 0) {
      y = checkPageBreak(10);
      doc.setFontSize(FONTS.SIZES.BODY);
      doc.setFont(FONTS.FAMILY, "bold");
      doc.setTextColor(51, 65, 85);
      doc.text("Next Steps:", margin + 4, y);
      y += 6;

      data.recommendations.nextSteps.slice(0, 6).forEach((step, idx) => {
        y = checkPageBreak(10);
        const lines = doc.splitTextToSize(`${idx + 1}. ${step}`, contentWidth - 12);
        doc.setFontSize(FONTS.SIZES.LABEL);
        doc.setFont(FONTS.FAMILY, "normal");
        lines.forEach((line: string) => {
          doc.text(line, margin + 6, y);
          y += 4.5;
        });
      });
    }

    if (data.recommendations.commercialCase || data.recommendations.publicValueCase) {
      const narrativeBlocks = [
        { title: 'Commercial Case', text: data.recommendations.commercialCase || '' },
        { title: 'Public-Value Case', text: data.recommendations.publicValueCase || '' },
      ].filter((block) => block.text.trim().length > 0);

      narrativeBlocks.forEach((block, idx) => {
        const textLines = doc.splitTextToSize(block.text, contentWidth - 14).slice(0, 5);
        const boxHeight = 9 + (textLines.length * 4.5);
        y = checkPageBreak(boxHeight + 4);
        doc.setFillColor(idx === 0 ? 239 : 240, idx === 0 ? 246 : 253, idx === 0 ? 255 : 250);
        doc.setDrawColor(idx === 0 ? 191 : 153, idx === 0 ? 219 : 246, idx === 0 ? 254 : 228);
        doc.roundedRect(margin + 4, y, contentWidth - 8, boxHeight, 2, 2, 'FD');
        doc.setFont(FONTS.FAMILY, 'bold');
        doc.setFontSize(FONTS.SIZES.BODY);
        doc.setTextColor(15, 23, 42);
        doc.text(block.title, margin + 8, y + 6);
        doc.setFont(FONTS.FAMILY, 'normal');
        doc.setFontSize(FONTS.SIZES.LABEL);
        let blockY = y + 11;
        textLines.forEach((line: string) => {
          doc.text(line, margin + 8, blockY);
          blockY += 4.5;
        });
        y += boxHeight + 4;
      });
    }

    if (doc.getNumberOfPages() === recStartPage && y > recStartY) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.roundedRect(margin, recStartY, contentWidth, y - recStartY + 2, 1.5, 1.5, "D");
    }
    y += 6;

    addFooter();

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    logger.info("[DocumentAgent] PDF generated successfully, size:", pdfBuffer.length, "bytes, pages:", pageNum);
    return pdfBuffer;
  }

  private async generatePPTX(data: BusinessCaseData): Promise<Buffer> { // NOSONAR
    logger.info("[DocumentAgent] Starting comprehensive PPTX generation");

    const pptx = new PptxGenJSConstructor();

    pptx.author = "COREVIA";
    pptx.company = "COREVIA Enterprise Intelligence";
    pptx.subject = `Business Case: ${data.projectName}`;
    pptx.title = `${data.projectName} - Business Case`;

    const PPT_LAYOUT = {
      marginLeft: 0.5,
      marginRight: 0.5,
      marginTop: 0.55,
      contentWidth: 9,
      titleY: 0.55,
      contentStartY: 1.15,
      cardPadding: 0.15,
      columnGap: 0.2,
      rowGap: 0.12,
    };

    const PPT_FONTS = {
      title: 22,
      subtitle: 14,
      heading: 11,
      body: 9,
      small: 8,
      caption: 7,
    };

    pptx.defineSlideMaster({
      title: "COREVIA_MASTER",
      background: { color: "FFFFFF" },
      objects: [
        { rect: { x: 0, y: 0, w: "100%", h: 0.45, fill: { color: PPTX_COLORS.primary } } },
        { rect: { x: 0, y: 0.42, w: "100%", h: 0.03, fill: { color: PPTX_COLORS.teal } } },
        {
          text: {
            text: "COREVIA",
            options: { x: 0.3, y: 0.1, w: 2, h: 0.28, fontSize: 11, color: "FFFFFF", bold: true },
          },
        },
        { rect: { x: 0, y: 5.2, w: "100%", h: 0.3, fill: { color: "F1F5F9" } } },
        {
          text: {
            text: "Confidential - For Management Review Only",
            options: { x: 0.3, y: 5.23, w: 4, h: 0.2, fontSize: 7, color: "64748B" },
          },
        },
      ],
    });

    const addSlideTitle = (slide: PptxSlide, title: string) => {
      slide.addText(title, {
        x: PPT_LAYOUT.marginLeft,
        y: PPT_LAYOUT.titleY,
        w: PPT_LAYOUT.contentWidth,
        h: 0.45,
        fontSize: PPT_FONTS.title,
        bold: true,
        color: PPTX_COLORS.text
      });
    };

    const addCard = (slide: PptxSlide, x: number, y: number, w: number, h: number, options: { fill?: string; accent?: string } = {}) => {
      const fill = options.fill || "FFFFFF";
      slide.addShape("rect", { x, y, w, h, fill: { color: fill }, line: { color: "E2E8F0", pt: 1 } });
      if (options.accent) {
        slide.addShape("rect", { x, y, w: 0.06, h, fill: { color: options.accent } });
      }
    };

    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `AED ${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `AED ${(val / 1000).toFixed(0)}K`;
      return `AED ${val.toFixed(0)}`;
    };

    const investmentValue = data.financialMetrics.totalCost || data.financialMetrics.tco || data.totalCostOfOwnership || 0;
    const conciseGovernanceCadence = (() => {
      const cadence = (data.governance.cadence || "Monthly stage-gate review").trim();
      if (/monthly/i.test(cadence)) return "Monthly stage-gate reviews";
      if (/weekly/i.test(cadence)) return "Weekly delivery reviews";
      return cadence.length > 34 ? `${cadence.substring(0, 31).trim()}...` : cadence;
    })();

    const formatPayback = (months: number) => {
      const years = Math.floor(months / 12);
      const remainingMonths = Math.round(months % 12);
      if (years === 0) return `${remainingMonths} months`;
      if (remainingMonths === 0) return `${years} year${years > 1 ? "s" : ""}`;
      return `${years}y ${remainingMonths}m`;
    };

    const recommendationLabel = data.recommendations.decision || "Proceed with Implementation";
    let recommendationColor = PPTX_COLORS.success;
    if (recommendationLabel.toLowerCase().includes("defer") || recommendationLabel.toLowerCase().includes("hold")) {
      recommendationColor = PPTX_COLORS.danger;
    } else if (recommendationLabel.toLowerCase().includes("conditional") || recommendationLabel.toLowerCase().includes("stage")) {
      recommendationColor = PPTX_COLORS.warning;
    }

    const titleSlide = pptx.addSlide();
    titleSlide.addShape("rect", { x: 0, y: 0, w: "100%", h: "100%", fill: { color: PPTX_COLORS.primary } });

    titleSlide.addShape("rect", { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: "14B8A6" } });

    if (this.logoBase64) {
      try {
        titleSlide.addImage({ data: this.logoBase64, x: 0.6, y: 1.0, w: 3.8, h: 3.8 });
      } catch {
        logger.info("[DocumentExport] PPT cover logo skipped");
      }
    }

    titleSlide.addText("COREVIA", { x: 4.5, y: 1.0, w: 5, h: 0.7, fontSize: 38, bold: true, italic: true, color: "FFFFFF" });
    titleSlide.addText("Human-Centered", { x: 4.5, y: 1.65, w: 5, h: 0.55, fontSize: 28, bold: true, color: "FFFFFF" });
    titleSlide.addText("Enterprise Intelligence", { x: 4.5, y: 2.15, w: 5, h: 0.55, fontSize: 28, bold: true, color: "FFFFFF" });

    titleSlide.addShape("rect", { x: 4.5, y: 2.9, w: 0.06, h: 0.9, fill: { color: "14B8A6" } });
    titleSlide.addText("Governance-first AI architecture. Decision DNA technology.", { x: 4.7, y: 2.95, w: 5, h: 0.3, fontSize: 10, color: "94A3B8" });
    titleSlide.addText("Built for UAE Data Sovereignty by design.", { x: 4.7, y: 3.25, w: 5, h: 0.3, fontSize: 10, color: "94A3B8" });

    titleSlide.addShape("rect", { x: 4.7, y: 3.6, w: 2.8, h: 0.35, fill: { color: "DC2626" } });
    titleSlide.addText("BUSINESS CASE REPORT", { x: 4.75, y: 3.62, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: "FFFFFF" });

    const coverTitle = data.projectName.length > 50 ? data.projectName.substring(0, 47) + "..." : data.projectName;
    titleSlide.addText(coverTitle, { x: 4.5, y: 4.1, w: 5, h: 0.4, fontSize: 14, color: "FFFFFF" });

    titleSlide.addShape("roundRect", { x: 4.5, y: 4.5, w: 4.55, h: 0.68, fill: { color: recommendationColor }, line: { color: recommendationColor, pt: 0.5 } });
    titleSlide.addText("Executive Position", { x: 4.68, y: 4.58, w: 1.4, h: 0.12, fontSize: 7, color: "FFFFFF", bold: true });
    titleSlide.addText(recommendationLabel, { x: 4.68, y: 4.74, w: 4.0, h: 0.22, fontSize: 15, color: "FFFFFF", bold: true });
    titleSlide.addText(`${formatCurrency(investmentValue)} investment | ${data.financialMetrics.roi.toFixed(1)}% ROI | ${formatPayback(data.financialMetrics.paybackPeriod * 12)}`, { x: 4.68, y: 4.97, w: 4.0, h: 0.14, fontSize: 7, color: "FFFFFF" });

    titleSlide.addText(format(new Date(), "MMMM yyyy"), { x: 0.3, y: 4.8, w: 3, h: 0.25, fontSize: 10, color: "94A3B8" });
    titleSlide.addText("Strictly Private & Confidential", { x: 0.3, y: 5.05, w: 3, h: 0.2, fontSize: 8, color: "64748B" });

    titleSlide.addText(`Request ID: ${data.demandId}`, { x: 6.5, y: 5.0, w: 3, h: 0.2, fontSize: 8, color: "64748B", align: "right" });

    const execSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(execSlide, "Executive Position");

    const execHalfW = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;
    addCard(execSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, execHalfW, 1.45, { accent: recommendationColor, fill: "F8FAFC" });
    execSlide.addText("Board Recommendation", { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: execHalfW - 0.3, h: 0.18, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
    execSlide.addText(recommendationLabel, { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.4, w: execHalfW - 0.3, h: 0.28, fontSize: 18, bold: true, color: recommendationColor });
    execSlide.addText((data.conclusionSummary || data.recommendations.rationale || "Decision should be governed through stage gates, measurable outcomes, and controlled release approvals.").substring(0, 170), { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.78, w: execHalfW - 0.3, h: 0.44, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });

    const guardrailX = PPT_LAYOUT.marginLeft + execHalfW + PPT_LAYOUT.columnGap;
    addCard(execSlide, guardrailX, PPT_LAYOUT.contentStartY, execHalfW, 1.45, { accent: PPTX_COLORS.indigo, fill: "F8FAFC" });
    execSlide.addText("Release Guardrails", { x: guardrailX + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: execHalfW - 0.3, h: 0.18, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
    [
      `Governance: ${data.governance.cadence || "Monthly stage-gate review"}`,
      `Benefits: ${data.measurementPlan.cadence || "Monthly KPI review"}`,
      `Risk: ${data.riskLevel.toUpperCase()} / ${data.riskScore}/100`,
    ].forEach((line, idx) => {
      execSlide.addText(`• ${line.substring(0, 52)}`, { x: guardrailX + 0.2, y: PPT_LAYOUT.contentStartY + 0.42 + idx * 0.25, w: execHalfW - 0.3, h: 0.16, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
    });

    addCard(execSlide, PPT_LAYOUT.marginLeft, 2.85, PPT_LAYOUT.contentWidth, 2.05, { accent: PPTX_COLORS.teal });
    execSlide.addText("Immediate Executive Actions", { x: PPT_LAYOUT.marginLeft + 0.2, y: 2.95, w: 3.2, h: 0.22, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
    const executiveActions = (data.recommendations.nextSteps.length > 0 ? data.recommendations.nextSteps : [
      "Confirm scope, funding guardrails, and named benefit owners",
      "Approve architecture, security, and integration release gates",
      "Authorize pilot or controlled rollout with measurable success criteria",
      "Review operational readiness and benefits realization before scale-up",
    ]).slice(0, 4);
    executiveActions.forEach((step, idx) => {
      const boxX = PPT_LAYOUT.marginLeft + 0.2 + (idx % 2) * 4.35;
      const boxY = 3.28 + Math.floor(idx / 2) * 0.72;
      execSlide.addShape("roundRect", { x: boxX, y: boxY, w: 4.1, h: 0.56, fill: { color: idx % 2 === 0 ? "EFF6FF" : "F0FDFA" }, line: { color: idx % 2 === 0 ? "BFDBFE" : "99F6E4", pt: 0.5 } });
      execSlide.addText(`${idx + 1}. ${step.substring(0, 72)}`, { x: boxX + 0.12, y: boxY + 0.12, w: 3.86, h: 0.28, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text, bold: true });
    });

    if (data.recommendations.commercialCase || data.recommendations.publicValueCase) {
      addCard(execSlide, PPT_LAYOUT.marginLeft, 5.1, PPT_LAYOUT.contentWidth, 1.7, { accent: PPTX_COLORS.teal, fill: "F8FAFC" });
      execSlide.addText("Decision Lenses", { x: PPT_LAYOUT.marginLeft + 0.2, y: 5.2, w: 2.5, h: 0.2, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
      execSlide.addText((data.recommendations.commercialCase || "Commercial case not provided.").substring(0, 180), { x: PPT_LAYOUT.marginLeft + 0.2, y: 5.48, w: 4.15, h: 0.78, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
      execSlide.addText((data.recommendations.publicValueCase || "Public-value case not provided.").substring(0, 180), { x: PPT_LAYOUT.marginLeft + 4.55, y: 5.48, w: 4.15, h: 0.78, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
    }

    const metricsSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(metricsSlide, "Financial Overview");

    const cardWidth = 2.15;
    const cardGap = 0.13;
    const metrics = [
      { label: "ROI", value: `${data.financialMetrics.roi.toFixed(1)}%`, color: PPTX_COLORS.teal },
      { label: "NPV", value: formatCurrency(data.financialMetrics.npv), color: PPTX_COLORS.teal },
      { label: "Payback", value: formatPayback(data.financialMetrics.paybackPeriod), color: PPTX_COLORS.teal },
      { label: "Investment", value: formatCurrency(investmentValue), color: PPTX_COLORS.teal },
    ];

    metrics.forEach((m, i) => {
      const x = PPT_LAYOUT.marginLeft + i * (cardWidth + cardGap);
      addCard(metricsSlide, x, PPT_LAYOUT.contentStartY, cardWidth, 1.0, { accent: m.color });
      metricsSlide.addText(m.label, { x: x + 0.18, y: PPT_LAYOUT.contentStartY + 0.12, w: cardWidth - 0.25, h: 0.25, fontSize: PPT_FONTS.body, color: PPTX_COLORS.gray });
      metricsSlide.addText(m.value, { x: x + 0.18, y: PPT_LAYOUT.contentStartY + 0.45, w: cardWidth - 0.25, h: 0.45, fontSize: 20, bold: true, color: PPTX_COLORS.text });
    });

    const takeawayY = 2.35;
    const takeawayWidth = (PPT_LAYOUT.contentWidth - (PPT_LAYOUT.columnGap * 2)) / 3;
    const takeaways = [
      `Decision: ${(data.recommendations.decision || 'Proceed with Implementation').substring(0, 44)}`,
      `Control point: ${conciseGovernanceCadence}`,
      `Benefits: ${(data.measurementPlan.cadence || 'Monthly KPI review').substring(0, 44)}`,
    ];

    takeaways.forEach((item, idx) => {
      const x = PPT_LAYOUT.marginLeft + idx * (takeawayWidth + PPT_LAYOUT.columnGap);
      let accent = PPTX_COLORS.teal;
      if (idx === 0) {
        accent = recommendationColor;
      } else if (idx === 1) {
        accent = PPTX_COLORS.indigo;
      }
      addCard(metricsSlide, x, takeawayY, takeawayWidth, 0.72, { accent, fill: "F8FAFC" });
      metricsSlide.addText(item, { x: x + 0.16, y: takeawayY + 0.18, w: takeawayWidth - 0.24, h: 0.28, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
    });

    addCard(metricsSlide, PPT_LAYOUT.marginLeft, 3.2, PPT_LAYOUT.contentWidth, 1.85, { accent: PPTX_COLORS.teal });
    metricsSlide.addText("Executive Summary", { x: PPT_LAYOUT.marginLeft + 0.2, y: 3.3, w: 8.6, h: 0.35, fontSize: PPT_FONTS.subtitle, bold: true, color: PPTX_COLORS.text });
    metricsSlide.addText(data.executiveSummary.substring(0, 320) || "No executive summary available.", {
      x: PPT_LAYOUT.marginLeft + 0.2, y: 3.68, w: 8.6, h: 1.1, fontSize: PPT_FONTS.body, color: PPTX_COLORS.text, valign: "top",
    });

    const problemSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(problemSlide, "Problem & Solution");

    const halfWidth = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;

    addCard(problemSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, halfWidth, 3.9, { accent: PPTX_COLORS.rose });
    problemSlide.addText("Problem Statement", { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: halfWidth - 0.3, h: 0.32, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
    problemSlide.addText(data.problemStatement.substring(0, 400) || "No problem statement available.", {
      x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.5, w: halfWidth - 0.35, h: 3.3, fontSize: PPT_FONTS.body, color: PPTX_COLORS.text, valign: "top",
    });

    addCard(problemSlide, PPT_LAYOUT.marginLeft + halfWidth + PPT_LAYOUT.columnGap, PPT_LAYOUT.contentStartY, halfWidth, 3.9, { accent: PPTX_COLORS.teal });
    problemSlide.addText("Proposed Solution", { x: PPT_LAYOUT.marginLeft + halfWidth + PPT_LAYOUT.columnGap + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: halfWidth - 0.3, h: 0.32, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
    problemSlide.addText(data.proposedSolution.substring(0, 400) || "No solution available.", {
      x: PPT_LAYOUT.marginLeft + halfWidth + PPT_LAYOUT.columnGap + 0.2, y: PPT_LAYOUT.contentStartY + 0.5, w: halfWidth - 0.35, h: 3.3, fontSize: PPT_FONTS.body, color: PPTX_COLORS.text, valign: "top",
    });

    if (data.smartObjectives.length > 0 || data.scopeDefinition.inScope.length > 0) {
      const objSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(objSlide, "Objectives & Scope");

      let objY = PPT_LAYOUT.contentStartY;
      if (data.smartObjectives.length > 0) {
        addCard(objSlide, PPT_LAYOUT.marginLeft, objY, PPT_LAYOUT.contentWidth, 1.6, { accent: PPTX_COLORS.teal });
        objSlide.addText("SMART Objectives", { x: PPT_LAYOUT.marginLeft + 0.2, y: objY + 0.1, w: 8.6, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });

        let oy = objY + 0.42;
        data.smartObjectives.slice(0, 3).forEach((obj, i) => {
          objSlide.addShape("rect", { x: PPT_LAYOUT.marginLeft + 0.2, y: oy + 0.02, w: 0.1, h: 0.1, fill: { color: PPTX_COLORS.teal } });
          objSlide.addText(obj.objective || `Objective ${i + 1}`, { x: PPT_LAYOUT.marginLeft + 0.4, y: oy, w: 8.4, h: 0.22, fontSize: PPT_FONTS.body, bold: true, color: PPTX_COLORS.text });
          if (obj.measurable) {
            objSlide.addText(`Measurable: ${obj.measurable}`, { x: PPT_LAYOUT.marginLeft + 0.4, y: oy + 0.22, w: 8.4, h: 0.18, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
          }
          oy += 0.42;
        });
        objY += 1.75;
      }

      const scopeHalfW = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;
      addCard(objSlide, PPT_LAYOUT.marginLeft, objY, scopeHalfW, 2.2, { fill: "E0F2FE", accent: PPTX_COLORS.lightBlue });
      objSlide.addText("In Scope", { x: PPT_LAYOUT.marginLeft + 0.18, y: objY + 0.1, w: scopeHalfW - 0.25, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.lightBlue });
      let inY = objY + 0.42;
      data.scopeDefinition.inScope.slice(0, 6).forEach((item) => {
        objSlide.addText(`• ${item.substring(0, 50)}`, { x: PPT_LAYOUT.marginLeft + 0.18, y: inY, w: scopeHalfW - 0.25, h: 0.26, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
        inY += 0.28;
      });

      addCard(objSlide, PPT_LAYOUT.marginLeft + scopeHalfW + PPT_LAYOUT.columnGap, objY, scopeHalfW, 2.2, { fill: "FEF2F2", accent: PPTX_COLORS.danger });
      objSlide.addText("Out of Scope", { x: PPT_LAYOUT.marginLeft + scopeHalfW + PPT_LAYOUT.columnGap + 0.18, y: objY + 0.1, w: scopeHalfW - 0.25, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.danger });
      let outY = objY + 0.42;
      data.scopeDefinition.outOfScope.slice(0, 6).forEach((item) => {
        objSlide.addText(`• ${item.substring(0, 50)}`, { x: PPT_LAYOUT.marginLeft + scopeHalfW + PPT_LAYOUT.columnGap + 0.18, y: outY, w: scopeHalfW - 0.25, h: 0.26, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
        outY += 0.28;
      });
    }

    if (data.businessRequirements || data.expectedDeliverables.length > 0) {
      const reqSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(reqSlide, "Business Requirements & Deliverables");

      const reqHalfW = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;

      if (data.businessRequirements) {
        addCard(reqSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, reqHalfW, 3.9, { accent: PPTX_COLORS.teal });
        reqSlide.addText("Business Requirements", { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: reqHalfW - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
        reqSlide.addText(data.businessRequirements.substring(0, 480) || "No requirements documented.", {
          x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.48, w: reqHalfW - 0.35, h: 3.3, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text, valign: "top",
        });
      }

      if (data.expectedDeliverables.length > 0) {
        const delX = data.businessRequirements ? PPT_LAYOUT.marginLeft + reqHalfW + PPT_LAYOUT.columnGap : PPT_LAYOUT.marginLeft;
        const delW = data.businessRequirements ? reqHalfW : PPT_LAYOUT.contentWidth;
        addCard(reqSlide, delX, PPT_LAYOUT.contentStartY, delW, 3.9, { accent: PPTX_COLORS.teal });
        reqSlide.addText("Expected Deliverables", { x: delX + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: delW - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
        let dY = PPT_LAYOUT.contentStartY + 0.48;
        data.expectedDeliverables.slice(0, 8).forEach((del) => {
          reqSlide.addShape("rect", { x: delX + 0.2, y: dY + 0.04, w: 0.1, h: 0.1, fill: { color: PPTX_COLORS.teal } });
          const delText = typeof del === "string" ? del : (del.name || del.deliverable || "Deliverable");
          reqSlide.addText(delText.substring(0, 65), { x: delX + 0.4, y: dY, w: delW - 0.55, h: 0.32, fontSize: PPT_FONTS.small, color: PPTX_COLORS.text });
          dY += 0.38;
        });
      }
    }

    const saSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(saSlide, "Strategic Overview");

    const thirdWidth = (PPT_LAYOUT.contentWidth - 2 * PPT_LAYOUT.columnGap) / 3;
    const saCol1X = PPT_LAYOUT.marginLeft;
    const saCol2X = PPT_LAYOUT.marginLeft + thirdWidth + PPT_LAYOUT.columnGap;
    const saCol3X = PPT_LAYOUT.marginLeft + 2 * (thirdWidth + PPT_LAYOUT.columnGap);
    const saCardHeight = 3.9;

    addCard(saSlide, saCol1X, PPT_LAYOUT.contentStartY, thirdWidth, saCardHeight, { accent: PPTX_COLORS.teal });
    saSlide.addText("Strategic Alignment", { x: saCol1X + 0.18, y: PPT_LAYOUT.contentStartY + 0.1, w: thirdWidth - 0.25, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });

    let saY = PPT_LAYOUT.contentStartY + 0.45;
    if (data.strategicAlignment.objectives.length > 0) {
      saSlide.addText("Strategic Objectives:", { x: saCol1X + 0.18, y: saY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal });
      saY += 0.24;
      data.strategicAlignment.objectives.slice(0, 4).forEach((obj) => {
        const objName = (obj?.name || obj?.objective || String(obj) || "Objective").substring(0, 40);
        saSlide.addShape("rect", { x: saCol1X + 0.18, y: saY + 0.03, w: 0.08, h: 0.08, fill: { color: PPTX_COLORS.teal } });
        saSlide.addText(objName, { x: saCol1X + 0.32, y: saY, w: thirdWidth - 0.42, h: 0.32, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.text, valign: "top" });
        saY += 0.35;
      });
    }

    if (data.strategicAlignment.departmentImpact.length > 0) {
      saY += 0.12;
      saSlide.addText("Department Impact:", { x: saCol1X + 0.18, y: saY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal });
      saY += 0.24;
      data.strategicAlignment.departmentImpact.slice(0, 3).forEach((di) => {
        const deptName = (di?.department || "Department").substring(0, 18);
        const impact = (di?.impact || "Impact").substring(0, 25);
        saSlide.addText(`${deptName}: ${impact}`, { x: saCol1X + 0.18, y: saY, w: thirdWidth - 0.25, h: 0.22, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
        saY += 0.24;
      });
    }

    addCard(saSlide, saCol2X, PPT_LAYOUT.contentStartY, thirdWidth, saCardHeight, { accent: PPTX_COLORS.teal });
    saSlide.addText("Compliance & Governance", { x: saCol2X + 0.18, y: PPT_LAYOUT.contentStartY + 0.1, w: thirdWidth - 0.25, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });

    let compY = PPT_LAYOUT.contentStartY + 0.45;
    const complianceReqs = data.compliance?.requirements || [];
    const policyRefs = data.compliance?.policyReferences || [];

    if (complianceReqs.length > 0) {
      saSlide.addText("Compliance Requirements:", { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal });
      compY += 0.24;
      complianceReqs.slice(0, 4).forEach((req: string | ComplianceRequirement) => {
        const reqName = (typeof req === "string" ? req : req?.name || req?.requirement || String(req)).substring(0, 38);
        saSlide.addShape("rect", { x: saCol2X + 0.18, y: compY + 0.03, w: 0.08, h: 0.08, fill: { color: PPTX_COLORS.teal } });
        saSlide.addText(reqName, { x: saCol2X + 0.32, y: compY, w: thirdWidth - 0.42, h: 0.3, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.text, valign: "top" });
        compY += 0.32;
      });
    } else {
      saSlide.addText("No compliance requirements", { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
      compY += 0.25;
    }

    if (policyRefs.length > 0) {
      compY += 0.1;
      saSlide.addText("Policy References:", { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal });
      compY += 0.24;
      policyRefs.slice(0, 3).forEach((ref: string) => {
        saSlide.addText(`• ${ref.substring(0, 35)}`, { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.22, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
        compY += 0.24;
      });
    }

    if (data.governance.oversight.length > 0 || data.governance.approvals.length > 0) {
      compY += 0.1;
      saSlide.addText("Governance:", { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal });
      compY += 0.24;
      [...data.governance.oversight.slice(0, 2), ...data.governance.approvals.slice(0, 1)].forEach((item) => {
        saSlide.addText(`• ${item.substring(0, 35)}`, { x: saCol2X + 0.18, y: compY, w: thirdWidth - 0.25, h: 0.22, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.text });
        compY += 0.24;
      });
    }

    addCard(saSlide, saCol3X, PPT_LAYOUT.contentStartY, thirdWidth, saCardHeight, { accent: PPTX_COLORS.teal });
    saSlide.addText("KPIs & Success Metrics", { x: saCol3X + 0.18, y: PPT_LAYOUT.contentStartY + 0.1, w: thirdWidth - 0.25, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });

    let kpiY = PPT_LAYOUT.contentStartY + 0.45;
    if (data.kpis.length > 0) {
      data.kpis.slice(0, 5).forEach((kpi: KPIItem) => {
        const kpiName = (kpi?.name || kpi?.metric || "KPI").substring(0, 22);
        const target = kpi?.target || kpi?.targetValue || "Target";

        saSlide.addShape("rect", { x: saCol3X + 0.18, y: kpiY, w: thirdWidth - 0.35, h: 0.5, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", pt: 0.5 } });
        saSlide.addText(kpiName, { x: saCol3X + 0.25, y: kpiY + 0.06, w: thirdWidth - 0.45, h: 0.18, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
        saSlide.addText(`Target: ${String(target).substring(0, 25)}`, { x: saCol3X + 0.25, y: kpiY + 0.26, w: thirdWidth - 0.45, h: 0.16, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.teal });
        kpiY += 0.58;
      });
    } else {
      saSlide.addText("No KPIs documented", { x: saCol3X + 0.18, y: kpiY, w: thirdWidth - 0.25, h: 0.2, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
    }

    if (data.measurementPlan.cadence || data.measurementPlan.owners.length > 0) {
      saSlide.addText(`Cadence: ${(data.measurementPlan.cadence || "Monthly").substring(0, 24)}`, { x: saCol3X + 0.18, y: PPT_LAYOUT.contentStartY + 3.25, w: thirdWidth - 0.25, h: 0.18, fontSize: 7, color: PPTX_COLORS.gray });
      saSlide.addText(`Owners: ${(data.measurementPlan.owners.join(", ") || "Assigned in mobilization").substring(0, 28)}`, { x: saCol3X + 0.18, y: PPT_LAYOUT.contentStartY + 3.45, w: thirdWidth - 0.25, h: 0.18, fontSize: 7, color: PPTX_COLORS.gray });
    }

    if (data.measurementPlan.kpis.length > 0 || data.successCriteria.length > 0) {
      const brSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(brSlide, "Benefits Realization & Controls");

      const leftWidth = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;
      const rightX = PPT_LAYOUT.marginLeft + leftWidth + PPT_LAYOUT.columnGap;

      addCard(brSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, leftWidth, 3.9, { accent: PPTX_COLORS.teal });
      brSlide.addText("Measurement Plan", { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: leftWidth - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
      brSlide.addText(`Cadence: ${data.measurementPlan.cadence || "Monthly tracking and quarterly steering review"}`, { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.45, w: leftWidth - 0.35, h: 0.2, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
      brSlide.addText(`Owners: ${(data.measurementPlan.owners.join(", ") || "Assigned during mobilization").substring(0, 65)}`, { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.7, w: leftWidth - 0.35, h: 0.24, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });

      let mpY = PPT_LAYOUT.contentStartY + 1.05;
      data.measurementPlan.kpis.slice(0, 5).forEach((kpi) => {
        brSlide.addShape("rect", { x: PPT_LAYOUT.marginLeft + 0.2, y: mpY, w: leftWidth - 0.4, h: 0.46, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", pt: 0.5 } });
        brSlide.addText((kpi.name || "KPI").substring(0, 34), { x: PPT_LAYOUT.marginLeft + 0.28, y: mpY + 0.05, w: leftWidth - 0.55, h: 0.16, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
        brSlide.addText(`${(kpi.baseline || "Current").substring(0, 18)} -> ${(kpi.target || "Target").substring(0, 22)}`, { x: PPT_LAYOUT.marginLeft + 0.28, y: mpY + 0.23, w: leftWidth - 0.55, h: 0.14, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.teal });
        brSlide.addText((kpi.owner || data.measurementPlan.owners[0] || "Owner assigned").substring(0, 24), { x: PPT_LAYOUT.marginLeft + leftWidth - 1.25, y: mpY + 0.23, w: 0.95, h: 0.14, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray, align: "right" });
        mpY += 0.55;
      });

      addCard(brSlide, rightX, PPT_LAYOUT.contentStartY, leftWidth, 3.9, { accent: PPTX_COLORS.indigo });
      brSlide.addText("Success Criteria", { x: rightX + 0.2, y: PPT_LAYOUT.contentStartY + 0.12, w: leftWidth - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });

      let scY = PPT_LAYOUT.contentStartY + 0.5;
      data.successCriteria.slice(0, 5).forEach((criterion) => {
        brSlide.addShape("rect", { x: rightX + 0.2, y: scY, w: leftWidth - 0.4, h: 0.56, fill: { color: "EEF2FF" }, line: { color: "C7D2FE", pt: 0.5 } });
        brSlide.addText((criterion.criterion || "Success criterion").substring(0, 34), { x: rightX + 0.28, y: scY + 0.05, w: leftWidth - 0.55, h: 0.16, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
        brSlide.addText(`Target: ${(criterion.target || "Target state").substring(0, 38)}`, { x: rightX + 0.28, y: scY + 0.23, w: leftWidth - 0.55, h: 0.14, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.indigo });
        if (criterion.measurement) {
          brSlide.addText((`Measure: ${criterion.measurement}`).substring(0, 44), { x: rightX + 0.28, y: scY + 0.38, w: leftWidth - 0.55, h: 0.14, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });
        }
        scY += 0.65;
      });
    }

    const riskSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(riskSlide, "Risk Assessment");

    const riskCardW = 1.6;
    addCard(riskSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, riskCardW, 0.65, { accent: PPTX_COLORS.danger });
    riskSlide.addText("Risk Level", { x: PPT_LAYOUT.marginLeft + 0.18, y: PPT_LAYOUT.contentStartY + 0.08, w: riskCardW - 0.25, h: 0.18, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
    riskSlide.addText(data.riskLevel.toUpperCase(), { x: PPT_LAYOUT.marginLeft + 0.18, y: PPT_LAYOUT.contentStartY + 0.28, w: riskCardW - 0.25, h: 0.3, fontSize: 16, bold: true, color: PPTX_COLORS.danger });

    addCard(riskSlide, PPT_LAYOUT.marginLeft + riskCardW + 0.15, PPT_LAYOUT.contentStartY, riskCardW, 0.65, { accent: PPTX_COLORS.amber });
    riskSlide.addText("Risk Score", { x: PPT_LAYOUT.marginLeft + riskCardW + 0.33, y: PPT_LAYOUT.contentStartY + 0.08, w: riskCardW - 0.25, h: 0.18, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
    riskSlide.addText(`${data.riskScore}/100`, { x: PPT_LAYOUT.marginLeft + riskCardW + 0.33, y: PPT_LAYOUT.contentStartY + 0.28, w: riskCardW - 0.25, h: 0.3, fontSize: 16, bold: true, color: PPTX_COLORS.amber });

    const getRiskCellColor = (row: number, col: number): string => {
      const riskScore = (2 - row) * (col + 1) + (col + 1);
      if (riskScore >= 6) return "FECACA";
      if (riskScore >= 4) return "FED7AA";
      if (riskScore >= 2) return "FEF9C3";
      return "DCFCE7";
    };

    const cellSize = 0.7;
    const matrixX = 4.5;
    const matrixY = 1.0;

    riskSlide.addText("IMPACT", { x: matrixX - 0.6, y: matrixY + cellSize * 1.5, w: 0.5, h: 0.3, fontSize: 7, color: PPTX_COLORS.gray, rotate: 270 });
    riskSlide.addText("LIKELIHOOD", { x: matrixX + cellSize * 1.5 - 0.4, y: matrixY + cellSize * 3 + 0.1, w: 1, h: 0.2, fontSize: 7, color: PPTX_COLORS.gray });

    const impactLabels = ["High", "Med", "Low"];
    const likeLabels = ["Low", "Med", "High"];

    impactLabels.forEach((label, i) => {
      riskSlide.addText(label, { x: matrixX - 0.35, y: matrixY + i * cellSize + cellSize / 2 - 0.08, w: 0.35, h: 0.2, fontSize: 6, color: PPTX_COLORS.gray });
    });
    likeLabels.forEach((label, i) => {
      riskSlide.addText(label, { x: matrixX + i * cellSize + cellSize / 2 - 0.15, y: matrixY + cellSize * 3 + 0.02, w: 0.4, h: 0.15, fontSize: 6, color: PPTX_COLORS.gray });
    });

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        riskSlide.addShape("rect", {
          x: matrixX + col * cellSize,
          y: matrixY + row * cellSize,
          w: cellSize,
          h: cellSize,
          fill: { color: getRiskCellColor(row, col) },
          line: { color: "E2E8F0", pt: 0.5 },
        });

        const impactLevel = row === 0 ? "high" : row === 1 ? "medium" : "low";
        const likeLevel = col === 0 ? "low" : col === 1 ? "medium" : "high";
        const risksInCell = data.risks.filter((r) => {
          const rImpact = (r.impact || "").toLowerCase();
          const rProb = (r.probability || "").toLowerCase();
          return rImpact.includes(impactLevel) && rProb.includes(likeLevel);
        });

        if (risksInCell.length > 0) {
          riskSlide.addText(risksInCell.length.toString(), {
            x: matrixX + col * cellSize,
            y: matrixY + row * cellSize + cellSize / 2 - 0.12,
            w: cellSize,
            h: 0.25,
            fontSize: 12,
            bold: true,
            color: PPTX_COLORS.text,
            align: "center",
          });
        }
      }
    }

    riskSlide.addText("Key Risks:", { x: 7, y: 1.0, w: 2.5, h: 0.25, fontSize: 10, bold: true, color: PPTX_COLORS.text });
    data.risks.slice(0, 4).forEach((r, i) => {
      const riskName = r.name || r.description || `Risk ${i + 1}`;
      riskSlide.addText(`${i + 1}. ${riskName.substring(0, 30)}`, { x: 7, y: 1.3 + i * 0.25, w: 2.8, h: 0.22, fontSize: 7, color: PPTX_COLORS.text });
    });

    if (data.risks.length > 0) {
      riskSlide.addShape("rect", { x: 0.5, y: 3.3, w: 9, h: 0.3, fill: { color: PPTX_COLORS.primary } });
      riskSlide.addText("Identified Risks", { x: 0.6, y: 3.32, w: 4, h: 0.25, fontSize: 10, bold: true, color: "FFFFFF" });
      riskSlide.addText("Impact", { x: 5.8, y: 3.32, w: 1.2, h: 0.25, fontSize: 9, bold: true, color: "FFFFFF", align: "center" });
      riskSlide.addText("Probability", { x: 7.1, y: 3.32, w: 1.3, h: 0.25, fontSize: 9, bold: true, color: "FFFFFF", align: "center" });
      riskSlide.addText("Status", { x: 8.4, y: 3.32, w: 1, h: 0.25, fontSize: 9, bold: true, color: "FFFFFF", align: "center" });

      let riskTableY = 3.65;
      data.risks.slice(0, 5).forEach((r, idx) => {
        const bgColor = idx % 2 === 0 ? "F8FAFC" : "FFFFFF";
        const riskName = (r.name || r.description || `Risk ${idx + 1}`).substring(0, 60);
        const impact = r.impact || "Medium";
        const prob = r.probability || "Medium";

        riskSlide.addShape("rect", { x: 0.5, y: riskTableY, w: 9, h: 0.35, fill: { color: bgColor } });
        riskSlide.addText(`${idx + 1}. ${riskName}`, { x: 0.6, y: riskTableY + 0.05, w: 5.1, h: 0.25, fontSize: 8, color: PPTX_COLORS.text });

        const impactColor = impact.toLowerCase().includes("high") ? PPTX_COLORS.danger : impact.toLowerCase().includes("low") ? PPTX_COLORS.lightBlue : PPTX_COLORS.amber;
        const probColor = prob.toLowerCase().includes("high") ? PPTX_COLORS.danger : prob.toLowerCase().includes("low") ? PPTX_COLORS.lightBlue : PPTX_COLORS.amber;

        riskSlide.addShape("rect", { x: 5.9, y: riskTableY + 0.05, w: 1.0, h: 0.22, fill: { color: impactColor }, line: { color: impactColor, pt: 0.5 } });
        riskSlide.addText(impact.substring(0, 8), { x: 5.9, y: riskTableY + 0.06, w: 1.0, h: 0.2, fontSize: 7, bold: true, color: "FFFFFF", align: "center" });

        riskSlide.addShape("rect", { x: 7.2, y: riskTableY + 0.05, w: 1.0, h: 0.22, fill: { color: probColor }, line: { color: probColor, pt: 0.5 } });
        riskSlide.addText(prob.substring(0, 8), { x: 7.2, y: riskTableY + 0.06, w: 1.0, h: 0.2, fontSize: 7, bold: true, color: "FFFFFF", align: "center" });

        riskSlide.addShape("rect", { x: 8.5, y: riskTableY + 0.05, w: 0.9, h: 0.22, fill: { color: PPTX_COLORS.indigo }, line: { color: PPTX_COLORS.indigo, pt: 0.5 } });
        riskSlide.addText("Active", { x: 8.5, y: riskTableY + 0.06, w: 0.9, h: 0.2, fontSize: 7, bold: true, color: "FFFFFF", align: "center" });

        riskTableY += 0.38;
      });
    }

    if (data.stakeholders.length > 0) {
      const stSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      stSlide.addText("Stakeholder Analysis", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });

      const computePowerInterestMatrix = () => {
        const matrix = { manageClosely: [] as string[], keepSatisfied: [] as string[], keepInformed: [] as string[], monitor: [] as string[] };
        data.stakeholders.forEach((s) => {
          const influence = (s.influence || "").toLowerCase();
          const interest = (s.interest || "").toLowerCase();
          const name = s.name || "Unknown";
          if (influence.includes("high") && interest.includes("high")) matrix.manageClosely.push(name);
          else if (influence.includes("high")) matrix.keepSatisfied.push(name);
          else if (interest.includes("high")) matrix.keepInformed.push(name);
          else matrix.monitor.push(name);
        });
        return matrix;
      };

      const matrix = computePowerInterestMatrix();
      const quadSize = 1.6;
      const quadX = 0.8;
      const quadY = 1.2;

      stSlide.addText("POWER", { x: quadX - 0.6, y: quadY + quadSize, w: 0.5, h: 0.3, fontSize: 8, color: PPTX_COLORS.gray, rotate: 270 });
      stSlide.addText("INTEREST", { x: quadX + quadSize - 0.3, y: quadY + quadSize * 2 + 0.15, w: 1, h: 0.2, fontSize: 8, color: PPTX_COLORS.gray });
      stSlide.addText("High", { x: quadX - 0.4, y: quadY + quadSize / 2 - 0.1, w: 0.4, h: 0.2, fontSize: 7, color: PPTX_COLORS.gray });
      stSlide.addText("Low", { x: quadX - 0.4, y: quadY + quadSize * 1.5 - 0.1, w: 0.4, h: 0.2, fontSize: 7, color: PPTX_COLORS.gray });
      stSlide.addText("Low", { x: quadX + quadSize / 2 - 0.15, y: quadY + quadSize * 2 + 0.05, w: 0.4, h: 0.15, fontSize: 7, color: PPTX_COLORS.gray });
      stSlide.addText("High", { x: quadX + quadSize * 1.5 - 0.15, y: quadY + quadSize * 2 + 0.05, w: 0.4, h: 0.15, fontSize: 7, color: PPTX_COLORS.gray });

      const quadrants = [
        { x: 0, y: 0, title: "Keep Satisfied", color: "FEF3C7", items: matrix.keepSatisfied },
        { x: 1, y: 0, title: "Manage Closely", color: "FECACA", items: matrix.manageClosely },
        { x: 0, y: 1, title: "Monitor", color: "F1F5F9", items: matrix.monitor },
        { x: 1, y: 1, title: "Keep Informed", color: "DBEAFE", items: matrix.keepInformed },
      ];

      quadrants.forEach((q) => {
        const qx = quadX + q.x * quadSize;
        const qy = quadY + q.y * quadSize;
        stSlide.addShape("rect", { x: qx, y: qy, w: quadSize, h: quadSize, fill: { color: q.color }, line: { color: "E2E8F0", pt: 0.5 } });
        stSlide.addText(q.title, { x: qx + 0.08, y: qy + 0.08, w: quadSize - 0.1, h: 0.25, fontSize: 8, bold: true, color: PPTX_COLORS.text });
        q.items.slice(0, 3).forEach((name, idx) => {
          stSlide.addText(`• ${name.substring(0, 18)}`, { x: qx + 0.08, y: qy + 0.35 + idx * 0.22, w: quadSize - 0.15, h: 0.2, fontSize: 6, color: PPTX_COLORS.text });
        });
        if (q.items.length > 3) {
          stSlide.addText(`+${q.items.length - 3} more`, { x: qx + 0.08, y: qy + 1.0, w: quadSize - 0.15, h: 0.18, fontSize: 6, color: PPTX_COLORS.gray });
        }
      });

      stSlide.addText("All Stakeholders:", { x: 5, y: 1.2, w: 4.5, h: 0.3, fontSize: 10, bold: true, color: PPTX_COLORS.text });
      const stRows = data.stakeholders.slice(0, 6).map((s) => [
        { text: s.name || "Unknown", options: { fontSize: 8 } },
        { text: s.role || "", options: { fontSize: 8 } },
        { text: s.influence || "Med", options: { fontSize: 8 } },
        { text: s.interest || "Med", options: { fontSize: 8 } },
      ]);
      stSlide.addTable(
        [[{ text: "Name", options: { bold: true } }, { text: "Role", options: { bold: true } }, { text: "Power", options: { bold: true } }, { text: "Interest", options: { bold: true } }], ...stRows],
        { x: 5, y: 1.5, w: 4.5, colW: [1.4, 1.6, 0.7, 0.7], fontSize: 8, border: { pt: 0.5, color: "E2E8F0" }, fill: { color: "FFFFFF" } }
      );
    }

    if (data.implementationPhases.length > 0 || data.implementationRoadmap.milestones.length > 0) {
      const planSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(planSlide, "Implementation Plan & Milestones");

      if (data.implementationPhases.length > 0) {
        const phaseWidth = PPT_LAYOUT.contentWidth / Math.min(data.implementationPhases.length, 4);
        const phaseColors = [
          { bg: "E0F2FE", text: "0284C7" },
          { bg: "DBEAFE", text: "1D4ED8" },
          { bg: "E0E7FF", text: "4338CA" },
          { bg: "EDE9FE", text: "6D28D9" },
        ];

        data.implementationPhases.slice(0, 4).forEach((phase, idx) => {
          const phaseX = PPT_LAYOUT.marginLeft + idx * phaseWidth;
          const color = phaseColors[idx % 4]!;

          planSlide.addShape("roundRect", { x: phaseX, y: PPT_LAYOUT.contentStartY, w: phaseWidth - 0.08, h: 2.1, fill: { color: color.bg }, line: { color: "E2E8F0", pt: 0.5 } });
          planSlide.addText(`Phase ${idx + 1}`, { x: phaseX + 0.08, y: PPT_LAYOUT.contentStartY + 0.06, w: phaseWidth - 0.2, h: 0.2, fontSize: PPT_FONTS.small, bold: true, color: color.text });
          planSlide.addText((phase.name || "").substring(0, 22), { x: phaseX + 0.08, y: PPT_LAYOUT.contentStartY + 0.28, w: phaseWidth - 0.2, h: 0.22, fontSize: PPT_FONTS.body, bold: true, color: PPTX_COLORS.text });
          planSlide.addText(phase.duration || "", { x: phaseX + 0.08, y: PPT_LAYOUT.contentStartY + 0.52, w: phaseWidth - 0.2, h: 0.16, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray });

          let delY = PPT_LAYOUT.contentStartY + 0.72;
          (phase.deliverables || []).slice(0, 4).forEach((del) => {
            const delText = typeof del === "string" ? del : (del as DeliverableItem).name || (del as DeliverableItem).description || String(del);
            planSlide.addText(`• ${delText.substring(0, 20)}`, { x: phaseX + 0.08, y: delY, w: phaseWidth - 0.2, h: 0.18, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.text });
            delY += 0.2;
          });
        });
      }

      if (data.implementationRoadmap.milestones.length > 0) {
        const msY = data.implementationPhases.length > 0 ? 3.4 : PPT_LAYOUT.contentStartY;
        planSlide.addText("Key Milestones", { x: PPT_LAYOUT.marginLeft, y: msY, w: PPT_LAYOUT.contentWidth, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.text });
        planSlide.addShape("rect", { x: PPT_LAYOUT.marginLeft, y: msY + 0.55, w: PPT_LAYOUT.contentWidth, h: 0.04, fill: { color: PPTX_COLORS.teal } });

        const msCount = Math.min(data.implementationRoadmap.milestones.length, 5);
        const msWidth = PPT_LAYOUT.contentWidth / msCount;

        data.implementationRoadmap.milestones.slice(0, 5).forEach((ms, idx) => {
          const msX = PPT_LAYOUT.marginLeft + idx * msWidth + msWidth / 2;
          planSlide.addShape("ellipse", { x: msX - 0.1, y: msY + 0.45, w: 0.22, h: 0.22, fill: { color: PPTX_COLORS.teal } });
          planSlide.addShape("ellipse", { x: msX - 0.05, y: msY + 0.5, w: 0.12, h: 0.12, fill: { color: "FFFFFF" } });
          planSlide.addText((ms.name || `M${idx + 1}`).substring(0, 18), { x: msX - msWidth / 2 + 0.05, y: msY + 0.75, w: msWidth - 0.1, h: 0.22, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal, align: "center" });
          planSlide.addText(ms.date || "", { x: msX - msWidth / 2 + 0.05, y: msY + 0.98, w: msWidth - 0.1, h: 0.16, fontSize: PPT_FONTS.caption, color: PPTX_COLORS.gray, align: "center" });
        });
      }
    }


    const finOverviewSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    addSlideTitle(finOverviewSlide, "Financial Projections & Analysis");

    // Generate QuickChart image for professional chart in PPTX
    const pptxCashFlowData = data.cashFlowProjection.length > 0 ? data.cashFlowProjection : [{ year: "Year 0", costs: 0, benefits: 0, cumulative: 0 }];
    const pptxChartConfig = {
      type: "bar",
      data: {
        labels: pptxCashFlowData.map(cf => (cf.year || "").replace("Year ", "Y")),
        datasets: [
          {
            type: "bar",
            label: "Costs",
            data: pptxCashFlowData.map(cf => -(cf.costs || 0)),
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            borderColor: "#dc2626",
            borderWidth: 2,
            borderRadius: 4,
            order: 2
          },
          {
            type: "bar",
            label: "Benefits",
            data: pptxCashFlowData.map(cf => cf.benefits || 0),
            backgroundColor: "rgba(34, 197, 94, 0.7)",
            borderColor: "#16a34a",
            borderWidth: 2,
            borderRadius: 4,
            order: 2
          },
          {
            type: "line",
            label: "Cumulative Value",
            data: pptxCashFlowData.map(cf => cf.cumulative || 0),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointRadius: 6,
            pointBackgroundColor: pptxCashFlowData.map(cf => (cf.cumulative || 0) >= 0 ? "#22c55e" : "#ef4444"),
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "5-Year Financial Trajectory", font: { size: 18, weight: "bold" }, color: "#1e293b" },
          legend: { display: true, position: "top", labels: { font: { size: 11 }, usePointStyle: true } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 13, weight: "bold" } } },
          y: {
            grid: { color: "rgba(0,0,0,0.06)" },
            ticks: {
              font: { size: 11 },
              callback: function(value: number) {
                if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + "M";
                if (Math.abs(value) >= 1000) return (value / 1000).toFixed(0) + "K";
                return value;
              }
            }
          }
        }
      }
    };

    const pptxChartImage = await generateChartImage(pptxChartConfig);
    if (pptxChartImage) {
      finOverviewSlide.addShape("rect", { x: 0.3, y: 1.0, w: 6.0, h: 3.2, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", pt: 0.5 } });
      finOverviewSlide.addImage({ data: `data:image/png;base64,${pptxChartImage}`, x: 0.4, y: 1.05, w: 5.8, h: 3.1 });
    } else {
      // Fallback: simple bar chart using shapes
      finOverviewSlide.addShape("rect", { x: 0.3, y: 1.0, w: 6.0, h: 3.2, fill: { color: "F8FAFC" }, line: { color: "E2E8F0", pt: 0.5 } });
      finOverviewSlide.addText("5-Year Value Trajectory", { x: 0.5, y: 1.1, w: 5.6, h: 0.3, fontSize: 10, bold: true, color: PPTX_COLORS.text });

      const pptxMaxVal = Math.max(...pptxCashFlowData.map(p => Math.abs(p.cumulative || 0)), 1);
      const pptxBarAreaHeight = 2.2;
      const zeroLineY = 1.5 + pptxBarAreaHeight / 2;
      finOverviewSlide.addShape("rect", { x: 0.6, y: zeroLineY - 0.01, w: 5.2, h: 0.02, fill: { color: "CBD5E1" } });

      const pptxBarWidth = (5.2 / pptxCashFlowData.length) - 0.1;
      pptxCashFlowData.forEach((point, i) => {
        const bx = 0.6 + i * (5.2 / pptxCashFlowData.length) + 0.05;
        const cumVal = point.cumulative || 0;
        const barHeight = (Math.abs(cumVal) / pptxMaxVal) * (pptxBarAreaHeight / 2 - 0.1);

        if (cumVal >= 0) {
          finOverviewSlide.addShape("rect", { x: bx, y: zeroLineY - barHeight, w: pptxBarWidth, h: barHeight, fill: { color: "10B981" } });
        } else {
          finOverviewSlide.addShape("rect", { x: bx, y: zeroLineY, w: pptxBarWidth, h: barHeight, fill: { color: "EF4444" } });
        }
        finOverviewSlide.addText((point.year || `Y${i + 1}`).replace("Year ", "Y"), { x: bx, y: 1.5 + pptxBarAreaHeight + 0.05, w: pptxBarWidth, h: 0.15, fontSize: 7, color: PPTX_COLORS.gray, align: "center" });
      });
    }

    // Scenario Analysis panel (right side)
    finOverviewSlide.addShape("rect", { x: 6.5, y: 1.0, w: 3.1, h: 3.2, fill: { color: "FFFFFF" }, line: { color: "E2E8F0", pt: 0.5 } });
    finOverviewSlide.addText("Scenario Analysis", { x: 6.6, y: 1.05, w: 2.9, h: 0.3, fontSize: 10, bold: true, color: PPTX_COLORS.text });

    const pptxBaseNpv = data.financialMetrics.npv || 0;
    const pptxScenarios = [
      { name: "Best Case", npv: pptxBaseNpv * 1.2, roi: `${(data.financialMetrics.roi * 1.15).toFixed(0)}%`, color: "10B981" },
      { name: "Base Case", npv: pptxBaseNpv, roi: `${data.financialMetrics.roi.toFixed(0)}%`, color: "3B82F6" },
      { name: "Worst Case", npv: pptxBaseNpv * 0.6, roi: `${(data.financialMetrics.roi * 0.7).toFixed(0)}%`, color: "EF4444" },
    ];

    pptxScenarios.forEach((sc, i) => {
      const scY = 1.45 + i * 0.85;
      finOverviewSlide.addShape("roundRect", { x: 6.6, y: scY, w: 2.9, h: 0.75, fill: { color: sc.color } });
      finOverviewSlide.addText(sc.name, { x: 6.7, y: scY + 0.08, w: 2.7, h: 0.2, fontSize: 9, bold: true, color: "FFFFFF" });
      finOverviewSlide.addText(`NPV: ${formatCurrency(sc.npv)}`, { x: 6.7, y: scY + 0.3, w: 1.5, h: 0.2, fontSize: 10, bold: true, color: "FFFFFF" });
      finOverviewSlide.addText(`ROI: ${sc.roi}`, { x: 8.2, y: scY + 0.3, w: 1.3, h: 0.2, fontSize: 10, bold: true, color: "FFFFFF", align: "right" });
    });

    // Key metrics bar at bottom
    finOverviewSlide.addShape("rect", { x: 0.3, y: 4.4, w: 9.3, h: 0.75, fill: { color: "F1F5F9" }, line: { color: "E2E8F0", pt: 0.5 } });
    const bottomMetrics = [
      { label: "NPV", value: formatCurrency(data.financialMetrics.npv) },
      { label: "ROI", value: `${data.financialMetrics.roi.toFixed(1)}%` },
      { label: "Payback", value: data.financialMetrics.paybackPeriod > 0 ? `${data.financialMetrics.paybackPeriod.toFixed(1)} Yrs` : "N/A" },
      { label: "Total Investment", value: formatCurrency(data.financialMetrics.tco || data.financialMetrics.totalCost) },
      { label: "Total Benefits", value: formatCurrency(data.financialMetrics.totalBenefit || 0) },
    ];
    bottomMetrics.forEach((bm, idx) => {
      const bmX = 0.5 + idx * 1.8;
      finOverviewSlide.addText(bm.label, { x: bmX, y: 4.42, w: 1.6, h: 0.2, fontSize: 7, color: PPTX_COLORS.gray });
      finOverviewSlide.addText(bm.value, { x: bmX, y: 4.62, w: 1.6, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.text });
    });

    // ── COST & BENEFIT BREAKDOWN SLIDE ──
    if (data.detailedCosts.length > 0 || data.detailedBenefits.length > 0) {
      const cbSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(cbSlide, "Cost & Benefit Breakdown");

      const cbHalfW = (PPT_LAYOUT.contentWidth - PPT_LAYOUT.columnGap) / 2;

      // Cost breakdown left panel
      addCard(cbSlide, PPT_LAYOUT.marginLeft, PPT_LAYOUT.contentStartY, cbHalfW, 3.9, { accent: PPTX_COLORS.danger });
      cbSlide.addText("Investment Costs", { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 0.1, w: cbHalfW - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.danger });

      let costY = PPT_LAYOUT.contentStartY + 0.45;
      const costItems = data.detailedCosts.slice(0, 6);
      if (costItems.length > 0) {
        costItems.forEach((cost) => {
          const costName = (cost.name || cost.description || "Cost Item").substring(0, 35);
          const yrs = [cost.year0, cost.year1, cost.year2, cost.year3, cost.year4, cost.year5];
          const sum = yrs.reduce<number>((s, v) => s + parseNumeric(v), 0);
          const totalAmt = sum > 0 ? sum : (cost.amount || 0);

          cbSlide.addShape("rect", { x: PPT_LAYOUT.marginLeft + 0.2, y: costY, w: cbHalfW - 0.4, h: 0.45, fill: { color: "FEF2F2" }, line: { color: "FECACA", pt: 0.5 } });
          cbSlide.addText(costName, { x: PPT_LAYOUT.marginLeft + 0.25, y: costY + 0.04, w: cbHalfW - 0.7, h: 0.18, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
          cbSlide.addText(formatCurrency(totalAmt), { x: PPT_LAYOUT.marginLeft + cbHalfW - 1.2, y: costY + 0.04, w: 0.95, h: 0.18, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.danger, align: "right" });
          cbSlide.addText(cost.category || "—", { x: PPT_LAYOUT.marginLeft + 0.25, y: costY + 0.24, w: cbHalfW - 0.5, h: 0.15, fontSize: 6, color: PPTX_COLORS.gray });
          costY += 0.52;
        });
      } else {
        cbSlide.addText("No detailed costs available", { x: PPT_LAYOUT.marginLeft + 0.2, y: costY, w: cbHalfW - 0.3, h: 0.2, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
      }

      // Total cost footer
      cbSlide.addShape("rect", { x: PPT_LAYOUT.marginLeft + 0.15, y: PPT_LAYOUT.contentStartY + 3.5, w: cbHalfW - 0.3, h: 0.3, fill: { color: PPTX_COLORS.danger } });
      cbSlide.addText(`Total: ${formatCurrency(data.financialMetrics.tco || data.financialMetrics.totalCost)}`, { x: PPT_LAYOUT.marginLeft + 0.2, y: PPT_LAYOUT.contentStartY + 3.52, w: cbHalfW - 0.4, h: 0.25, fontSize: 10, bold: true, color: "FFFFFF", align: "center" });

      // Benefit breakdown right panel
      const rightX = PPT_LAYOUT.marginLeft + cbHalfW + PPT_LAYOUT.columnGap;
      addCard(cbSlide, rightX, PPT_LAYOUT.contentStartY, cbHalfW, 3.9, { accent: PPTX_COLORS.teal });
      cbSlide.addText("Expected Benefits", { x: rightX + 0.2, y: PPT_LAYOUT.contentStartY + 0.1, w: cbHalfW - 0.3, h: 0.28, fontSize: PPT_FONTS.heading, bold: true, color: PPTX_COLORS.teal });

      let benY = PPT_LAYOUT.contentStartY + 0.45;
      const benefitItems = data.detailedBenefits.slice(0, 6);
      if (benefitItems.length > 0) {
        benefitItems.forEach((benefit) => {
          const benName = (benefit.name || benefit.description || "Benefit Item").substring(0, 35);
          const yrs = [benefit.year1, benefit.year2, benefit.year3, benefit.year4, benefit.year5];
          const sum = yrs.reduce<number>((s, v) => s + parseNumeric(v), 0);
          const totalBen = sum > 0 ? sum : (benefit.amount || 0);

          cbSlide.addShape("rect", { x: rightX + 0.2, y: benY, w: cbHalfW - 0.4, h: 0.45, fill: { color: "F0FDF4" }, line: { color: "BBF7D0", pt: 0.5 } });
          cbSlide.addText(benName, { x: rightX + 0.25, y: benY + 0.04, w: cbHalfW - 0.7, h: 0.18, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.text });
          cbSlide.addText(formatCurrency(totalBen), { x: rightX + cbHalfW - 1.2, y: benY + 0.04, w: 0.95, h: 0.18, fontSize: PPT_FONTS.small, bold: true, color: PPTX_COLORS.teal, align: "right" });
          cbSlide.addText(`${benefit.category || "—"} • ${benefit.confidence || "—"}`, { x: rightX + 0.25, y: benY + 0.24, w: cbHalfW - 0.5, h: 0.15, fontSize: 6, color: PPTX_COLORS.gray });
          benY += 0.52;
        });
      } else {
        cbSlide.addText("No detailed benefits available", { x: rightX + 0.2, y: benY, w: cbHalfW - 0.3, h: 0.2, fontSize: PPT_FONTS.small, color: PPTX_COLORS.gray });
      }

      // Total benefit footer
      cbSlide.addShape("rect", { x: rightX + 0.15, y: PPT_LAYOUT.contentStartY + 3.5, w: cbHalfW - 0.3, h: 0.3, fill: { color: "10B981" } });
      cbSlide.addText(`Total: ${formatCurrency(data.financialMetrics.totalBenefit || 0)}`, { x: rightX + 0.2, y: PPT_LAYOUT.contentStartY + 3.52, w: cbHalfW - 0.4, h: 0.25, fontSize: 10, bold: true, color: "FFFFFF", align: "center" });
    }

    // ── CASH FLOW PROJECTIONS TABLE SLIDE ──
    {
      const cfSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      addSlideTitle(cfSlide, "5-Year Cash Flow Projections");

      const cfRows = pptxCashFlowData.map((cf) => [
        { text: (cf.year || "").replace("Year ", "Y"), options: { fontSize: 9, bold: true } },
        { text: formatCurrency(cf.benefits || 0), options: { fontSize: 9, color: "16A34A" } },
        { text: formatCurrency(cf.costs || 0), options: { fontSize: 9, color: "DC2626" } },
        { text: formatCurrency((cf.benefits || 0) - (cf.costs || 0)), options: { fontSize: 9, bold: true, color: ((cf.benefits || 0) - (cf.costs || 0)) >= 0 ? "16A34A" : "DC2626" } },
        { text: formatCurrency(cf.cumulative || 0), options: { fontSize: 9, bold: true, color: (cf.cumulative || 0) >= 0 ? "3B82F6" : "DC2626" } },
      ]);

      cfSlide.addTable(
        [
          [
            { text: "Year", options: { bold: true, fill: { color: PPTX_COLORS.primary }, color: "FFFFFF" } },
            { text: "Benefits", options: { bold: true, fill: { color: PPTX_COLORS.primary }, color: "FFFFFF" } },
            { text: "Costs", options: { bold: true, fill: { color: PPTX_COLORS.primary }, color: "FFFFFF" } },
            { text: "Net Cash Flow", options: { bold: true, fill: { color: PPTX_COLORS.primary }, color: "FFFFFF" } },
            { text: "Cumulative", options: { bold: true, fill: { color: PPTX_COLORS.primary }, color: "FFFFFF" } },
          ],
          ...cfRows,
        ],
        {
          x: 0.5, y: PPT_LAYOUT.contentStartY, w: 9, colW: [1.2, 2, 2, 2, 1.8],
          fontSize: 9, border: { pt: 0.5, color: "E2E8F0" }, fill: { color: "FFFFFF" },
          rowH: 0.4,
        }
      );

      // Key assumptions below table
      const cfTableBottom = PPT_LAYOUT.contentStartY + 0.4 * (pptxCashFlowData.length + 1) + 0.3;
      cfSlide.addShape("rect", { x: 0.5, y: cfTableBottom, w: 9, h: 1.2, fill: { color: "FFFBEB" }, line: { color: "FDE68A", pt: 0.5 } });
      cfSlide.addText("Key Assumptions", { x: 0.55, y: cfTableBottom + 0.05, w: 8.9, h: 0.25, fontSize: 9, bold: true, color: PPTX_COLORS.amber });

      let assumpY = cfTableBottom + 0.32;
      if (data.assumptions.length > 0) {
        data.assumptions.slice(0, 3).forEach((a) => {
          const assumeText = a.length > 90 ? a.substring(0, 87) + "..." : a;
          cfSlide.addText(`• ${assumeText}`, { x: 0.6, y: assumpY, w: 8.8, h: 0.26, fontSize: 8, color: PPTX_COLORS.text });
          assumpY += 0.28;
        });
      } else {
        cfSlide.addText("No assumptions documented", { x: 0.6, y: assumpY, w: 8.8, h: 0.22, fontSize: 8, color: PPTX_COLORS.gray });
      }
    }

    if (data.kpis.length > 0) {
      const kpiSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      kpiSlide.addText("KPIs & Success Metrics", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });

      const kpiRows = data.kpis.slice(0, 8).map((k) => [
        { text: (typeof k === "string" ? k : k.name || "KPI").substring(0, 40), options: { fontSize: 9 } },
        { text: k.target || "TBD", options: { fontSize: 9 } },
        { text: k.baseline || "N/A", options: { fontSize: 9 } },
      ]);
      kpiSlide.addTable(
        [[{ text: "KPI Name", options: { bold: true } }, { text: "Target", options: { bold: true } }, { text: "Baseline", options: { bold: true } }], ...kpiRows],
        { x: 0.5, y: 1.2, w: 9, colW: [5, 2, 2], fontSize: 9, border: { pt: 0.5, color: "E2E8F0" }, fill: { color: "FFFFFF" } }
      );
    }

    if (data.compliance.requirements.length > 0 || data.compliance.policyReferences.length > 0 || data.governance.oversight.length > 0 || data.governance.approvals.length > 0) {
      const compSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      compSlide.addText("Compliance & Governance", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });

      let compY = 1.2;
      if (data.compliance.requirements.length > 0) {
        compSlide.addText("Compliance Requirements:", { x: 0.5, y: compY, w: 9, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.purple });
        compY += 0.35;
        data.compliance.requirements.slice(0, 5).forEach((req) => {
          const name = typeof req === "string" ? req : req.name || req.description || "";
          compSlide.addText(`• ${name.substring(0, 70)}`, { x: 0.7, y: compY, w: 8.6, h: 0.25, fontSize: 9, color: PPTX_COLORS.text });
          compY += 0.28;
        });
        compY += 0.2;
      }

      if (data.compliance.policyReferences.length > 0) {
        compSlide.addText("Policy References:", { x: 0.5, y: compY, w: 9, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.purple });
        compY += 0.35;
        data.compliance.policyReferences.slice(0, 4).forEach((ref) => {
          compSlide.addText(`• ${ref.substring(0, 70)}`, { x: 0.7, y: compY, w: 8.6, h: 0.25, fontSize: 9, color: PPTX_COLORS.text });
          compY += 0.28;
        });
      }

      if (data.governance.oversight.length > 0 || data.governance.approvals.length > 0) {
        compY += 0.18;
        compSlide.addText("Governance Operating Model:", { x: 0.5, y: compY, w: 9, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.purple });
        compY += 0.35;
        [...data.governance.oversight.slice(0, 3), ...data.governance.approvals.slice(0, 2), ...(data.governance.cadence ? [`Cadence: ${data.governance.cadence}`] : [])].slice(0, 5).forEach((item) => {
          compSlide.addText(`• ${item.substring(0, 70)}`, { x: 0.7, y: compY, w: 8.6, h: 0.25, fontSize: 9, color: PPTX_COLORS.text });
          compY += 0.28;
        });
      }
    }

    if (data.assumptions.length > 0 || data.dependencies.length > 0) {
      const adSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      adSlide.addText("Assumptions & Dependencies", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });

      adSlide.addText("Key Assumptions:", { x: 0.5, y: 1.1, w: 4.2, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.amber });
      let assY = 1.4;
      if (data.assumptions.length > 0) {
        data.assumptions.slice(0, 6).forEach((a) => {
          adSlide.addText(`• ${a.substring(0, 45)}`, { x: 0.6, y: assY, w: 4.2, h: 0.25, fontSize: 8, color: PPTX_COLORS.text });
          assY += 0.26;
        });
      } else {
        adSlide.addText("No assumptions documented", { x: 0.6, y: assY, w: 4.2, h: 0.25, fontSize: 8, color: PPTX_COLORS.gray });
      }

      adSlide.addText("Dependencies:", { x: 5, y: 1.1, w: 4.5, h: 0.3, fontSize: 11, bold: true, color: PPTX_COLORS.amber });
      let depY = 1.4;
      if (data.dependencies.length > 0) {
        data.dependencies.slice(0, 6).forEach((d) => {
          adSlide.addText(`• ${d.substring(0, 45)}`, { x: 5.1, y: depY, w: 4.3, h: 0.25, fontSize: 8, color: PPTX_COLORS.text });
          depY += 0.26;
        });
      } else {
        adSlide.addText("No dependencies documented", { x: 5.1, y: depY, w: 4.3, h: 0.25, fontSize: 8, color: PPTX_COLORS.gray });
      }
    }

    if (data.backgroundContext) {
      const bgSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
      bgSlide.addText("Background & Context", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });
      bgSlide.addShape("rect", { x: 0.5, y: 1.1, w: 0.15, h: 3.5, fill: { color: PPTX_COLORS.indigo } });
      bgSlide.addText(data.backgroundContext.substring(0, 800) || "No background context available.", {
        x: 0.8, y: 1.1, w: 8.5, h: 3.5, fontSize: 10, color: PPTX_COLORS.text, valign: "top",
      });
    }

    const recoSlide = pptx.addSlide({ masterName: "COREVIA_MASTER" });
    recoSlide.addText("Recommendation", { x: 0.5, y: 0.6, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.text });

    recoSlide.addShape("rect", { x: 0.5, y: 1.3, w: 9, h: 1.5, fill: { color: "E0F2FE" } });
    recoSlide.addText(data.recommendations.decision || "Proceed with Implementation", {
      x: 0.7, y: 1.5, w: 8.6, h: 0.5, fontSize: 20, bold: true, color: PPTX_COLORS.lightBlue,
    });
    recoSlide.addText(data.recommendations.rationale || "Business case demonstrates positive ROI and strategic alignment.", {
      x: 0.7, y: 2.1, w: 8.6, h: 0.6, fontSize: 11, color: PPTX_COLORS.text,
    });

    if (data.recommendations.commercialCase || data.recommendations.publicValueCase) {
      recoSlide.addShape("rect", { x: 0.5, y: 3.05, w: 4.35, h: 1.0, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", pt: 0.5 } });
      recoSlide.addText("Commercial Case", { x: 0.7, y: 3.17, w: 3.8, h: 0.2, fontSize: 11, bold: true, color: PPTX_COLORS.text });
      recoSlide.addText((data.recommendations.commercialCase || "Commercial case not provided.").substring(0, 160), { x: 0.7, y: 3.43, w: 3.95, h: 0.46, fontSize: 8.5, color: PPTX_COLORS.text });
      recoSlide.addShape("rect", { x: 5.15, y: 3.05, w: 4.35, h: 1.0, fill: { color: "F0FDFA" }, line: { color: "99F6E4", pt: 0.5 } });
      recoSlide.addText("Public-Value Case", { x: 5.35, y: 3.17, w: 3.8, h: 0.2, fontSize: 11, bold: true, color: PPTX_COLORS.text });
      recoSlide.addText((data.recommendations.publicValueCase || "Public-value case not provided.").substring(0, 160), { x: 5.35, y: 3.43, w: 3.95, h: 0.46, fontSize: 8.5, color: PPTX_COLORS.text });
    }

    if (data.conclusionSummary) {
      recoSlide.addText(data.conclusionSummary.substring(0, 180), {
        x: 0.7, y: 2.7, w: 8.6, h: 0.35, fontSize: 9, color: PPTX_COLORS.gray,
      });
    }

    if (data.recommendations.nextSteps.length > 0) {
      const nextStepsY = data.recommendations.commercialCase || data.recommendations.publicValueCase ? 4.2 : 3.15;
      recoSlide.addText("Next Steps:", { x: 0.5, y: nextStepsY, w: 9, h: 0.35, fontSize: 12, bold: true, color: PPTX_COLORS.text });

      let nsY = nextStepsY + 0.4;
      data.recommendations.nextSteps.slice(0, 5).forEach((step, i) => {
        recoSlide.addText(`${i + 1}. ${step.substring(0, 80)}`, { x: 0.7, y: nsY, w: 8.6, h: 0.3, fontSize: 10, color: PPTX_COLORS.text });
        nsY += 0.35;
      });
    }

    const pptxBuffer = pptx.write({ outputType: "nodebuffer" }) as unknown as Buffer;
    logger.info("[DocumentAgent] PPTX generated successfully, size:", pptxBuffer.length, "bytes");
    return pptxBuffer;
  }
}

export const documentAgent = new DocumentGenerationAgent();
