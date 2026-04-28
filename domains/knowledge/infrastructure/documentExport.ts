import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import PptxGenJS from 'pptxgenjs';
import { format } from "date-fns";
import * as fs from "fs";
import * as path from "path";
import { logger } from "@platform/logging/Logger";
import { COLORS, PPTX_COLORS, SPACING, TYPOGRAPHY } from "./documentExport.constants";
import type {
  AssumptionItem,
  BenefitItem,
  BusinessCaseData,
  CashFlowItem,
  CurrencyValue,
  Deliverable,
  DemandReport,
  DependencyItem,
  ExportDataBundle,
  ExportOptions,
  GovernanceGate,
  GovernanceRequirementsExpanded,
  KPIItem,
  PowerInterestMatrixData,
  RequirementItem,
  RevenueStream,
  RiskItem,
  RoadmapItem,
  SmartObjective,
  Stakeholder,
  StrategicFitRecommendation,
  SuccessCriterion,
  TimelinePhase,
  VersionData,
  AssumptionRiskItem,
} from "./documentExport.types";

const PptxGenJSConstructor: typeof PptxGenJS = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ?? PptxGenJS);

export class DocumentExportService {
  private logoBase64: string | null = null;
  private dubaiRegularFont: string | null = null;
  private dubaiBoldFont: string | null = null;

  constructor() {
    this.loadLogo();
    this.loadFonts();
  }

  private loadLogo(): void {
    try {
      const pngLogoPath = path.join(process.cwd(), 'attached_assets', 'corevia-logo.png');
      const svgLogoPath = path.join(process.cwd(), 'attached_assets', 'corevia-logo.svg');
      const legacyLogoPath = path.join(process.cwd(), 'attached_assets', 'image_1768499937059.png');
      if (fs.existsSync(pngLogoPath)) {
        const pngBuffer = fs.readFileSync(pngLogoPath);
        this.logoBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        logger.info('[DocumentExport] PNG Logo loaded successfully');
      } else if (fs.existsSync(svgLogoPath)) {
        const svgBuffer = fs.readFileSync(svgLogoPath);
        this.logoBase64 = `data:image/svg+xml;base64,${svgBuffer.toString('base64')}`;
        logger.info('[DocumentExport] SVG Logo loaded successfully');
      } else if (fs.existsSync(legacyLogoPath)) {
        const logoBuffer = fs.readFileSync(legacyLogoPath);
        this.logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        logger.info('[DocumentExport] Legacy PNG Logo loaded successfully');
      }
    } catch (error) {
      logger.error('[DocumentExport] Error loading logo:', error);
    }
  }

  private loadFonts(): void {
    try {
      const regularPath = path.join(process.cwd(), 'fonts', 'Dubai-Regular.b64');
      const boldPath = path.join(process.cwd(), 'fonts', 'Dubai-Bold.b64');

      if (fs.existsSync(regularPath)) {
        this.dubaiRegularFont = fs.readFileSync(regularPath, 'utf-8');
        logger.info('[DocumentExport] Dubai Regular font loaded');
      }
      if (fs.existsSync(boldPath)) {
        this.dubaiBoldFont = fs.readFileSync(boldPath, 'utf-8');
        logger.info('[DocumentExport] Dubai Bold font loaded');
      }
    } catch (error) {
      logger.error('[DocumentExport] Error loading fonts:', error);
    }
  }

  private registerDubaiFonts(doc: jsPDF): void {
    if (this.dubaiRegularFont) {
      doc.addFileToVFS('Dubai-Regular.ttf', this.dubaiRegularFont);
      doc.addFont('Dubai-Regular.ttf', 'Dubai', 'normal');
    }
    if (this.dubaiBoldFont) {
      doc.addFileToVFS('Dubai-Bold.ttf', this.dubaiBoldFont);
      doc.addFont('Dubai-Bold.ttf', 'Dubai', 'bold');
    }
  }

  async export(options: ExportOptions): Promise<Buffer> {
    const { storage, reportId, versionId, type, format } = options;

    const report = await storage.getDemandReport(reportId);
    if (!report) throw new Error("Report not found");

    let version = null;
    if (versionId) {
      const versions = await storage.getReportVersions(reportId);
      version = versions?.find(v => v.id === versionId);
    } else {
      version = await storage.getLatestReportVersion(reportId);
    }

    const businessCaseRecord = await storage.getBusinessCaseByDemandReportId(reportId);

    const normalizeBusinessCase = (versionData: VersionData | null | undefined, dbRecord: BusinessCaseData | null): BusinessCaseData | null => {
      const source: VersionData | BusinessCaseData | null = versionData || dbRecord;
      if (!source) return null;

      logger.info('[DocumentExport] Source keys:', Object.keys(source).slice(0, 20));

      const buildFinancialAnalysis = () => {
        if (source.financialAnalysis && typeof source.financialAnalysis === 'object') {
          return source.financialAnalysis;
        }
        return {
          totalCost: source.totalCostEstimate,
          totalBenefit: source.totalBenefitEstimate,
          roi: source.roiPercentage,
          npv: source.npvValue,
          paybackPeriod: source.paybackMonths ? `${source.paybackMonths} months` : null,
          discountRate: source.discountRate,
          implementationCosts: source.implementationCosts,
          operationalCosts: source.operationalCosts,
          benefitsBreakdown: source.benefitsBreakdown,
          tcoBreakdown: source.tcoBreakdown,
          cashFlows: source.cashFlows,
          revenueStreams: source.revenueStreams,
          keyAssumptions: source.keyAssumptions,
        };
      };

      return {
        id: source.id,
        demandReportId: source.demandReportId || source.reportId,
        executiveSummary: source.executiveSummary || '',
        backgroundAndContext: source.backgroundContext || source.backgroundAndContext || '',
        problemStatement: source.problemStatement || '',
        proposedSolution: source.proposedSolution || source.solutionOverview || '',
        businessRequirements: source.businessRequirements || '',
        smartObjectives: source.smartObjectives || [],
        strategicObjectives: source.smartObjectives || source.strategicObjectives || [],
        scopeDefinition: source.scopeDefinition || {},
        expectedDeliverables: source.expectedDeliverables || [],
        benefits: source.benefitsBreakdown || source.benefits || [],
        risks: source.identifiedRisks || source.risks || [],
        financialAnalysis: buildFinancialAnalysis(),
        archetype: source.archetype || source.industryArchetype || undefined,
        timeline: source.implementationPhases || source.timeline || [],
        implementationPhases: source.implementationPhases || source.timeline || [],
        stakeholders: source.keyStakeholders || source.stakeholders || [],
        successCriteria: source.successMetrics || source.successCriteria || [],
        recommendation: source.recommendation || source.businessRequirements || '',
        strategicAlignment: source.strategicAlignment || null,
        keyAssumptions: source.keyAssumptions || source.financialAnalysis?.keyAssumptions || null,
        riskLevel: source.riskLevel || 'medium',
        riskScore: source.riskScore || 50,
        qualityScore: source.qualityScore,
        description: source.executiveSummary || source.description || '',
      };
    };

    const businessCaseData = normalizeBusinessCase(
      version?.versionData as VersionData | null | undefined,
      (businessCaseRecord ?? null) as BusinessCaseData | null
    );

    // Fetch strategic fit data directly from demand report when exporting strategic_fit
    const reportData = report as unknown as DemandReport;
    const strategicFitData = type === 'strategic_fit' ? reportData.strategicFitAnalysis || null : null;

    // For strategic fit export, also fetch requirements analysis from demand report
    const requirementsData = type === 'strategic_fit' ? reportData.requirementsAnalysis || null : null;

    const exportData: ExportDataBundle = {
      report: reportData,
      businessCase: businessCaseData,
      requirements: requirementsData,
      strategicFit: strategicFitData,
    };

    logger.info('[DocumentExport] Exporting:', {
      reportId,
      hasBusinessCase: !!exportData.businessCase,
      hasExecutiveSummary: !!businessCaseData?.executiveSummary,
      hasStrategicFit: !!exportData.strategicFit,
      strategicFitKeys: exportData.strategicFit ? Object.keys(exportData.strategicFit) : [],
      hasRequirements: !!exportData.requirements,
      type,
      format
    });

    if (format === 'pdf') {
      return this.exportPDF(reportData, exportData, type);
    } else {
      return this.exportPPTX(reportData, exportData, type);
    }
  }

  private async exportPDF(report: DemandReport, exportData: ExportDataBundle, type: string): Promise<Buffer> {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;
    let currentPage = 1;
    const sections: { title: string; page: number }[] = [];

    this.registerDubaiFonts(doc);
    const fontFamily = this.dubaiRegularFont ? 'Dubai' : 'helvetica';

    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [parseInt(result[1]!, 16), parseInt(result[2]!, 16), parseInt(result[3]!, 16)] : [0, 0, 0];
    };

    const addHeader = (showLogo: boolean = true) => {
      const [r, g, b] = hexToRgb(COLORS.primary);
      doc.setFillColor(r, g, b);
      doc.rect(0, 0, pageWidth, 20, 'F');

      if (showLogo && this.logoBase64) {
        try {
          doc.addImage(this.logoBase64, 'PNG', margin, 4, 12, 12);
        } catch (_e) {
          logger.info('[PDF] Could not add logo to header');
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(fontFamily, 'bold');
      doc.text('COREVIA', showLogo && this.logoBase64 ? margin + 16 : margin, 13);

      doc.setFontSize(9);
      doc.setFont(fontFamily, 'normal');
      doc.text(format(new Date(), 'dd MMMM yyyy'), pageWidth - margin, 13, { align: 'right' });

      yPos = 28;
    };

    const addFooter = (pageNum: number, totalPages?: number) => {
      const [r, g, b] = hexToRgb(COLORS.primary);
      doc.setFillColor(r, g, b);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'normal');
      doc.text('CONFIDENTIAL - For Management Use Only', margin, pageHeight - 5);

      const pageText = totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`;
      doc.text(pageText, pageWidth - margin, pageHeight - 5, { align: 'right' });
    };

    const checkPage = (needed: number) => {
      if (yPos + needed > pageHeight - 25) {
        doc.addPage();
        currentPage++;
        addHeader();
      }
    };

    const formatCurrency = (value: CurrencyValue): string => {
      if (value === null || value === undefined || value === '') return 'TBD';
      if (typeof value === 'number') {
        if (value >= 1000000) return `AED ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `AED ${(value / 1000).toFixed(0)}K`;
        return `AED ${value.toLocaleString()}`;
      }
      if (typeof value === 'string') {
        if (/^AED\s/.test(value)) return value;
        const match = value.match(/([0-9.,]+)\s*(K|M|B)?/i);
        if (match) {
          const num = parseFloat(match[1]!.replace(/,/g, ''));
          const mult: Record<string, number> = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
          const multiplier = mult[(match[2] || '').toUpperCase()] ?? 1;
          return formatCurrency(num * multiplier);
        }
        return value || 'TBD';
      }
      return 'TBD';
    };

    const addSectionTitle = (title: string, _icon?: string) => {
      checkPage(25);
      sections.push({ title, page: currentPage });

      yPos += 3;
      const [r, g, b] = hexToRgb(COLORS.accent);
      doc.setFillColor(r, g, b);
      doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont(fontFamily, 'bold');
      doc.text(title.toUpperCase(), margin + 6, yPos + 8);

      yPos += 18;
    };

    // Justified text rendering - distributes words evenly across line width
    const addJustifiedText = (text: string, x: number, width: number, fontSize: number = TYPOGRAPHY.body.size) => {
      const words = text.split(' ').filter(w => w.length > 0);
      if (words.length <= 1) {
        doc.text(text, x, yPos);
        return;
      }

      doc.setFontSize(fontSize);
      const totalTextWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
      const totalSpaceWidth = width - totalTextWidth;
      const spaceWidth = totalSpaceWidth / (words.length - 1);

      // Only justify if it looks reasonable (not too stretched)
      if (spaceWidth > 0 && spaceWidth < 8) {
        let currentX = x;
        words.forEach((word, idx) => {
          doc.text(word, currentX, yPos);
          currentX += doc.getTextWidth(word) + (idx < words.length - 1 ? spaceWidth : 0);
        });
      } else {
        // Fall back to left-aligned if spacing would be too extreme
        doc.text(text, x, yPos);
      }
    };

    const addParagraph = (text: string, indent: number = 0, justify: boolean = true) => {
      if (!text || text.trim() === '') return;

      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(TYPOGRAPHY.body.size);
      doc.setFont(fontFamily, 'normal');

      const maxWidth = contentWidth - indent;
      const lines = doc.splitTextToSize(text, maxWidth);

      lines.forEach((line: string, idx: number) => {
        checkPage(SPACING.lineHeight);
        // Justify all lines except the last one
        if (justify && idx < lines.length - 1 && line.trim().length > 0) {
          addJustifiedText(line.trim(), margin + indent, maxWidth);
        } else {
          doc.text(line, margin + indent, yPos);
        }
        yPos += SPACING.lineHeight;
      });
      yPos += SPACING.sm;
    };

    // Section Divider - elegant visual break between sections
    const addSectionDivider = (style: 'gradient' | 'line' | 'dots' = 'gradient') => {
      checkPage(12);
      yPos += 4;

      if (style === 'gradient') {
        // Gradient-style divider with accent color fade
        const gradientSteps = 20;
        const stepWidth = contentWidth / gradientSteps;
        for (let i = 0; i < gradientSteps; i++) {
          const alpha = Math.sin((i / gradientSteps) * Math.PI);
          const [r, g, b] = hexToRgb(COLORS.accent);
          doc.setFillColor(r, g, b);
          doc.setGState(doc.GState({ opacity: alpha * 0.4 }));
          doc.rect(margin + i * stepWidth, yPos, stepWidth + 0.5, 1.5, 'F');
        }
        doc.setGState(doc.GState({ opacity: 1 }));
      } else if (style === 'line') {
        // Simple elegant line
        doc.setDrawColor(...hexToRgb(COLORS.border));
        doc.setLineWidth(0.5);
        doc.line(margin + 20, yPos + 0.5, margin + contentWidth - 20, yPos + 0.5);
      } else {
        // Decorative dots
        const dotCount = 5;
        const dotSpacing = 8;
        const startX = (pageWidth - (dotCount - 1) * dotSpacing) / 2;
        doc.setFillColor(...hexToRgb(COLORS.accent));
        for (let i = 0; i < dotCount; i++) {
          const size = i === 2 ? 1.5 : 1;
          doc.circle(startX + i * dotSpacing, yPos + 0.5, size, 'F');
        }
      }

      yPos += 8;
    };

    const addBulletList = (items: string[], indent: number = 6) => {
      if (!items || items.length === 0) return;

      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(TYPOGRAPHY.body.size);
      doc.setFont(fontFamily, 'normal');

      items.forEach((item) => {
        if (!item) return;
        checkPage(SPACING.md);

        const [gr, gg, gb] = hexToRgb(COLORS.accent);
        doc.setFillColor(gr, gg, gb);
        doc.circle(margin + indent, yPos - 1.2, 1.5, 'F');

        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFont(fontFamily, 'normal');
        const lines = doc.splitTextToSize(item, contentWidth - indent - 10);
        lines.forEach((line: string) => {
          doc.text(line, margin + indent + 6, yPos);
          yPos += SPACING.lineHeight;
        });
        yPos += SPACING.xs;
      });
      yPos += SPACING.sm;
    };

    const addKeyValuePairs = (pairs: { label: string; value: string }[], columns: number = 2) => {
      const colWidth = contentWidth / columns;
      let col = 0;
      let startY = yPos;

      pairs.forEach((pair, _idx) => {
        if (col === 0) {
          checkPage(12);
          startY = yPos;
        }

        const x = margin + col * colWidth;

        doc.setFontSize(9);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.text(pair.label, x, yPos);

        doc.setFontSize(11);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.text(pair.value || 'N/A', x, yPos + 6);

        col++;
        if (col >= columns) {
          col = 0;
          yPos = startY + 16;
        }
      });

      if (col !== 0) yPos += 16;
      yPos += 5;
    };

    // ============================================================================
    // UI-MATCHING COMPONENTS - Exact replica of Business Case UI
    // ============================================================================

    // Draw a gradient-style icon box (like the UI's gradient icon headers)
    const drawIconBox = (x: number, y: number, size: number, gradientColor: string, icon: string) => {
      doc.setFillColor(...hexToRgb(gradientColor));
      doc.roundedRect(x, y, size, size, 2, 2, 'F');

      // Draw simple icon representation (circle or shape)
      doc.setFillColor(255, 255, 255);
      const cx = x + size / 2;
      const cy = y + size / 2;

      switch(icon) {
        case 'trending':
          // Arrow up
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.8);
          doc.line(cx - 2, cy + 2, cx, cy - 2);
          doc.line(cx, cy - 2, cx + 2, cy + 2);
          doc.line(cx - 1.5, cy - 1, cx + 1.5, cy - 1);
          break;
        case 'dollar':
          doc.setFontSize(size * 0.5);
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text('$', cx, cy + 1.5, { align: 'center' });
          break;
        case 'calendar':
          doc.rect(cx - 2, cy - 1.5, 4, 3.5, 'S');
          doc.line(cx - 1, cy - 1.5, cx - 1, cy - 2.5);
          doc.line(cx + 1, cy - 1.5, cx + 1, cy - 2.5);
          break;
        case 'target':
          doc.circle(cx, cy, 2, 'S');
          doc.circle(cx, cy, 1, 'F');
          break;
        case 'shield':
          // Shield shape
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.6);
          doc.line(cx - 2, cy - 2, cx, cy - 3);
          doc.line(cx, cy - 3, cx + 2, cy - 2);
          doc.line(cx + 2, cy - 2, cx + 2, cy + 1);
          doc.line(cx + 2, cy + 1, cx, cy + 3);
          doc.line(cx, cy + 3, cx - 2, cy + 1);
          doc.line(cx - 2, cy + 1, cx - 2, cy - 2);
          break;
        case 'chart':
          // Bar chart
          doc.setFillColor(255, 255, 255);
          doc.rect(cx - 2.5, cy, 1.2, 2, 'F');
          doc.rect(cx - 0.6, cy - 1, 1.2, 3, 'F');
          doc.rect(cx + 1.3, cy - 2, 1.2, 4, 'F');
          break;
        default:
          doc.circle(cx, cy, size * 0.25, 'F');
      }
    };

    // UI-Matching Metric Card (like FinancialMetricsCard)
    const addMetricCard = (
      x: number,
      cardWidth: number,
      title: string,
      value: string,
      subtitle: string,
      iconColor: string,
      icon: string,
      badge?: { text: string; variant: 'success' | 'warning' | 'danger' }
    ) => {
      const cardHeight = 32;
      const cardPadding = 4;

      // Card background with subtle border
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'FD');

      // Icon box
      const iconSize = 8;
      drawIconBox(x + cardPadding, yPos + cardPadding, iconSize, iconColor, icon);

      // Title (next to icon)
      doc.setTextColor(...hexToRgb(COLORS.textLight));
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'normal');
      doc.text(title, x + cardPadding + iconSize + 3, yPos + cardPadding + 5);

      // Value (large)
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(14);
      doc.setFont(fontFamily, 'bold');
      doc.text(value, x + cardPadding, yPos + cardPadding + 18);

      // Badge if present
      if (badge) {
        const badgeColors = {
          success: COLORS.successLight,
          warning: COLORS.warningLight,
          danger: COLORS.dangerLight
        };
        const badgeTextColors = {
          success: COLORS.success,
          warning: COLORS.warning,
          danger: COLORS.danger
        };
        doc.setFillColor(...hexToRgb(badgeColors[badge.variant]));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        const badgeWidth = doc.getTextWidth(badge.text) + 4;
        doc.roundedRect(x + cardPadding, yPos + cardPadding + 22, badgeWidth, 5, 1, 1, 'F');
        doc.setTextColor(...hexToRgb(badgeTextColors[badge.variant]));
        doc.text(badge.text, x + cardPadding + 2, yPos + cardPadding + 25.5);
      } else if (subtitle) {
        // Subtitle
        doc.setTextColor(...hexToRgb(COLORS.textMuted));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'normal');
        doc.text(subtitle, x + cardPadding, yPos + cardPadding + 25);
      }
    };

    // 4-Column Financial Metrics Grid (exactly like UI)
    const addFinancialMetricsGrid = (bc: BusinessCaseData) => {
      checkPage(40);

      const fa = bc.financialAnalysis || {};
      const colWidth = (contentWidth - 9) / 4; // 3mm gaps between cards
      const gap = 3;

      // ROI Card
      const roiValue = fa.roi || bc.roiPercentage || 0;
      const roiNum = parseFloat(String(roiValue));
      const roiBadge = roiNum >= 50 ? { text: 'Excellent', variant: 'success' as const } :
                       roiNum >= 20 ? { text: 'Good', variant: 'warning' as const } :
                       { text: 'Fair', variant: 'danger' as const };
      addMetricCard(margin, colWidth, 'Return on Investment', `${roiNum.toFixed(2)}%`, '', '#10B981', 'trending', roiBadge);

      // NPV Card
      addMetricCard(margin + colWidth + gap, colWidth, 'Net Present Value', formatCurrency(fa.npv || bc.npvValue), 'Discounted cash flow value', '#3B82F6', 'dollar');

      // Payback Period Card
      const paybackValue = fa.paybackPeriod || bc.paybackMonths;
      let paybackText = 'N/A';
      if (paybackValue) {
        const months = parseFloat(String(paybackValue).replace(/[^\d.]/g, ''));
        if (!isNaN(months)) {
          const years = Math.floor(months / 12);
          const remainingMonths = Math.round(months % 12);
          paybackText = years > 0 ? `${years}y ${remainingMonths}m` : `${remainingMonths} months`;
        } else {
          paybackText = String(paybackValue);
        }
      }
      addMetricCard(margin + (colWidth + gap) * 2, colWidth, 'Payback Period', paybackText, 'Time to recover investment', '#F59E0B', 'calendar');

      // TCO Card
      addMetricCard(margin + (colWidth + gap) * 3, colWidth, 'Total Cost of Ownership', formatCurrency(fa.totalCost || bc.totalCostEstimate), '5-year total cost estimate', '#8B5CF6', 'target');

      yPos += 36;
    };

    // UI-Matching Section Card (like ExecutiveSummaryPanel)
    const _addSectionCard = (title: string, iconColor: string, icon: string, content: () => void) => {
      checkPage(50);

      const startY = yPos;

      // We'll draw the card background after content to get correct height
      const contentStartY = yPos + 16;
      yPos = contentStartY;

      // Render content
      content();

      const _cardHeight = yPos - startY + 4;

      // Draw card background (behind content)
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.3);
      // Note: jsPDF doesn't support z-index, so we'll use a simpler approach

      // Card header with icon
      yPos = startY;

      // Icon box
      const iconSize = 8;
      drawIconBox(margin + 4, yPos + 2, iconSize, iconColor, icon);

      // Title
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text(title, margin + 16, yPos + 8);

      yPos = contentStartY;
      content();
      yPos += 8;
    };

    // Compact section header (no full-width banner)
    const addCompactSectionHeader = (title: string, iconColor: string) => {
      checkPage(20);
      sections.push({ title, page: currentPage });

      // Icon box
      const iconSize = 8;
      doc.setFillColor(...hexToRgb(iconColor));
      doc.roundedRect(margin, yPos, iconSize, iconSize, 1.5, 1.5, 'F');

      // Simple icon (white dot)
      doc.setFillColor(255, 255, 255);
      doc.circle(margin + iconSize / 2, yPos + iconSize / 2, 2, 'F');

      // Title
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(13);
      doc.setFont(fontFamily, 'bold');
      doc.text(title, margin + iconSize + 4, yPos + 6);

      yPos += 14;
    };

    const addTable = (headers: string[], rows: string[][], options?: { alternateColors?: boolean }) => {
      checkPage(35);

      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: rows,
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: hexToRgb(COLORS.primary),
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: 4,
          font: fontFamily,
        },
        bodyStyles: {
          fontSize: 10,
          cellPadding: 4,
          textColor: hexToRgb(COLORS.text),
          font: fontFamily,
        },
        alternateRowStyles: options?.alternateColors ? {
          fillColor: hexToRgb(COLORS.lightGray),
        } : undefined,
        styles: {
          lineColor: hexToRgb(COLORS.gray),
          lineWidth: 0.1,
          font: fontFamily,
        },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    };

    const addHighlightBox = (content: string, color: string = COLORS.lightGray) => {
      checkPage(30);

      const [r, g, b] = hexToRgb(color);
      doc.setFillColor(r, g, b);

      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(TYPOGRAPHY.body.size);
      const lines = doc.splitTextToSize(content, contentWidth - 14);
      const boxHeight = lines.length * SPACING.lineHeight + SPACING.lg;

      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3, 3, 'F');

      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.text(lines, margin + 7, yPos + 9);

      yPos += boxHeight + SPACING.md;
    };

    // ========================================================================
    // ADVANCED INFOGRAPHICS - Investment-Grade Visualizations
    // ========================================================================

    // Draw a semi-circular gauge for ROI/percentage metrics
    const addGauge = (x: number, y: number, radius: number, value: number, label: string, maxValue: number = 100) => {
      const percentage = Math.min(value / maxValue, 1);
      const startAngle = Math.PI;
      const endAngle = Math.PI * 2;
      const valueAngle = startAngle + (endAngle - startAngle) * percentage;

      // Background arc
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(4);
      for (let a = startAngle; a <= endAngle; a += 0.05) {
        const x1 = x + Math.cos(a) * radius;
        const y1 = y + Math.sin(a) * radius;
        const x2 = x + Math.cos(a + 0.05) * radius;
        const y2 = y + Math.sin(a + 0.05) * radius;
        doc.line(x1, y1, x2, y2);
      }

      // Value arc with gradient effect
      const gaugeColor = value >= 50 ? COLORS.success : value >= 25 ? COLORS.warning : COLORS.danger;
      doc.setDrawColor(...hexToRgb(gaugeColor));
      doc.setLineWidth(4);
      for (let a = startAngle; a <= valueAngle; a += 0.05) {
        const x1 = x + Math.cos(a) * radius;
        const y1 = y + Math.sin(a) * radius;
        const x2 = x + Math.cos(a + 0.05) * radius;
        const y2 = y + Math.sin(a + 0.05) * radius;
        doc.line(x1, y1, x2, y2);
      }

      // Center value
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(TYPOGRAPHY.metric.size);
      doc.setFont(fontFamily, 'bold');
      doc.text(`${Math.round(value)}%`, x, y - 2, { align: 'center' });

      // Label
      doc.setFontSize(TYPOGRAPHY.label.size);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...hexToRgb(COLORS.textLight));
      doc.text(label, x, y + 8, { align: 'center' });
    };

    // Draw a donut chart for cost/benefit breakdown
    const addDonutChart = (x: number, y: number, radius: number, data: { label: string; value: number; color: string }[], title: string) => {
      const total = data.reduce((sum, d) => sum + d.value, 0);
      const innerRadius = radius * 0.6;
      let currentAngle = -Math.PI / 2;

      // Draw segments
      data.forEach((segment) => {
        const segmentAngle = (segment.value / total) * Math.PI * 2;
        const [sr, sg, sb] = hexToRgb(segment.color);
        doc.setFillColor(sr, sg, sb);

        // Draw arc using small triangles
        for (let a = currentAngle; a < currentAngle + segmentAngle; a += 0.05) {
          const x1 = x + Math.cos(a) * innerRadius;
          const y1 = y + Math.sin(a) * innerRadius;
          const x2 = x + Math.cos(a) * radius;
          const y2 = y + Math.sin(a) * radius;
          const x3 = x + Math.cos(a + 0.05) * radius;
          const y3 = y + Math.sin(a + 0.05) * radius;
          const x4 = x + Math.cos(a + 0.05) * innerRadius;
          const y4 = y + Math.sin(a + 0.05) * innerRadius;

          doc.setFillColor(sr, sg, sb);
          doc.triangle(x1, y1, x2, y2, x3, y3, 'F');
          doc.triangle(x1, y1, x3, y3, x4, y4, 'F');
        }
        currentAngle += segmentAngle;
      });

      // Center circle (white)
      doc.setFillColor(255, 255, 255);
      doc.circle(x, y, innerRadius - 1, 'F');

      // Title in center
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(TYPOGRAPHY.bodySmall.size);
      doc.setFont(fontFamily, 'bold');
      doc.text(title, x, y, { align: 'center' });

      // Legend
      let legendY = y + radius + 8;
      data.forEach((item) => {
        const [cr, cg, cb] = hexToRgb(item.color);
        doc.setFillColor(cr, cg, cb);
        doc.circle(x - 25, legendY, 2, 'F');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(`${item.label}: ${formatCurrency(item.value)}`, x - 20, legendY + 1);
        legendY += 6;
      });
    };

    // Draw horizontal bar chart
    const _addBarChart = (x: number, y: number, width: number, data: { label: string; value: number; color?: string }[], title: string) => {
      const maxValue = Math.max(...data.map(d => d.value));
      const barHeight = 10;
      const barGap = 5;
      const labelWidth = 50;

      // Title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text(title, x, y);
      y += 8;

      data.forEach((item, _idx) => {
        // Label
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.bodySmall.size);
        doc.setFont(fontFamily, 'normal');
        const labelLines = doc.splitTextToSize(item.label, labelWidth);
        doc.text(labelLines[0], x, y + barHeight / 2 + 1);

        // Bar background
        doc.setFillColor(...hexToRgb(COLORS.lightGray));
        doc.roundedRect(x + labelWidth + 5, y, width - labelWidth - 30, barHeight, 2, 2, 'F');

        // Bar value
        const barWidth = (item.value / maxValue) * (width - labelWidth - 30);
        const barColor = item.color || COLORS.accent;
        doc.setFillColor(...hexToRgb(barColor));
        doc.roundedRect(x + labelWidth + 5, y, barWidth, barHeight, 2, 2, 'F');

        // Value label
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFont(fontFamily, 'bold');
        doc.text(formatCurrency(item.value), x + width - 20, y + barHeight / 2 + 1, { align: 'right' });

        y += barHeight + barGap;
      });

      return y;
    };

    // UI-Matching Risk Heat Map (like RiskHeatMap.tsx)
    const addRiskHeatMap = (assumptions: { assumption: string; impact?: string; likelihood?: string; riskScore?: number }[]) => {
      checkPage(100);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 90, 3, 3, 'FD');

      // Card header with gradient icon
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.danger, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Risk Heat Map', margin + 18, yPos + 12);

      doc.setTextColor(...hexToRgb(COLORS.textMuted));
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'normal');
      doc.text('Assumption risk assessment matrix (Impact × Likelihood)', margin + 18, yPos + 19);

      yPos += 28;

      // Legend row
      const legendColors = [
        { label: 'Critical (6-9)', color: COLORS.dangerLight, border: COLORS.danger },
        { label: 'High (4-6)', color: COLORS.warningLight, border: COLORS.warning },
        { label: 'Medium (2-4)', color: '#FEF9C3', border: '#FACC15' }, // Yellow
        { label: 'Low (1-2)', color: COLORS.successLight, border: COLORS.success },
      ];

      let legendX = margin + 10;
      legendColors.forEach((leg) => {
        doc.setFillColor(...hexToRgb(leg.color));
        doc.setDrawColor(...hexToRgb(leg.border));
        doc.setLineWidth(0.3);
        doc.roundedRect(legendX, yPos, 4, 4, 0.5, 0.5, 'FD');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'normal');
        doc.text(leg.label, legendX + 6, yPos + 3);
        legendX += 35;
      });

      yPos += 10;

      // 3x3 Grid
      const cellSize = 16;
      const gridX = margin + 20;
      const gridY = yPos;
      const impactLevels = ['High', 'Medium', 'Low'];
      const likelihoodLevels = ['Low', 'Medium', 'High'];

      // Get risk color based on position
      const getCellColor = (impact: string, likelihood: string) => {
        const impactScore = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
        const likelihoodScore = likelihood === 'High' ? 3 : likelihood === 'Medium' ? 2 : 1;
        const score = impactScore * likelihoodScore;
        if (score >= 6) return { bg: COLORS.dangerLight, border: COLORS.danger };
        if (score >= 4) return { bg: COLORS.warningLight, border: COLORS.warning };
        if (score >= 2) return { bg: '#FEF9C3', border: '#FACC15' };
        return { bg: COLORS.successLight, border: COLORS.success };
      };

      // Count assumptions in each cell
      const getAssumptionsInCell = (impact: string, likelihood: string) => {
        return assumptions.filter(a => {
          const aImpact = (a.impact || '').toLowerCase();
          const aLikelihood = (a.likelihood || a.impact || '').toLowerCase();
          return aImpact.includes(impact.toLowerCase()) && aLikelihood.includes(likelihood.toLowerCase());
        });
      };

      // Y-axis label
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(COLORS.textMuted));
      doc.text('Impact', gridX - 8, gridY + cellSize * 1.5, { angle: 90 });

      // Column headers
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(7);
      likelihoodLevels.forEach((level, col) => {
        doc.text(level, gridX + col * cellSize + cellSize / 2, gridY - 2, { align: 'center' });
      });

      // Draw grid cells
      impactLevels.forEach((impact, row) => {
        // Row label
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'normal');
        doc.text(impact, gridX - 3, gridY + row * cellSize + cellSize / 2 + 1, { align: 'right' });

        likelihoodLevels.forEach((likelihood, col) => {
          const cellX = gridX + col * cellSize;
          const cellY = gridY + row * cellSize;
          const colors = getCellColor(impact, likelihood);
          const cellAssumptions = getAssumptionsInCell(impact, likelihood);

          // Cell background
          doc.setFillColor(...hexToRgb(colors.bg));
          doc.setDrawColor(...hexToRgb(colors.border));
          doc.setLineWidth(0.3);
          doc.roundedRect(cellX, cellY, cellSize, cellSize, 1, 1, 'FD');

          // Count in cell
          if (cellAssumptions.length > 0) {
            doc.setTextColor(...hexToRgb(COLORS.text));
            doc.setFontSize(8);
            doc.setFont(fontFamily, 'bold');
            doc.text(`(${cellAssumptions.length})`, cellX + cellSize / 2, cellY + cellSize / 2 + 1, { align: 'center' });
          }
        });
      });

      // X-axis label
      doc.setFontSize(7);
      doc.setTextColor(...hexToRgb(COLORS.textMuted));
      doc.text('Likelihood →', gridX + cellSize * 1.5, gridY + cellSize * 3 + 6, { align: 'center' });

      // Critical assumptions list (right side)
      const criticalX = gridX + cellSize * 3 + 15;
      const criticalAssumptions = assumptions.filter(a => (a.riskScore || 0) >= 6);

      if (criticalAssumptions.length > 0) {
        doc.setTextColor(...hexToRgb(COLORS.danger));
        doc.setFontSize(8);
        doc.setFont(fontFamily, 'bold');
        doc.text('Critical Risks:', criticalX, gridY);

        let listY = gridY + 6;
        criticalAssumptions.slice(0, 4).forEach((a, _idx) => {
          doc.setTextColor(...hexToRgb(COLORS.text));
          doc.setFontSize(7);
          doc.setFont(fontFamily, 'normal');
          const text = a.assumption.length > 35 ? a.assumption.substring(0, 32) + '...' : a.assumption;
          doc.text(`• ${text}`, criticalX, listY);
          listY += 5;
        });
      }

      yPos = cardStartY + 95;
    };

    // Legacy risk matrix for backwards compatibility
    const _addRiskMatrix = (x: number, y: number, risks: { name: string; impact: number; probability: number }[]) => {
      // Convert to assumptions format and use new heat map
      const assumptions = risks.map(r => ({
        assumption: r.name,
        impact: r.impact > 66 ? 'High' : r.impact > 33 ? 'Medium' : 'Low',
        likelihood: r.probability > 66 ? 'High' : r.probability > 33 ? 'Medium' : 'Low',
        riskScore: Math.ceil(((r.impact > 66 ? 3 : r.impact > 33 ? 2 : 1) * (r.probability > 66 ? 3 : r.probability > 33 ? 2 : 1))),
      }));
      addRiskHeatMap(assumptions);
    };

    // UI-Matching Implementation Roadmap (like ImplementationRoadmap.tsx)
    const addImplementationRoadmap = (quickWins: RoadmapItem[], strategicInitiatives: RoadmapItem[]) => {
      checkPage(85);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 80, 3, 3, 'FD');

      // Card header with gradient icon
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.accent, 'calendar');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Implementation Roadmap', margin + 18, yPos + 12);

      yPos += 22;

      // Quick Wins Section
      doc.setFillColor(...hexToRgb(COLORS.success));
      doc.circle(margin + 8, yPos, 2, 'F');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'bold');
      doc.text('Quick Wins (0-3 Months)', margin + 14, yPos + 1);

      // Quick Wins badge
      doc.setFillColor(...hexToRgb(COLORS.successLight));
      doc.setDrawColor(...hexToRgb(COLORS.success));
      doc.roundedRect(margin + 68, yPos - 3, 10, 5, 1, 1, 'FD');
      doc.setFontSize(6);
      doc.text(String(quickWins.length), margin + 73, yPos, { align: 'center' });

      yPos += 6;

      // Quick Win cards (grid)
      const cardW = (contentWidth - 20) / 4;
      quickWins.slice(0, 4).forEach((item, idx) => {
        const cardX = margin + 6 + idx * (cardW + 2);

        doc.setFillColor(...hexToRgb('#DCFCE7')); // green-50
        doc.setDrawColor(...hexToRgb(COLORS.success));
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, yPos, cardW, 14, 1, 1, 'FD');

        // Action text
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        const actionText = (item.action || item.name || 'Action').substring(0, 25);
        doc.text(actionText, cardX + 2, yPos + 5);

        // Timeline
        doc.setTextColor(...hexToRgb(COLORS.textMuted));
        doc.setFontSize(5);
        doc.setFont(fontFamily, 'normal');
        doc.text(item.timeline || '1-4 weeks', cardX + 2, yPos + 10);
      });

      yPos += 20;

      // Strategic Initiatives Section
      doc.setFillColor(...hexToRgb(COLORS.accent));
      doc.circle(margin + 8, yPos, 2, 'F');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'bold');
      doc.text('Strategic Initiatives (3-12 Months)', margin + 14, yPos + 1);

      // Strategic badge
      doc.setFillColor(...hexToRgb('#DBEAFE')); // blue-50
      doc.setDrawColor(...hexToRgb(COLORS.accent));
      doc.roundedRect(margin + 85, yPos - 3, 10, 5, 1, 1, 'FD');
      doc.setFontSize(6);
      doc.text(String(strategicInitiatives.length), margin + 90, yPos, { align: 'center' });

      yPos += 6;

      // Strategic Initiative cards (grid)
      strategicInitiatives.slice(0, 4).forEach((item, idx) => {
        const cardX = margin + 6 + idx * (cardW + 2);

        doc.setFillColor(...hexToRgb('#DBEAFE')); // blue-50
        doc.setDrawColor(...hexToRgb(COLORS.accent));
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, yPos, cardW, 14, 1, 1, 'FD');

        // Action text
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        const actionText = (item.action || item.name || 'Initiative').substring(0, 25);
        doc.text(actionText, cardX + 2, yPos + 5);

        // Timeline
        doc.setTextColor(...hexToRgb(COLORS.textMuted));
        doc.setFontSize(5);
        doc.setFont(fontFamily, 'normal');
        doc.text(item.timeline || '3-6 months', cardX + 2, yPos + 10);
      });

      yPos += 18;

      // Timeline bar (Q1-Q4)
      const barY = yPos;
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      const barWidth = (contentWidth - 16) / 4;

      quarters.forEach((q, idx) => {
        const barX = margin + 8 + idx * barWidth;
        const bgColor = idx === 0 ? '#BBF7D0' : '#BFDBFE'; // green-200 or blue-200

        doc.setFillColor(...hexToRgb(bgColor));
        if (idx === 0) {
          doc.roundedRect(barX, barY, barWidth, 6, 1, 0, 'F');
        } else if (idx === 3) {
          doc.roundedRect(barX, barY, barWidth, 6, 0, 1, 'F');
        } else {
          doc.rect(barX, barY, barWidth, 6, 'F');
        }

        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        doc.text(q, barX + barWidth / 2, barY + 4, { align: 'center' });
      });

      yPos = cardStartY + 85;
    };

    // UI-Matching Power/Interest Matrix (like PowerInterestMatrix.tsx)
    const addPowerInterestMatrix = (data: PowerInterestMatrixData) => {
      checkPage(85);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 80, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.purple, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Power/Interest Matrix', margin + 18, yPos + 12);

      doc.setTextColor(...hexToRgb(COLORS.textMuted));
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'normal');
      doc.text('Stakeholder positioning for optimal engagement strategy', margin + 18, yPos + 19);

      yPos += 26;

      // 2x2 Grid
      const quadrants = [
        { key: 'manageClosely', title: 'Manage Closely', desc: 'High Power / High Interest', bg: COLORS.dangerLight, border: COLORS.danger },
        { key: 'keepSatisfied', title: 'Keep Satisfied', desc: 'High Power / Low Interest', bg: COLORS.warningLight, border: COLORS.warning },
        { key: 'keepInformed', title: 'Keep Informed', desc: 'Low Power / High Interest', bg: '#DBEAFE', border: COLORS.accent },
        { key: 'monitor', title: 'Monitor', desc: 'Low Power / Low Interest', bg: COLORS.lightGray, border: COLORS.gray },
      ];

      const cellW = (contentWidth - 16) / 2;
      const cellH = 24;

      quadrants.forEach((q, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const cellX = margin + 8 + col * (cellW + 2);
        const cellY = yPos + row * (cellH + 2);

        doc.setFillColor(...hexToRgb(q.bg));
        doc.setDrawColor(...hexToRgb(q.border));
        doc.setLineWidth(0.3);
        doc.roundedRect(cellX, cellY, cellW, cellH, 2, 2, 'FD');

        // Title
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(8);
        doc.setFont(fontFamily, 'bold');
        doc.text(q.title, cellX + 3, cellY + 6);

        // Description
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.textMuted));
        doc.text(q.desc, cellX + 3, cellY + 11);

        // Stakeholders
        const stakeholders = (data[q.key as keyof typeof data] || []).slice(0, 3);
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        stakeholders.forEach((s, i) => {
          const name = typeof s === 'string' ? s : (s as { name?: string }).name || 'Stakeholder';
          doc.text(`• ${name.substring(0, 20)}`, cellX + 3, cellY + 16 + i * 4);
        });
      });

      yPos = cardStartY + 85;
    };

    // UI-Matching KPI Cards
    const _addKPICards = (kpis: { name: string; target?: string; baseline?: string; measurementFrequency?: string }[]) => {
      if (!kpis || kpis.length === 0) return;

      checkPage(50);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.teal, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('KPIs & Success Metrics', margin + 18, yPos + 12);

      yPos += 20;

      // KPI cards grid
      const kpiWidth = (contentWidth - 16) / 3;
      kpis.slice(0, 6).forEach((kpi, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const kpiX = margin + 6 + col * (kpiWidth + 2);
        const kpiY = yPos + row * 12;

        doc.setFillColor(...hexToRgb(COLORS.tealLight));
        doc.setDrawColor(...hexToRgb(COLORS.teal));
        doc.setLineWidth(0.2);
        doc.roundedRect(kpiX, kpiY, kpiWidth, 10, 1, 1, 'FD');

        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'bold');
        doc.text((kpi.name || 'KPI').substring(0, 18), kpiX + 2, kpiY + 4);

        doc.setFontSize(5);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.textMuted));
        const targetText = kpi.target ? `Target: ${kpi.target}` : '';
        doc.text(targetText.substring(0, 25), kpiX + 2, kpiY + 8);
      });

      yPos = cardStartY + 50;
    };

    // Strategic Alignment Chart (UI-Matching)
    const _addStrategicAlignmentCard = (alignment: { uaeVision2071?: number; digitalGovernment?: number; organizationStrategy?: number; sustainability?: number }) => {
      checkPage(55);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.gold, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Strategic Alignment', margin + 18, yPos + 12);

      yPos += 22;

      // Alignment bars
      const metrics = [
        { label: 'UAE Vision 2071', value: alignment.uaeVision2071 || 0, color: COLORS.gold },
        { label: 'Digital Government', value: alignment.digitalGovernment || 0, color: COLORS.accent },
        { label: 'Organization Strategy', value: alignment.organizationStrategy || 0, color: COLORS.teal },
        { label: 'Sustainability', value: alignment.sustainability || 0, color: COLORS.success },
      ];

      const barWidth = (contentWidth - 40) / 2;
      metrics.forEach((m, idx) => {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        const barX = margin + 8 + col * (barWidth + 20);
        const barY = yPos + row * 12;

        // Label
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'normal');
        doc.text(m.label, barX, barY);

        // Background bar
        doc.setFillColor(...hexToRgb(COLORS.lightGray));
        doc.roundedRect(barX, barY + 2, barWidth - 20, 4, 1, 1, 'F');

        // Value bar
        const valueWidth = ((barWidth - 20) * m.value) / 100;
        doc.setFillColor(...hexToRgb(m.color));
        doc.roundedRect(barX, barY + 2, valueWidth, 4, 1, 1, 'F');

        // Percentage
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        doc.text(`${m.value}%`, barX + barWidth - 15, barY + 5);
      });

      yPos = cardStartY + 55;
    };

    // Compliance & Governance Card
    const _addComplianceCard = (requirements: string[]) => {
      if (!requirements || requirements.length === 0) return;

      checkPage(45);

      // Card container
      const cardStartY = yPos;
      const cardHeight = Math.min(40, 20 + requirements.length * 5);
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, cardHeight, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.purple, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Compliance & Governance', margin + 18, yPos + 12);

      yPos += 18;

      // Requirements list
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(7);
      doc.setFont(fontFamily, 'normal');
      requirements.slice(0, 4).forEach((req, _idx) => {
        doc.setFillColor(...hexToRgb(COLORS.purple));
        doc.circle(margin + 10, yPos + 1, 1, 'F');
        doc.text(req.substring(0, 70), margin + 14, yPos + 2);
        yPos += 5;
      });

      yPos = cardStartY + cardHeight + 5;
    };

    // Critical Milestones Card
    const addMilestonesCard = (milestones: { name: string; date?: string; status?: string }[]) => {
      if (!milestones || milestones.length === 0) return;

      checkPage(50);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 45, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.warning, 'calendar');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Critical Milestones', margin + 18, yPos + 12);

      yPos += 20;

      // Milestones timeline
      const msWidth = (contentWidth - 16) / Math.min(milestones.length, 5);
      milestones.slice(0, 5).forEach((ms, idx) => {
        const msX = margin + 8 + idx * msWidth;

        // Circle
        const statusColor = ms.status === 'completed' ? COLORS.success :
                           ms.status === 'in_progress' ? COLORS.warning : COLORS.accent;
        doc.setFillColor(...hexToRgb(statusColor));
        doc.circle(msX + msWidth / 2, yPos, 4, 'F');

        // Connecting line
        if (idx < milestones.length - 1 && idx < 4) {
          doc.setDrawColor(...hexToRgb(COLORS.lightGray));
          doc.setLineWidth(1);
          doc.line(msX + msWidth / 2 + 5, yPos, msX + msWidth - 5 + msWidth / 2, yPos);
        }

        // Name
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'bold');
        const nameText = (ms.name || 'Milestone').substring(0, 15);
        doc.text(nameText, msX + msWidth / 2, yPos + 8, { align: 'center' });

        // Date
        if (ms.date) {
          doc.setFontSize(5);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...hexToRgb(COLORS.textMuted));
          doc.text(ms.date.substring(0, 12), msX + msWidth / 2, yPos + 13, { align: 'center' });
        }
      });

      yPos = cardStartY + 50;
    };

    // Assumptions & Dependencies Card
    const addAssumptionsDependenciesCard = (assumptions: Array<string | AssumptionRiskItem>, dependencies: Array<string | DependencyItem>) => {
      checkPage(60);

      // Card container
      const cardStartY = yPos;
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, contentWidth, 55, 3, 3, 'FD');

      // Card header
      drawIconBox(margin + 6, yPos + 6, 8, COLORS.accent, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(12);
      doc.setFont(fontFamily, 'bold');
      doc.text('Assumptions & Dependencies', margin + 18, yPos + 12);

      yPos += 20;

      const colWidth = (contentWidth - 20) / 2;

      // Assumptions column
      doc.setTextColor(...hexToRgb(COLORS.warning));
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'bold');
      doc.text('Key Assumptions', margin + 8, yPos);

      let assY = yPos + 6;
      (assumptions || []).slice(0, 4).forEach((a) => {
        const text = typeof a === 'string' ? a : (a.assumption || a.description || 'Assumption');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'normal');
        doc.text(`• ${text.substring(0, 35)}`, margin + 8, assY);
        assY += 5;
      });

      // Dependencies column
      doc.setTextColor(...hexToRgb(COLORS.accent));
      doc.setFontSize(8);
      doc.setFont(fontFamily, 'bold');
      doc.text('Dependencies', margin + 8 + colWidth + 5, yPos);

      let depY = yPos + 6;
      (dependencies || []).slice(0, 4).forEach((d) => {
        const text = typeof d === 'string' ? d : (d.name || d.description || 'Dependency');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(6);
        doc.setFont(fontFamily, 'normal');
        doc.text(`• ${text.substring(0, 35)}`, margin + 8 + colWidth + 5, depY);
        depY += 5;
      });

      yPos = cardStartY + 60;
    };

    // Draw timeline/roadmap (legacy)
    const addTimeline = (x: number, y: number, width: number, phases: { name: string; duration: string; status?: string }[]) => {
      const phaseWidth = width / phases.length;
      const lineY = y + 15;

      // Title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Implementation Timeline', x, y);
      y += 12;

      // Draw timeline line
      doc.setDrawColor(...hexToRgb(COLORS.accent));
      doc.setLineWidth(2);
      doc.line(x, lineY, x + width, lineY);

      // Draw phases
      phases.forEach((phase, idx) => {
        const phaseX = x + idx * phaseWidth + phaseWidth / 2;

        // Circle node
        const nodeColor = phase.status === 'completed' ? COLORS.success :
                         phase.status === 'in_progress' ? COLORS.warning : COLORS.accent;
        doc.setFillColor(...hexToRgb(nodeColor));
        doc.circle(phaseX, lineY, 5, 'F');
        doc.setFillColor(255, 255, 255);
        doc.circle(phaseX, lineY, 2, 'F');

        // Phase name
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.bodySmall.size);
        doc.setFont(fontFamily, 'bold');
        const nameLines = doc.splitTextToSize(phase.name, phaseWidth - 5);
        doc.text(nameLines[0], phaseX, lineY + 12, { align: 'center' });

        // Duration
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.text(phase.duration, phaseX, lineY + 18, { align: 'center' });
      });
    };

    // Hero metric strip for executive dashboard
    const addMetricStrip = (metrics: { label: string; value: string; subtext?: string; color?: string; trend?: 'up' | 'down' | 'neutral' }[]) => {
      checkPage(45);
      const stripHeight = 35;
      const metricWidth = contentWidth / metrics.length;

      // Background
      doc.setFillColor(...hexToRgb(COLORS.offWhite));
      doc.roundedRect(margin, yPos, contentWidth, stripHeight, 4, 4, 'F');

      metrics.forEach((metric, idx) => {
        const metricX = margin + idx * metricWidth + metricWidth / 2;
        const color = metric.color || COLORS.accent;

        // Value
        doc.setTextColor(...hexToRgb(color));
        doc.setFontSize(TYPOGRAPHY.metricSmall.size);
        doc.setFont(fontFamily, 'bold');
        doc.text(metric.value, metricX, yPos + 14, { align: 'center' });

        // Label
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(metric.label, metricX, yPos + 22, { align: 'center' });

        // Subtext/trend
        if (metric.subtext) {
          const trendColor = metric.trend === 'up' ? COLORS.success :
                            metric.trend === 'down' ? COLORS.danger : COLORS.textLight;
          doc.setTextColor(...hexToRgb(trendColor));
          doc.text(metric.subtext, metricX, yPos + 29, { align: 'center' });
        }

        // Separator
        if (idx < metrics.length - 1) {
          doc.setDrawColor(...hexToRgb(COLORS.gray));
          doc.setLineWidth(0.2);
          doc.line(margin + (idx + 1) * metricWidth, yPos + 8, margin + (idx + 1) * metricWidth, yPos + stripHeight - 8);
        }
      });

      yPos += stripHeight + SPACING.md;
    };

    // Pull quote / key insight callout
    const addPullQuote = (quote: string, attribution?: string) => {
      checkPage(40);
      const quoteBoxWidth = contentWidth - 30;

      // Left accent bar
      doc.setFillColor(...hexToRgb(COLORS.gold));
      doc.rect(margin, yPos, 4, 30, 'F');

      // Quote text
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.bodyLarge.size);
      doc.setFont(fontFamily, 'bold');
      const quoteLines = doc.splitTextToSize(quote, quoteBoxWidth);
      doc.text(quoteLines, margin + 12, yPos + 8);

      // Attribution
      if (attribution) {
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(`— ${attribution}`, margin + 12, yPos + 8 + quoteLines.length * 5 + 4);
      }

      yPos += Math.max(30, quoteLines.length * 5 + 20);
    };

    // Strategic alignment radar (simplified version)
    const _addStrategicAlignment = (alignment: { uaeVision2071?: number; digitalGovernment?: number; organizationStrategy?: number; sustainability?: number }) => {
      checkPage(60);
      const centerX = margin + contentWidth / 2;
      const centerY = yPos + 30;
      const maxRadius = 25;

      // Title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Strategic Alignment Score', centerX, yPos, { align: 'center' });

      const dimensions = [
        { label: 'UAE Vision 2071', value: alignment.uaeVision2071 || 0, angle: -Math.PI / 2 },
        { label: 'Digital Government', value: alignment.digitalGovernment || 0, angle: 0 },
        { label: 'Organization Strategy', value: alignment.organizationStrategy || 0, angle: Math.PI / 2 },
        { label: 'Sustainability', value: alignment.sustainability || 0, angle: Math.PI },
      ];

      // Draw radar background circles
      [0.25, 0.5, 0.75, 1].forEach((scale) => {
        doc.setDrawColor(...hexToRgb(COLORS.lightGray));
        doc.setLineWidth(0.3);
        doc.circle(centerX, centerY, maxRadius * scale, 'S');
      });

      // Draw axes
      dimensions.forEach((dim) => {
        const endX = centerX + Math.cos(dim.angle) * maxRadius;
        const endY = centerY + Math.sin(dim.angle) * maxRadius;
        doc.setDrawColor(...hexToRgb(COLORS.gray));
        doc.setLineWidth(0.3);
        doc.line(centerX, centerY, endX, endY);

        // Labels
        const labelX = centerX + Math.cos(dim.angle) * (maxRadius + 12);
        const labelY = centerY + Math.sin(dim.angle) * (maxRadius + 8);
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(dim.label, labelX, labelY, { align: 'center' });
      });

      // Calculate value points
      const points = dimensions.map((dim) => ({
        x: centerX + Math.cos(dim.angle) * (dim.value / 100) * maxRadius,
        y: centerY + Math.sin(dim.angle) * (dim.value / 100) * maxRadius,
      }));

      // Draw points
      points.forEach((point, idx) => {
        doc.setFillColor(...hexToRgb(COLORS.accent));
        doc.circle(point.x, point.y, 2, 'F');

        // Value labels
        doc.setTextColor(...hexToRgb(COLORS.accent));
        doc.setFontSize(TYPOGRAPHY.label.size);
        doc.setFont(fontFamily, 'bold');
        const labelOffset = 5;
        const labelX = point.x + Math.cos(dimensions[idx]!.angle) * labelOffset;
        const labelY = point.y + Math.sin(dimensions[idx]!.angle) * labelOffset;
        doc.text(`${dimensions[idx]!.value}%`, labelX, labelY, { align: 'center' });
      });

      yPos += 70;
    };

    // Executive Dashboard Page
    const _addExecutiveDashboard = (bc: BusinessCaseData, report: DemandReport) => {
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Executive Dashboard', page: currentPage });

      // Page title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.pageTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Executive Dashboard', pageWidth / 2, yPos + 10, { align: 'center' });

      // Subtitle
      doc.setFontSize(TYPOGRAPHY.body.size);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...hexToRgb(COLORS.textLight));
      doc.text('Investment Overview & Key Metrics', pageWidth / 2, yPos + 18, { align: 'center' });

      yPos += 28;

      // Hero metrics strip
      const fa = bc.financialAnalysis || {};
      addMetricStrip([
        { label: 'Total Investment', value: formatCurrency(fa.totalCost || bc.totalCostEstimate), color: COLORS.primary },
        { label: 'Expected ROI', value: `${fa.roi || bc.roiPercentage || 0}%`, color: COLORS.success, trend: 'up' as const, subtext: 'Above benchmark' },
        { label: 'Payback Period', value: fa.paybackPeriod || `${bc.paybackMonths || 0}mo`, color: COLORS.teal },
        { label: 'NPV', value: formatCurrency(fa.npv || bc.npvValue), color: COLORS.gold },
      ]);

      yPos += 5;

      // Two column layout
      const colWidth = (contentWidth - 10) / 2;
      const leftCol = margin;
      const rightCol = margin + colWidth + 10;

      // Left: ROI Gauge
      addGauge(leftCol + colWidth / 2, yPos + 25, 20, parseFloat(String(fa.roi || bc.roiPercentage || '0')), 'Return on Investment');

      // Right: Quick stats
      const statsY = yPos;
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Investment Highlights', rightCol, statsY);

      const highlights = [
        { label: 'Risk Level', value: bc.riskLevel || 'Medium', color: bc.riskLevel === 'low' ? COLORS.success : bc.riskLevel === 'high' ? COLORS.danger : COLORS.warning },
        { label: 'Quality Score', value: `${bc.qualityScore || 85}/100`, color: COLORS.accent },
        { label: 'Priority', value: report.priority || 'High', color: COLORS.gold },
      ];

      let hlY = statsY + 10;
      highlights.forEach((hl) => {
        doc.setFillColor(...hexToRgb(hl.color));
        doc.roundedRect(rightCol, hlY, colWidth, 12, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(TYPOGRAPHY.bodySmall.size);
        doc.setFont(fontFamily, 'bold');
        doc.text(hl.label, rightCol + 5, hlY + 8);
        doc.text(hl.value, rightCol + colWidth - 5, hlY + 8, { align: 'right' });
        hlY += 16;
      });

      yPos += 55;

      // Cost breakdown chart (if data available)
      if (fa.tcoBreakdown || fa.implementationCosts) {
        const costs = fa.tcoBreakdown || fa.implementationCosts;
        const chartData: { label: string; value: number; color: string }[] = [];

        if (costs && typeof costs === 'object') {
          const costColors = [COLORS.primary, COLORS.accent, COLORS.teal, COLORS.purple];
          let colorIdx = 0;
          Object.entries(costs).slice(0, 4).forEach(([key, value]) => {
            if (typeof value === 'number') {
              chartData.push({
                label: key.replace(/([A-Z])/g, ' $1').trim(),
                value,
                color: costColors[colorIdx++ % costColors.length]!
              });
            }
          });
        }

        if (chartData.length > 0) {
          checkPage(60);
          addDonutChart(margin + 35, yPos + 35, 25, chartData, 'Cost Breakdown');
          yPos += 80;
        }
      }

      // Key insight quote
      if (bc.executiveSummary) {
        const summaryPreview = bc.executiveSummary.substring(0, 200) + (bc.executiveSummary.length > 200 ? '...' : '');
        addPullQuote(summaryPreview, 'Executive Summary');
      }
    };

    // Investment Summary Page - Investor-Ready Content
    const _addInvestmentSummary = (bc: BusinessCaseData, _report: DemandReport) => {
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Investment Summary', page: currentPage });

      // Page title with gradient accent
      checkPage(40);
      doc.setFillColor(...hexToRgb(COLORS.gold));
      doc.rect(margin, yPos, contentWidth, 3, 'F');
      yPos += 8;

      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.pageTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Investment Summary', margin, yPos + 8);

      doc.setFontSize(TYPOGRAPHY.body.size);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...hexToRgb(COLORS.textLight));
      doc.text('Series A Funding Request - AED 18M', margin, yPos + 18);

      yPos += 30;

      // Investment Highlights Box
      checkPage(60);
      const _fa = bc.financialAnalysis || {};
      const highlightBoxHeight = 50;
      doc.setFillColor(...hexToRgb(COLORS.offWhite));
      doc.roundedRect(margin, yPos, contentWidth, highlightBoxHeight, 4, 4, 'F');

      // 4-column key metrics inside box
      const metricBoxWidth = contentWidth / 4;
      const investmentMetrics = [
        { label: 'Funding Ask', value: 'AED 18M', icon: 'Target' },
        { label: 'Pre-Money', value: 'AED 72M', icon: 'TrendUp' },
        { label: 'Use Period', value: '18 Months', icon: 'Clock' },
        { label: 'Expected Exit', value: '5-7 Years', icon: 'Flag' },
      ];

      investmentMetrics.forEach((metric, idx) => {
        const metricX = margin + idx * metricBoxWidth + metricBoxWidth / 2;

        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.setFontSize(TYPOGRAPHY.metricSmall.size);
        doc.setFont(fontFamily, 'bold');
        doc.text(metric.value, metricX, yPos + 18, { align: 'center' });

        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.setFontSize(TYPOGRAPHY.caption.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(metric.label, metricX, yPos + 28, { align: 'center' });

        // Separator
        if (idx < investmentMetrics.length - 1) {
          doc.setDrawColor(...hexToRgb(COLORS.gray));
          doc.setLineWidth(0.2);
          doc.line(margin + (idx + 1) * metricBoxWidth, yPos + 8, margin + (idx + 1) * metricBoxWidth, yPos + highlightBoxHeight - 8);
        }
      });

      yPos += highlightBoxHeight + 15;

      // Use of Funds Section
      checkPage(50);
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Use of Funds Breakdown', margin, yPos);
      yPos += 12;

      const useOfFunds = [
        { category: 'Product Development', amount: 7200000, percentage: 40, color: COLORS.primary },
        { category: 'Sales & Marketing', amount: 4500000, percentage: 25, color: COLORS.accent },
        { category: 'Operations', amount: 3600000, percentage: 20, color: COLORS.teal },
        { category: 'G&A / Working Capital', amount: 2700000, percentage: 15, color: COLORS.purple },
      ];

      // Horizontal stacked bar
      const barHeight = 12;
      let barX = margin;

      useOfFunds.forEach((item) => {
        const itemWidth = (item.percentage / 100) * contentWidth;
        doc.setFillColor(...hexToRgb(item.color));
        doc.rect(barX, yPos, itemWidth, barHeight, 'F');
        barX += itemWidth;
      });

      yPos += barHeight + 8;

      // Legend and values
      const legendColWidth = contentWidth / 2;

      useOfFunds.forEach((item, idx) => {
        const col = idx % 2;
        const legendX = margin + col * legendColWidth;
        const legendY = yPos + Math.floor(idx / 2) * 14;

        // Color dot
        doc.setFillColor(...hexToRgb(item.color));
        doc.circle(legendX + 4, legendY, 3, 'F');

        // Category and percentage
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.bodySmall.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(`${item.category} (${item.percentage}%)`, legendX + 12, legendY + 1);

        // Amount
        doc.setFont(fontFamily, 'bold');
        doc.text(formatCurrency(item.amount), legendX + legendColWidth - 20, legendY + 1, { align: 'right' });
      });

      yPos += 35;

      // Key Investment Thesis
      checkPage(60);
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Investment Thesis', margin, yPos);
      yPos += 10;

      const thesisPoints = [
        'First-mover advantage in UAE government AI transformation market',
        'Proven technology with enterprise-grade security and compliance',
        'Strong recurring revenue potential through SaaS model',
        'Strategic alignment with UAE Vision 2071 and digital government initiatives',
        'Experienced team with deep government sector expertise',
      ];

      thesisPoints.forEach((point) => {
        checkPage(10);
        doc.setFillColor(...hexToRgb(COLORS.gold));
        doc.circle(margin + 4, yPos, 2, 'F');

        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.body.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(point, margin + 12, yPos + 1);
        yPos += 8;
      });

      yPos += 10;

      // Market Opportunity
      checkPage(70);
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(TYPOGRAPHY.subsectionTitle.size);
      doc.setFont(fontFamily, 'bold');
      doc.text('Market Opportunity', margin, yPos);
      yPos += 10;

      const marketData = [
        { metric: 'UAE GovTech Market Size', value: 'AED 2.5B', growth: '+15% CAGR' },
        { metric: 'Total Addressable Market', value: 'AED 850M', growth: 'AI Solutions' },
        { metric: 'Target Market Share (Y3)', value: '12%', growth: 'Conservative' },
      ];

      marketData.forEach((item) => {
        checkPage(20);
        doc.setFillColor(...hexToRgb(COLORS.lightGray));
        doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, 'F');

        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(TYPOGRAPHY.bodySmall.size);
        doc.setFont(fontFamily, 'normal');
        doc.text(item.metric, margin + 5, yPos + 9);

        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.text(item.value, margin + contentWidth / 2, yPos + 9, { align: 'center' });

        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.success));
        doc.text(item.growth, margin + contentWidth - 5, yPos + 9, { align: 'right' });

        yPos += 18;
      });
    };

    const addCoverPage = () => {
      const [pr, pg, pb] = hexToRgb(COLORS.primary);
      doc.setFillColor(pr, pg, pb);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      const [ar, ag, ab] = hexToRgb(COLORS.accent);
      doc.setFillColor(ar, ag, ab);
      doc.rect(0, pageHeight * 0.62, pageWidth, 4, 'F');

      if (this.logoBase64) {
        try {
          doc.addImage(this.logoBase64, 'PNG', pageWidth / 2 - 30, 25, 60, 60);
        } catch (_e) {
          logger.info('[PDF] Could not add logo to cover');
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(48);
      doc.setFont(fontFamily, 'bold');
      doc.text('COREVIA', pageWidth / 2, 105, { align: 'center' });

      doc.setFontSize(16);
      doc.setFont(fontFamily, 'normal');
      doc.text('Enterprise Intelligence Platform', pageWidth / 2, 118, { align: 'center' });

      const [gr, gg, gb] = hexToRgb(COLORS.gold);
      doc.setTextColor(gr, gg, gb);
      doc.setFontSize(32);
      doc.setFont(fontFamily, 'bold');

      const titleMap: Record<string, string> = {
        'business_case': 'Business Case',
        'requirements': 'Requirements Analysis',
        'strategic_fit': 'Strategic Fit Analysis'
      };
      doc.text(titleMap[type] || 'Document', pageWidth / 2, 150, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(fontFamily, 'normal');
      const projectName = report.suggestedProjectName || report.organizationName || 'Project Report';
      const titleLines = doc.splitTextToSize(projectName, pageWidth - 50);
      doc.text(titleLines, pageWidth / 2, 170, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...hexToRgb(COLORS.gray));
      const infoY = 210;
      doc.text(`Organization: ${report.organizationName || 'N/A'}`, pageWidth / 2, infoY, { align: 'center' });
      doc.text(`Department: ${report.department || 'N/A'}`, pageWidth / 2, infoY + 10, { align: 'center' });
      doc.text(`Classification: ${report.classification || 'Confidential'}`, pageWidth / 2, infoY + 20, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy')}`, pageWidth / 2, pageHeight - 35, { align: 'center' });
      doc.text('CONFIDENTIAL - For Management Use Only', pageWidth / 2, pageHeight - 25, { align: 'center' });
    };

    const addTableOfContents = () => {
      addHeader();

      doc.setFontSize(22);
      doc.setFont(fontFamily, 'bold');
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.text('Table of Contents', pageWidth / 2, yPos + 8, { align: 'center' });
      yPos += 22;

      const [ar, ag, ab] = hexToRgb(COLORS.accent);
      doc.setFillColor(ar, ag, ab);
      doc.rect(pageWidth / 2 - 35, yPos - 2, 70, 2, 'F');
      yPos += 18;

      sections.forEach((section, _idx) => {
        const pageOffset = section.page;

        doc.setFontSize(11);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.text(section.title, margin + 8, yPos);

        const textWidth = doc.getTextWidth(section.title);
        const dotWidth = pageWidth - margin * 2 - textWidth - 25;
        const dots = '.'.repeat(Math.max(0, Math.floor(dotWidth / 2)));
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.text(dots, margin + 8 + textWidth + 4, yPos);

        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.text(String(pageOffset), pageWidth - margin - 8, yPos, { align: 'right' });

        yPos += 9;
      });
    };

    addCoverPage();

    if (type === 'business_case' && exportData?.businessCase) {
      const bc = exportData.businessCase;
      const financial = bc.financialAnalysis || {};

      // ============================================================================
      // PAGE 1: EXECUTIVE SUMMARY (UI-MATCHING LAYOUT)
      // ============================================================================
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Executive Summary', page: currentPage });

      // Financial Metrics Grid (4-column like UI)
      addFinancialMetricsGrid(bc);
      yPos += 4;

      // Executive Summary Card
      addCompactSectionHeader('Executive Summary', '#3B82F6');
      if (bc.executiveSummary) {
        addParagraph(bc.executiveSummary);
      }
      addSectionDivider('line');

      // Project Overview (compact 2-column)
      checkPage(40);
      addCompactSectionHeader('Project Overview', '#8B5CF6');
      const projectData = [
        { label: 'Project', value: report.suggestedProjectName || 'N/A' },
        { label: 'Organization', value: report.organizationName || 'N/A' },
        { label: 'Department', value: report.department || 'N/A' },
        { label: 'Industry', value: report.industryType || 'Government' },
      ];
      addKeyValuePairs(projectData, 2);

      // Background & Problem (combined for density)
      if (bc.backgroundAndContext || bc.problemStatement) {
        checkPage(40);
        addCompactSectionHeader('Background & Problem Statement', '#F59E0B');
        if (bc.backgroundAndContext) {
          addParagraph(bc.backgroundAndContext);
        }
        if (bc.problemStatement) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...hexToRgb(COLORS.primary));
          doc.text('Problem:', margin, yPos);
          yPos += 5;
          addParagraph(bc.problemStatement);
        }
      }

      // SMART Objectives (if present)
      if (bc.smartObjectives && Array.isArray(bc.smartObjectives) && bc.smartObjectives.length > 0) {
        checkPage(30);
        addCompactSectionHeader('SMART Objectives', '#10B981');
        const objectives = bc.smartObjectives.map((obj: string | SmartObjective) =>
          typeof obj === 'string' ? obj : obj.objective || obj.description || JSON.stringify(obj)
        );
        addBulletList(objectives);
      }

      // Scope (compact)
      if (bc.scopeDefinition) {
        checkPage(30);
        addCompactSectionHeader('Scope Definition', '#0D9488');
        const scope = bc.scopeDefinition;
        if (scope.inScope && Array.isArray(scope.inScope)) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...hexToRgb(COLORS.success));
          doc.text('IN SCOPE', margin, yPos);
          yPos += 5;
          addBulletList(scope.inScope);
        }
        if (scope.outOfScope && Array.isArray(scope.outOfScope)) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...hexToRgb(COLORS.danger));
          doc.text('OUT OF SCOPE', margin, yPos);
          yPos += 5;
          addBulletList(scope.outOfScope);
        }
      }

      // Deliverables (compact)
      if (bc.expectedDeliverables && Array.isArray(bc.expectedDeliverables) && bc.expectedDeliverables.length > 0) {
        checkPage(30);
        addCompactSectionHeader('Expected Deliverables', '#6366F1');
        const deliverables = bc.expectedDeliverables.map((d: string | Deliverable) =>
          typeof d === 'string' ? d : d.name || d.description || JSON.stringify(d)
        );
        addBulletList(deliverables);
      }

      // Proposed Solution
      if (bc.proposedSolution) {
        checkPage(30);
        addCompactSectionHeader('Proposed Solution', '#EC4899');
        addParagraph(bc.proposedSolution);
      }

      // ============================================================================
      // PAGE 2: FINANCIAL ANALYSIS (UI-MATCHING LAYOUT)
      // ============================================================================
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Financial Analysis', page: currentPage });

      // Page title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(16);
      doc.setFont(fontFamily, 'bold');
      doc.text('Financial Analysis', margin, yPos + 4);
      yPos += 14;

      // Financial Metrics Grid again for this page
      addFinancialMetricsGrid(bc);
      yPos += 4;

      // NPV and Discount Rate
      if (financial.npv !== undefined) {
        addKeyValuePairs([
          { label: 'Net Present Value', value: formatCurrency(financial.npv) },
          { label: 'Discount Rate', value: financial.discountRate ? `${financial.discountRate}%` : '10%' },
        ], 2);
      }

      if (financial.tcoBreakdown) {
        doc.setFontSize(12);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.text('Total Cost of Ownership Breakdown', margin, yPos);
        yPos += 10;

        const tco = financial.tcoBreakdown;
        addTable(
          ['Category', 'Amount (AED)', 'Percentage'],
          [
            ['Implementation', formatCurrency(tco.implementation), tco.implementation && financial.totalCost ? `${Math.round(Number(tco.implementation) / Number(financial.totalCost) * 100)}%` : 'N/A'],
            ['Operational', formatCurrency(tco.operational), tco.operational && financial.totalCost ? `${Math.round(Number(tco.operational) / Number(financial.totalCost) * 100)}%` : 'N/A'],
            ['Maintenance', formatCurrency(tco.maintenance), tco.maintenance && financial.totalCost ? `${Math.round(Number(tco.maintenance) / Number(financial.totalCost) * 100)}%` : 'N/A'],
          ],
          { alternateColors: true }
        );
      }

      if (financial.cashFlows && Array.isArray(financial.cashFlows) && financial.cashFlows.length > 0) {
        doc.setFontSize(12);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.text('5-Year Cash Flow Projection', margin, yPos);
        yPos += 10;

        const cfRows = financial.cashFlows.map((cf: CashFlowItem) => [
          `Year ${cf.year}`,
          formatCurrency(cf.investment),
          formatCurrency(cf.operationalCost),
          formatCurrency(cf.benefit),
          formatCurrency(cf.netCashFlow),
        ]);

        addTable(
          ['Year', 'Investment', 'Op. Cost', 'Benefit', 'Net Cash Flow'],
          cfRows,
          { alternateColors: true }
        );
      }

      if (financial.revenueStreams && Array.isArray(financial.revenueStreams) && financial.revenueStreams.length > 0) {
        checkPage(40);
        doc.setFontSize(12);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.text('Revenue Streams', margin, yPos);
        yPos += 10;

        const rsRows = financial.revenueStreams.map((rs: RevenueStream) => [
          rs.type || 'Stream',
          formatCurrency(rs.annualRevenue),
          `${rs.growthRate || 0}%`,
          rs.confidence || 'Medium',
        ]);

        addTable(
          ['Revenue Type', 'Annual Revenue', 'Growth Rate', 'Confidence'],
          rsRows,
          { alternateColors: true }
        );
      }

      if (bc.keyAssumptions || financial.keyAssumptions) {
        const assumptions = bc.keyAssumptions || financial.keyAssumptions || null;
        addSectionTitle('Key Assumptions');

        if (assumptions && assumptions.pricing && Array.isArray(assumptions.pricing)) {
          doc.setFontSize(11);
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(...hexToRgb(COLORS.primary));
          doc.text('Pricing Assumptions:', margin, yPos);
          yPos += 8;

          const pricingItems = assumptions.pricing.map((p: AssumptionItem) =>
            `${p.category}: ${p.assumption} = ${p.value} (${p.source || 'Industry benchmark'})`
          );
          addBulletList(pricingItems);
        }

        if (assumptions && assumptions.volume && Array.isArray(assumptions.volume)) {
          doc.setFontSize(11);
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(...hexToRgb(COLORS.primary));
          doc.text('Volume Assumptions:', margin, yPos);
          yPos += 8;

          const volumeItems = assumptions.volume.map((v: AssumptionItem) =>
            `${v.category}: ${v.assumption} = ${v.value}`
          );
          addBulletList(volumeItems);
        }

        if (assumptions && assumptions.costs && Array.isArray(assumptions.costs)) {
          doc.setFontSize(11);
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(...hexToRgb(COLORS.primary));
          doc.text('Cost Assumptions:', margin, yPos);
          yPos += 8;

          const costItems = assumptions.costs.map((c: AssumptionItem) =>
            `${c.category}: ${c.assumption} = ${c.value}`
          );
          addBulletList(costItems);
        }

        if (assumptions && assumptions.projectArchetype) {
          yPos += 5;
          doc.setFontSize(10);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...hexToRgb(COLORS.textLight));
          doc.text(`Project Archetype: ${assumptions.projectArchetype} (Match Score: ${assumptions.archetypeMatchScore || 'N/A'})`, margin, yPos);
          yPos += 10;
        }
      }

      if (bc.timeline && Array.isArray(bc.timeline) && bc.timeline.length > 0) {
        addSectionTitle('Implementation Timeline');

        // Visual timeline infographic
        checkPage(50);
        const timelinePhases = bc.timeline.slice(0, 5).map((phase: TimelinePhase) => ({
          name: phase.name || phase.phase || 'Phase',
          duration: phase.duration || phase.timeline || 'TBD',
          status: phase.status || 'pending',
        }));

        if (timelinePhases.length > 0) {
          addTimeline(margin, yPos, contentWidth, timelinePhases);
          yPos += 45;
        }

        // Also show detailed table
        const phases = bc.timeline.map((phase: TimelinePhase, idx: number) => [
          `Phase ${idx + 1}`,
          phase.name || phase.phase || 'Phase',
          phase.duration || phase.timeline || 'TBD',
          phase.description || phase.deliverables?.join(', ') || 'N/A',
        ]);

        addTable(
          ['#', 'Phase', 'Duration', 'Description'],
          phases,
          { alternateColors: true }
        );
      }

      // ============================================================================
      // PAGE 3: STRATEGIC ALIGNMENT, COMPLIANCE & KPIS (UI-MATCHING 3-COLUMN)
      // ============================================================================
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Governance & Strategy', page: currentPage });

      // Page title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(16);
      doc.setFont(fontFamily, 'bold');
      doc.text('Strategic Alignment, Compliance & KPIs', margin, yPos + 4);
      yPos += 12;

      // 3-column card layout (matching UI grid-cols-3)
      const colWidth = (contentWidth - 8) / 3;
      const cardStartY = yPos;
      const cardHeight = 85;

      // --- Column 1: Strategic Alignment ---
      const col1X = margin;
      let colY = cardStartY;

      // Card background
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.setLineWidth(0.5);
      doc.roundedRect(col1X, colY, colWidth, cardHeight, 2, 2, 'FD');

      // Card header with gradient icon
      drawIconBox(col1X + 4, colY + 4, 8, COLORS.teal, 'trending');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'bold');
      doc.text('Strategic Alignment', col1X + 15, colY + 10);
      colY += 18;

      // Strategic Objectives
      if (bc.strategicObjectives && Array.isArray(bc.strategicObjectives) && bc.strategicObjectives.length > 0) {
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'bold');
        doc.text('Strategic Objectives', col1X + 4, colY);
        colY += 4;

        bc.strategicObjectives.slice(0, 4).forEach((obj: string | SmartObjective) => {
          const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'normal');
          doc.setFillColor(...hexToRgb(COLORS.teal));
          doc.circle(col1X + 6, colY + 0.5, 0.8, 'F');
          doc.text(text.substring(0, 35), col1X + 9, colY + 1.5);
          colY += 5;
        });
        colY += 2;
      }

      // Department Impact
      if (bc.departmentImpact) {
        if (bc.departmentImpact.positive && bc.departmentImpact.positive.length > 0) {
          doc.setTextColor(...hexToRgb(COLORS.success));
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'bold');
          doc.text('Positive Impacts:', col1X + 4, colY);
          colY += 4;
          bc.departmentImpact.positive.slice(0, 2).forEach((item: string | { text?: string }) => {
            const text = typeof item === 'string' ? item : JSON.stringify(item);
            doc.setFont(fontFamily, 'normal');
            doc.setTextColor(...hexToRgb(COLORS.text));
            doc.text(`• ${text.substring(0, 30)}`, col1X + 4, colY);
            colY += 4;
          });
        }
        if (bc.departmentImpact.negative && bc.departmentImpact.negative.length > 0 && colY < cardStartY + cardHeight - 8) {
          doc.setTextColor(...hexToRgb(COLORS.danger));
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'bold');
          doc.text('Challenges:', col1X + 4, colY);
          colY += 4;
          bc.departmentImpact.negative.slice(0, 2).forEach((item: string | { text?: string }) => {
            const text = typeof item === 'string' ? item : JSON.stringify(item);
            doc.setFont(fontFamily, 'normal');
            doc.setTextColor(...hexToRgb(COLORS.text));
            doc.text(`• ${text.substring(0, 30)}`, col1X + 4, colY);
            colY += 4;
          });
        }
      }

      // --- Column 2: Compliance & Governance ---
      const col2X = margin + colWidth + 4;
      colY = cardStartY;

      // Card background
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.roundedRect(col2X, colY, colWidth, cardHeight, 2, 2, 'FD');

      // Card header with gradient icon (indigo)
      drawIconBox(col2X + 4, colY + 4, 8, COLORS.purple, 'shield');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'bold');
      doc.text('Compliance & Governance', col2X + 15, colY + 10);
      colY += 18;

      // Compliance Requirements
      if (bc.complianceRequirements && Array.isArray(bc.complianceRequirements) && bc.complianceRequirements.length > 0) {
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'bold');
        doc.text('Compliance Requirements', col2X + 4, colY);
        colY += 4;

        bc.complianceRequirements.slice(0, 4).forEach((req: string | { requirement?: string }) => {
          const text = typeof req === 'string' ? req : JSON.stringify(req);
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'normal');
          doc.setFillColor(...hexToRgb(COLORS.purple));
          doc.circle(col2X + 6, colY + 0.5, 0.8, 'F');
          doc.text(text.substring(0, 35), col2X + 9, colY + 1.5);
          colY += 5;
        });
        colY += 2;
      }

      // Policy References
      if (bc.policyReferences && Array.isArray(bc.policyReferences) && bc.policyReferences.length > 0) {
        doc.setTextColor(...hexToRgb(COLORS.text));
        doc.setFontSize(7);
        doc.setFont(fontFamily, 'bold');
        doc.text('Policy References', col2X + 4, colY);
        colY += 4;

        bc.policyReferences.slice(0, 3).forEach((policy: string | { policy?: string }) => {
          const text = typeof policy === 'string' ? policy : JSON.stringify(policy);
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'normal');
          doc.text(`• ${text.substring(0, 30)}`, col2X + 4, colY);
          colY += 5;
        });
      }

      // --- Column 3: KPIs & Success Metrics ---
      const col3X = margin + (colWidth + 4) * 2;
      colY = cardStartY;

      // Card background
      doc.setFillColor(...hexToRgb(COLORS.white));
      doc.setDrawColor(...hexToRgb(COLORS.lightGray));
      doc.roundedRect(col3X, colY, colWidth, cardHeight, 2, 2, 'FD');

      // Card header with gradient icon (green)
      drawIconBox(col3X + 4, colY + 4, 8, COLORS.success, 'target');
      doc.setTextColor(...hexToRgb(COLORS.text));
      doc.setFontSize(9);
      doc.setFont(fontFamily, 'bold');
      doc.text('KPIs & Success Metrics', col3X + 15, colY + 10);
      colY += 18;

      // KPIs with full details
      const kpis = bc.kpis || bc.kpisAndMetrics || [];
      if (kpis.length > 0) {
        kpis.slice(0, 4).forEach((kpi: KPIItem, _idx: number) => {
          // KPI card box
          doc.setFillColor(...hexToRgb('#DCFCE7')); // green-50
          doc.setDrawColor(...hexToRgb(COLORS.success));
          doc.setLineWidth(0.2);
          doc.roundedRect(col3X + 4, colY, colWidth - 8, 14, 1, 1, 'FD');

          doc.setTextColor(...hexToRgb(COLORS.text));
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'bold');
          doc.text((kpi.name || 'KPI').substring(0, 25), col3X + 6, colY + 4);

          doc.setFontSize(5);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...hexToRgb(COLORS.textMuted));
          if (kpi.target) {
            doc.text(`Target: ${kpi.target}`.substring(0, 30), col3X + 6, colY + 8);
          }
          if (kpi.baseline) {
            doc.text(`Baseline: ${kpi.baseline}`.substring(0, 30), col3X + 6, colY + 11);
          }

          colY += 16;
        });
      } else if (bc.successCriteria && Array.isArray(bc.successCriteria)) {
        bc.successCriteria.slice(0, 5).forEach((c: string | SuccessCriterion) => {
          const text = typeof c === 'string' ? c : c.criteria || c.metric || JSON.stringify(c);
          doc.setFontSize(6);
          doc.setFont(fontFamily, 'normal');
          doc.setFillColor(...hexToRgb(COLORS.success));
          doc.circle(col3X + 6, colY + 0.5, 0.8, 'F');
          doc.text(text.substring(0, 35), col3X + 9, colY + 1.5);
          colY += 5;
        });
      }

      yPos = cardStartY + cardHeight + 8;

      // Power/Interest Matrix (full width below 3-column)
      if (bc.stakeholderAnalysis || (bc.stakeholders && Array.isArray(bc.stakeholders))) {
        const stakeholders = Array.isArray(bc.stakeholderAnalysis) ? bc.stakeholderAnalysis :
                            bc.stakeholderAnalysis?.stakeholders || bc.stakeholders || [];

        // Compute matrix from stakeholder data
        const matrix = {
          manageClosely: [] as string[],
          keepSatisfied: [] as string[],
          keepInformed: [] as string[],
          monitor: [] as string[]
        };

        stakeholders.forEach((s: Stakeholder) => {
          const influence = (s.influence || s.power || '').toLowerCase();
          const interest = (s.interest || '').toLowerCase();
          const name = s.name || s.role || 'Stakeholder';

          if ((influence.includes('high') && interest.includes('high')) || influence.includes('critical')) {
            matrix.manageClosely.push(name);
          } else if (influence.includes('high') && interest.includes('low')) {
            matrix.keepSatisfied.push(name);
          } else if (influence.includes('low') && interest.includes('high')) {
            matrix.keepInformed.push(name);
          } else {
            matrix.monitor.push(name);
          }
        });

        addPowerInterestMatrix(matrix);
      }

      // ============================================================================
      // PAGE 4: RISK ASSESSMENT & ASSUMPTIONS (UI-MATCHING)
      // ============================================================================
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Risk Assessment', page: currentPage });

      // Page title
      doc.setTextColor(...hexToRgb(COLORS.primary));
      doc.setFontSize(16);
      doc.setFont(fontFamily, 'bold');
      doc.text('Risk Assessment & Assumptions', margin, yPos + 4);
      yPos += 14;

      // Risk Heat Map (UI-matching with 3x3 grid and legend)
      if (bc.risks && Array.isArray(bc.risks) && bc.risks.length > 0) {
        const riskAssumptions = bc.risks.map((r: string | RiskItem) => {
          const risk = typeof r === 'string' ? { title: r, severity: 'Medium', likelihood: 'Medium' } : r;
          return {
            assumption: risk.title || risk.risk || risk.name || 'Risk',
            impact: String(risk.severity || risk.impact || 'Medium'),
            likelihood: String(risk.likelihood || risk.probability || 'Medium'),
            riskScore: (() => {
              const impactScore = String(risk.severity || '').toLowerCase().includes('high') ? 3 :
                                 String(risk.severity || '').toLowerCase().includes('low') ? 1 : 2;
              const likelihoodScore = String(risk.likelihood || '').toLowerCase().includes('high') ? 3 :
                                     String(risk.likelihood || '').toLowerCase().includes('low') ? 1 : 2;
              return impactScore * likelihoodScore;
            })()
          };
        });
        addRiskHeatMap(riskAssumptions);

        // Detailed risk table
        addSectionDivider('line');
        const riskRows = bc.risks.map((r: string | RiskItem) => {
          const risk = typeof r === 'string' ? { title: r, severity: 'Medium', mitigation: 'TBD' } : r;
          return [
            (risk.title || risk.risk || risk.name || 'Risk').substring(0, 30),
            String(risk.severity || risk.impact || 'Medium'),
            String(risk.likelihood || risk.probability || 'Medium'),
            (risk.mitigation || risk.response || 'TBD').substring(0, 35),
          ];
        });

        addTable(
          ['Risk', 'Impact', 'Likelihood', 'Mitigation'],
          riskRows,
          { alternateColors: true }
        );
      }

      // Assumptions & Dependencies Card
      const assumptions: Array<string | AssumptionRiskItem> =
                         (Array.isArray(bc.keyAssumptions) ? bc.keyAssumptions : []) as Array<string | AssumptionRiskItem>;
      const dependencies: Array<string | DependencyItem> =
                          (Array.isArray(bc.projectDependencies) ? bc.projectDependencies : []);

      if (assumptions.length > 0 || dependencies.length > 0) {
        addAssumptionsDependenciesCard(assumptions, dependencies);
      }

      // Critical Milestones
      if (bc.criticalMilestones && Array.isArray(bc.criticalMilestones)) {
        const milestones = bc.criticalMilestones.map((m: string) => ({ name: m }));
        addMilestonesCard(milestones);
      }

      // ============================================================================
      // PAGE 5: IMPLEMENTATION ROADMAP (UI-MATCHING)
      // ============================================================================
      if (bc.recommendations?.implementationRoadmap || bc.timeline) {
        doc.addPage();
        currentPage++;
        addHeader();
        sections.push({ title: 'Implementation Roadmap', page: currentPage });

        // Page title
        doc.setTextColor(...hexToRgb(COLORS.primary));
        doc.setFontSize(16);
        doc.setFont(fontFamily, 'bold');
        doc.text('Implementation Roadmap', margin, yPos + 4);
        yPos += 14;

        // Extract quick wins and strategic initiatives
        const roadmap = bc.recommendations?.implementationRoadmap || {};
        const quickWins = roadmap.quickWins || [];
        const strategicInitiatives = roadmap.strategicInitiatives || [];

        if (quickWins.length > 0 || strategicInitiatives.length > 0) {
          const quickWinsRoadmap: RoadmapItem[] = quickWins.map((item: string) => ({ name: item }));
          const strategicRoadmap: RoadmapItem[] = strategicInitiatives.map((item: string) => ({ name: item }));
          addImplementationRoadmap(quickWinsRoadmap, strategicRoadmap);
        }

        // Timeline phases
        if (bc.timeline && Array.isArray(bc.timeline) && bc.timeline.length > 0) {
          addSectionDivider('line');

          // Visual timeline
          checkPage(50);
          const timelinePhases = bc.timeline.slice(0, 5).map((phase: TimelinePhase) => ({
            name: phase.name || phase.phase || 'Phase',
            duration: phase.duration || phase.timeline || 'TBD',
            status: phase.status || 'pending',
          }));

          if (timelinePhases.length > 0) {
            addTimeline(margin, yPos, contentWidth, timelinePhases);
            yPos += 45;
          }

          // Detailed phases table
          const phases = bc.timeline.map((phase: TimelinePhase, idx: number) => [
            `Phase ${idx + 1}`,
            phase.name || phase.phase || 'Phase',
            phase.duration || phase.timeline || 'TBD',
            (phase.description || phase.deliverables?.join(', ') || 'N/A').substring(0, 40),
          ]);

          addTable(
            ['#', 'Phase', 'Duration', 'Description'],
            phases,
            { alternateColors: true }
          );
        }
      }

      // Benefits section
      if (bc.benefits && Array.isArray(bc.benefits) && bc.benefits.length > 0) {
        checkPage(40);
        addCompactSectionHeader('Expected Benefits', '#10B981');

        const benefitItems = bc.benefits.map((b: string | BenefitItem) => {
          if (typeof b === 'string') return b;
          return `${b.category || b.type || 'Benefit'}: ${b.description || b.value || JSON.stringify(b)}`;
        });
        addBulletList(benefitItems);
      }

      // Recommendation
      const recommendationObject = bc.recommendations && typeof bc.recommendations === 'object'
        ? bc.recommendations
        : null;
      const primaryRecommendation = bc.recommendation || recommendationObject?.primaryRecommendation || recommendationObject?.summary || bc.businessRequirements;
      const commercialCase = recommendationObject?.commercialCase;
      const publicValueCase = recommendationObject?.publicValueCase;
      if (primaryRecommendation || commercialCase || publicValueCase) {
        checkPage(40);
        addCompactSectionHeader('Recommendation', '#6366F1');
        if (primaryRecommendation) {
          addHighlightBox(primaryRecommendation);
        }
        if (commercialCase) {
          checkPage(28);
          addCompactSectionHeader('Commercial Case', '#2563EB');
          addHighlightBox(commercialCase);
        }
        if (publicValueCase) {
          checkPage(28);
          addCompactSectionHeader('Public-Value Case', '#0F766E');
          addHighlightBox(publicValueCase);
        }
      }

      // Quality Score
      if (bc.qualityScore) {
        checkPage(20);
        doc.setFontSize(10);
        doc.setTextColor(...hexToRgb(COLORS.textLight));
        doc.text(`AI Quality Score: ${bc.qualityScore}/100`, margin, yPos);
        yPos += 8;
      }
    }

    // ============================================================================
    // STRATEGIC FIT ANALYSIS RENDERING
    // ============================================================================
    logger.info('[DocumentExport] Strategic Fit PDF rendering check:', {
      type,
      hasStrategicFit: !!exportData?.strategicFit,
      strategicFitKeys: exportData?.strategicFit ? Object.keys(exportData.strategicFit) : [],
      hasPrimaryRec: !!exportData?.strategicFit?.primaryRecommendation,
    });

    if (type === 'strategic_fit' && exportData?.strategicFit) {
      logger.info('[DocumentExport] ENTERING Strategic Fit PDF rendering block');
      const sf = exportData.strategicFit;
      const primary = sf.primaryRecommendation || {};
      const alternatives = sf.alternativeRecommendations || [];
      const bc = exportData.businessCase || {};
      const req = exportData.requirements || {};

      logger.info('[DocumentExport] Strategic Fit data:', {
        primaryRoute: primary.route,
        primaryConfidence: primary.confidence,
        alternativesCount: alternatives.length,
        hasBC: !!bc?.executiveSummary,
        hasReq: !!req,
      });

      // PAGE 1: EXECUTIVE SUMMARY (matching tab display)
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Executive Summary', page: currentPage });

      addCompactSectionHeader('Executive Summary', '#3B82F6');

      // Project Identification
      if (report.suggestedProjectName || report.projectId) {
        checkPage(25);
        const [bgR, bgG, bgB] = hexToRgb('#F1F5F9');
        doc.setFillColor(bgR, bgG, bgB);
        doc.roundedRect(margin, yPos, contentWidth, 18, 2, 2, 'F');

        doc.setFontSize(10);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...hexToRgb(COLORS.textLight));

        let projText = '';
        if (report.projectId) projText = `${report.projectId}`;
        const suggestedName = report.suggestedProjectName || '';
        if (suggestedName) projText += projText ? ` | ${suggestedName}` : suggestedName;
        doc.text(projText, margin + 6, yPos + 11);
        yPos += 24;
      }

      // Business Case Conclusion
      checkPage(50);
      addCompactSectionHeader('Business Case Conclusion', '#2563EB');

      if (bc.executiveSummary || bc.description) {
        addParagraph(bc.executiveSummary || bc.description || '');
      }

      // Strategic Objectives from Business Case (mapped from smartObjectives)
      const strategicGoals = bc.strategicObjectives || bc.smartObjectives || [];
      if (Array.isArray(strategicGoals) && strategicGoals.length > 0) {
        checkPage(30);
        doc.setFontSize(10);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb('#2563EB'));
        doc.text('Strategic Goals:', margin, yPos);
        yPos += 6;
        // Handle both string array and object array formats
        const goalStrings = strategicGoals.slice(0, 5).map((obj: string | SmartObjective & { goal?: string }) =>
          typeof obj === 'string' ? obj : (obj.objective || obj.description || obj.goal || JSON.stringify(obj))
        );
        addBulletList(goalStrings);
      }

      // Implementation Timeline from Business Case
      const implPhases = bc.implementationPhases || bc.timeline || [];
      if (Array.isArray(implPhases) && implPhases.length > 0) {
        checkPage(50);
        doc.setFontSize(10);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb('#2563EB'));
        doc.text('Implementation Timeline:', margin, yPos);
        yPos += 8;

        const phaseRows = implPhases.slice(0, 5).map((phase: TimelinePhase, idx: number) => [
          `Phase ${idx + 1}`,
          phase.name || phase.phase || `Phase ${idx + 1}`,
          phase.duration || 'TBD',
          (phase.deliverables && Array.isArray(phase.deliverables))
            ? phase.deliverables.slice(0, 2).join(', ')
            : (phase.description || 'N/A').substring(0, 40)
        ]);
        addTable(['#', 'Phase', 'Duration', 'Key Deliverables'], phaseRows, { alternateColors: true });
      }

      // Executive Governance Gates from Strategic Fit
      const govReqs = sf.governanceRequirements as GovernanceRequirementsExpanded | string | Array<string | { requirement?: string }> | undefined;
      const approvalGates = (typeof govReqs === 'object' && !Array.isArray(govReqs) && govReqs?.approvalGates) || (Array.isArray(govReqs) ? govReqs : []);
      if (Array.isArray(approvalGates) && approvalGates.length > 0) {
        checkPage(30);
        doc.setFontSize(10);
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...hexToRgb('#6366F1'));
        doc.text('Executive Governance Gates:', margin, yPos);
        yPos += 6;
        const gateItems = approvalGates.slice(0, 4).map((gate: string | GovernanceGate) =>
          typeof gate === 'string' ? gate : (gate.checkpoint || gate.name || gate.gate || JSON.stringify(gate))
        );
        addBulletList(gateItems);
      }

      // Requirements Analysis Summary
      if (req) {
        checkPage(40);
        addCompactSectionHeader('Requirements Analysis Summary', '#7C3AED');

        // Count requirements from all categories
        const allReqs = [
          ...(Array.isArray(req.capabilities) ? req.capabilities : []),
          ...(Array.isArray(req.functionalRequirements) ? req.functionalRequirements : []),
          ...(Array.isArray(req.nonFunctionalRequirements) ? req.nonFunctionalRequirements : []),
          ...(Array.isArray(req.securityRequirements) ? req.securityRequirements : [])
        ];

        const highPriority = allReqs.filter((r: RequirementItem) => r?.priority === 'High').length;
        const mediumPriority = allReqs.filter((r: RequirementItem) => r?.priority === 'Medium').length;
        const lowPriority = allReqs.filter((r: RequirementItem) => r?.priority === 'Low').length;

        if (allReqs.length > 0) {
          const reqStats = [
            ['Metric', 'Value'],
            ['Total Requirements', `${allReqs.length}`],
            ['High Priority', `${highPriority}`],
            ['Medium Priority', `${mediumPriority}`],
            ['Low Priority', `${lowPriority}`],
          ];

          addTable(['Metric', 'Value'], reqStats.slice(1), { alternateColors: true });
        } else {
          addParagraph('Requirements analysis provides detailed functional and non-functional requirements for this initiative.');
        }
      }

      // PAGE 2: PRIMARY RECOMMENDATION
      doc.addPage();
      currentPage++;
      addHeader();
      sections.push({ title: 'Primary Recommendation', page: currentPage });

      // Recommendation Header
      addCompactSectionHeader('AI-Recommended Implementation Route', '#3B82F6');

      // Primary Route Card
      const routeLabel = primary.route?.replace(/_/g, ' ') || 'Recommended Route';
      const routeConfidence = primary.confidence || primary.confidenceScore || 0;

      checkPage(50);
      const [pr, pg, pb] = hexToRgb('#1E3A5F');
      doc.setFillColor(pr, pg, pb);
      doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont(fontFamily, 'bold');
      doc.text(routeLabel, margin + 8, yPos + 12);

      doc.setFontSize(11);
      doc.setFont(fontFamily, 'normal');
      doc.text(`Confidence: ${routeConfidence}%`, margin + 8, yPos + 22);

      if (primary.estimatedTimeToStart || primary.timeline) {
        doc.text(`Timeline: ${primary.estimatedTimeToStart || primary.timeline}`, margin + contentWidth/2, yPos + 22);
      }

      if (primary.budgetEstimate || primary.budget) {
        doc.text(`Budget: ${primary.budgetEstimate || primary.budget}`, margin + 8, yPos + 30);
      }

      yPos += 42;

      // Justification
      if (primary.justification || primary.rationale) {
        checkPage(30);
        addCompactSectionHeader('AI Rationale', '#10B981');
        const rationaleText = primary.justification || primary.rationale;
        if (rationaleText) {
          addParagraph(rationaleText);
        }
      }

      // Key Strengths
      if (primary.keyStrengths && Array.isArray(primary.keyStrengths) && primary.keyStrengths.length > 0) {
        checkPage(30);
        addCompactSectionHeader('Key Strengths', '#8B5CF6');
        addBulletList(primary.keyStrengths);
      }

      // Key Factors
      if (primary.keyFactors && Array.isArray(primary.keyFactors) && primary.keyFactors.length > 0) {
        checkPage(30);
        addCompactSectionHeader('Key Decision Factors', '#F59E0B');
        addBulletList(primary.keyFactors);
      }

      // Risk Level
      if (primary.riskLevel) {
        checkPage(20);
        const riskColor = primary.riskLevel.toLowerCase().includes('high') ? '#EF4444' :
                          primary.riskLevel.toLowerCase().includes('medium') ? '#F59E0B' : '#10B981';
        addCompactSectionHeader('Risk Assessment', riskColor);
        addHighlightBox(`Risk Level: ${primary.riskLevel}${primary.complexity ? ` | Complexity: ${primary.complexity}` : ''}`);
      }

      // Alternative Recommendations
      if (alternatives.length > 0) {
        doc.addPage();
        currentPage++;
        addHeader();
        sections.push({ title: 'Alternative Routes', page: currentPage });

        addCompactSectionHeader('Alternative Implementation Routes', '#6366F1');

        alternatives.forEach((alt: StrategicFitRecommendation, idx: number) => {
          checkPage(40);
          const altRoute = alt.route?.replace(/_/g, ' ') || `Alternative ${idx + 1}`;
          const altConf = alt.confidence || alt.confidenceScore || 0;

          doc.setFontSize(12);
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(...hexToRgb(COLORS.primary));
          doc.text(`${idx + 1}. ${altRoute}`, margin, yPos);

          doc.setFontSize(10);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...hexToRgb(COLORS.text));
          doc.text(`Confidence: ${altConf}%`, margin + contentWidth - 40, yPos);
          yPos += 7;

          if (alt.justification || alt.rationale) {
            const altRationale = alt.justification || alt.rationale;
            if (altRationale) {
              addParagraph(altRationale.substring(0, 200) + '...');
            }
          }

          yPos += 5;
        });
      }

      // Decision Criteria
      if (sf.decisionCriteria && Array.isArray(sf.decisionCriteria) && sf.decisionCriteria.length > 0) {
        checkPage(40);
        addCompactSectionHeader('Decision Criteria', '#0D9488');
        const criteriaItems = sf.decisionCriteria.map((c: string | { name?: string; criterion?: string; weight?: number; description?: string }) =>
          typeof c === 'string' ? c : `${c.name || c.criterion}: ${c.weight ? `(Weight: ${c.weight}%)` : ''} ${c.description || ''}`
        );
        addBulletList(criteriaItems);
      }

      // Implementation Approach
      if (sf.implementationApproach) {
        checkPage(40);
        addCompactSectionHeader('Implementation Approach', '#8B5CF6');
        if (typeof sf.implementationApproach === 'string') {
          addParagraph(sf.implementationApproach);
        } else {
          const approachItems = Object.entries(sf.implementationApproach).map(([k, v]) =>
            `${k.replace(/([A-Z])/g, ' $1').trim()}: ${typeof v === 'string' ? v : JSON.stringify(v)}`
          );
          addBulletList(approachItems);
        }
      }

      // Governance Requirements
      if (sf.governanceRequirements) {
        checkPage(40);
        addCompactSectionHeader('Governance Requirements', '#EF4444');
        if (typeof sf.governanceRequirements === 'string') {
          addParagraph(sf.governanceRequirements);
        } else if (Array.isArray(sf.governanceRequirements)) {
          addBulletList(sf.governanceRequirements.map((g: string | { requirement?: string }) => typeof g === 'string' ? g : g.requirement || JSON.stringify(g)));
        }
      }

      // Resource Requirements
      if (sf.resourceRequirements) {
        checkPage(40);
        addCompactSectionHeader('Resource Requirements', '#3B82F6');
        if (typeof sf.resourceRequirements === 'string') {
          addParagraph(sf.resourceRequirements);
        } else if (Array.isArray(sf.resourceRequirements)) {
          addBulletList(sf.resourceRequirements.map((r: string | { resource?: string }) => typeof r === 'string' ? r : r.resource || JSON.stringify(r)));
        }
      }

      // Risk Mitigation
      if (sf.riskMitigation) {
        checkPage(40);
        addCompactSectionHeader('Risk Mitigation Strategies', '#F59E0B');
        if (typeof sf.riskMitigation === 'string') {
          addParagraph(sf.riskMitigation);
        } else if (Array.isArray(sf.riskMitigation)) {
          addBulletList(sf.riskMitigation.map((r: string | { strategy?: string; mitigation?: string }) => typeof r === 'string' ? r : r.strategy || r.mitigation || JSON.stringify(r)));
        }
      }

      // Compliance Considerations
      if (sf.complianceConsiderations) {
        checkPage(40);
        addCompactSectionHeader('Compliance Considerations', '#10B981');
        if (typeof sf.complianceConsiderations === 'string') {
          addParagraph(sf.complianceConsiderations);
        } else if (Array.isArray(sf.complianceConsiderations)) {
          addBulletList(sf.complianceConsiderations.map((c: string | { consideration?: string }) => typeof c === 'string' ? c : c.consideration || JSON.stringify(c)));
        }
      }
    }

    if (sections.length > 0) {
      doc.insertPage(2);
      doc.setPage(2);
      yPos = margin;
      addTableOfContents();
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i - 1, pageCount - 1);
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  private async exportPPTX(report: DemandReport, exportData: ExportDataBundle, type: string): Promise<Buffer> {
    const pptx = new PptxGenJSConstructor();
    pptx.author = 'COREVIA';
    pptx.company = 'COREVIA';
    pptx.subject = type.replace(/_/g, ' ').toUpperCase();

    const titleMap: Record<string, string> = {
      'business_case': 'Business Case',
      'requirements': 'Requirements Analysis',
      'strategic_fit': 'Strategic Fit Analysis'
    };
    pptx.title = `${report.suggestedProjectName || report.organizationName || 'Report'} - ${titleMap[type]}`;

    const formatCurrency = (value: CurrencyValue): string => {
      if (value === null || value === undefined || value === '') return 'TBD';
      if (typeof value === 'number') {
        if (value >= 1000000) return `AED ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `AED ${(value / 1000).toFixed(0)}K`;
        return `AED ${value.toLocaleString()}`;
      }
      if (typeof value === 'string') {
        if (/^AED\s/.test(value)) return value;
        return value || 'TBD';
      }
      return 'TBD';
    };

    const addTitleSlide = () => {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: '100%', fill: { color: PPTX_COLORS.primary } });

      if (this.logoBase64) {
        try {
          slide.addImage({ data: this.logoBase64, x: 4, y: 0.5, w: 2, h: 2 });
        } catch (_e) {
          logger.info('[PPTX] Could not add logo');
        }
      }

      slide.addText('COREVIA', { x: 0.5, y: 2.8, w: 9, h: 0.8, fontSize: 48, bold: true, color: PPTX_COLORS.white, align: 'center' });
      slide.addText('Enterprise Intelligence Platform', { x: 0.5, y: 3.5, w: 9, h: 0.4, fontSize: 16, color: PPTX_COLORS.gray, align: 'center' });
      slide.addText(titleMap[type] || 'Document', { x: 0.5, y: 4.2, w: 9, h: 0.6, fontSize: 28, bold: true, color: PPTX_COLORS.gold, align: 'center' });
      slide.addText(report.suggestedProjectName || report.organizationName || 'Report', { x: 0.5, y: 4.8, w: 9, h: 0.5, fontSize: 18, color: PPTX_COLORS.white, align: 'center' });
      slide.addText(`Confidential | ${format(new Date(), 'MMMM yyyy')}`, { x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 10, color: PPTX_COLORS.gray, align: 'center' });
    };

    const addContentSlide = (title: string, items: Array<{ label: string; value: string }>) => {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1, fill: { color: PPTX_COLORS.primary } });
      slide.addText(title, { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.white });

      let yPos = 1.3;
      items.forEach((item, idx) => {
        slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: yPos, w: 9, h: 0.55, fill: { color: idx % 2 === 0 ? PPTX_COLORS.lightGray : PPTX_COLORS.white } });
        slide.addText(item.label, { x: 0.6, y: yPos + 0.1, w: 3, h: 0.35, fontSize: 11, bold: true, color: PPTX_COLORS.primary });
        slide.addText(item.value || 'N/A', { x: 3.6, y: yPos + 0.1, w: 5.8, h: 0.35, fontSize: 11, color: PPTX_COLORS.text });
        yPos += 0.6;
      });
    };

    const addHighlightSlide = (title: string, content: string) => {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1, fill: { color: PPTX_COLORS.primary } });
      slide.addText(title, { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.white });
      slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.3, w: 9, h: 4, fill: { color: PPTX_COLORS.lightGray }, line: { color: PPTX_COLORS.accent, width: 2 } });
      slide.addText(content.substring(0, 1000), { x: 0.7, y: 1.5, w: 8.6, h: 3.6, fontSize: 12, color: PPTX_COLORS.text, valign: 'top' });
    };

    const addBulletSlide = (title: string, bullets: string[]) => {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 1, fill: { color: PPTX_COLORS.primary } });
      slide.addText(title, { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 24, bold: true, color: PPTX_COLORS.white });

      const bulletRows = bullets.slice(0, 8).map(b => ({ text: b, options: { bullet: true, fontSize: 13, color: PPTX_COLORS.text } }));
      slide.addText(bulletRows, { x: 0.5, y: 1.3, w: 9, h: 4, valign: 'top' });
    };

    addTitleSlide();

    addContentSlide('Project Overview', [
      { label: 'Project Name', value: report.suggestedProjectName || 'N/A' },
      { label: 'Organization', value: report.organizationName || 'N/A' },
      { label: 'Department', value: report.department || 'N/A' },
      { label: 'Status', value: report.workflowStatus || 'Draft' },
      { label: 'Priority', value: report.priority || 'Medium' },
      { label: 'Created', value: format(new Date(report.createdAt), 'dd MMM yyyy') },
    ]);

    if (type === 'business_case' && exportData?.businessCase) {
      const bc = exportData.businessCase;

      if (bc.executiveSummary) addHighlightSlide('Executive Summary', bc.executiveSummary);
      if (bc.backgroundAndContext) addHighlightSlide('Background & Context', bc.backgroundAndContext);
      if (bc.problemStatement) addHighlightSlide('Problem Statement', bc.problemStatement);
      if (bc.proposedSolution) addHighlightSlide('Proposed Solution', bc.proposedSolution);

      if (bc.smartObjectives && Array.isArray(bc.smartObjectives) && bc.smartObjectives.length > 0) {
        const objectives = bc.smartObjectives.map((obj: string | SmartObjective) =>
          typeof obj === 'string' ? obj : obj.objective || obj.description || JSON.stringify(obj)
        );
        addBulletSlide('SMART Objectives', objectives);
      }

      if (bc.benefits && Array.isArray(bc.benefits) && bc.benefits.length > 0) {
        const benefitItems = bc.benefits.map((b: string | BenefitItem) =>
          typeof b === 'string' ? b : `${b.category || 'Benefit'}: ${b.description || b.value || ''}`
        );
        addBulletSlide('Expected Benefits', benefitItems);
      }

      if (bc.scopeDefinition) {
        const scope = bc.scopeDefinition;
        const scopeItems: string[] = [];
        if (scope.inScope && Array.isArray(scope.inScope)) {
          scopeItems.push(...scope.inScope.map((s: string) => `In Scope: ${s}`));
        }
        if (scope.outOfScope && Array.isArray(scope.outOfScope)) {
          scopeItems.push(...scope.outOfScope.map((s: string) => `Out of Scope: ${s}`));
        }
        if (scopeItems.length > 0) {
          addBulletSlide('Scope Definition', scopeItems);
        }
      }

      if (bc.expectedDeliverables && Array.isArray(bc.expectedDeliverables) && bc.expectedDeliverables.length > 0) {
        const deliverables = bc.expectedDeliverables.map((d: string | Deliverable) =>
          typeof d === 'string' ? d : d.name || d.description || JSON.stringify(d)
        );
        addBulletSlide('Expected Deliverables', deliverables);
      }

      const financial = bc.financialAnalysis || {};
      addContentSlide('Financial Summary', [
        { label: 'Total Cost', value: formatCurrency(financial.totalCost) },
        { label: 'Total Benefit', value: formatCurrency(financial.totalBenefit) },
        { label: 'ROI', value: financial.roi ? `${financial.roi}%` : 'TBD' },
        { label: 'NPV', value: formatCurrency(financial.npv) },
        { label: 'Payback Period', value: financial.paybackPeriod || (financial.paybackMonths ? `${financial.paybackMonths} months` : 'TBD') },
      ]);

      if (bc.timeline && Array.isArray(bc.timeline) && bc.timeline.length > 0) {
        const phases = bc.timeline.map((phase: TimelinePhase, idx: number) =>
          `Phase ${idx + 1}: ${phase.name || phase.phase || 'Phase'} - ${phase.duration || phase.timeline || 'TBD'}`
        );
        addBulletSlide('Implementation Timeline', phases);
      }

      if (bc.stakeholders && Array.isArray(bc.stakeholders) && bc.stakeholders.length > 0) {
        const stakeholderItems = bc.stakeholders.map((s: Stakeholder) =>
          `${s.name || s.role || 'Stakeholder'}: ${s.responsibility || s.department || 'N/A'}`
        );
        addBulletSlide('Key Stakeholders', stakeholderItems);
      }

      if (bc.risks && Array.isArray(bc.risks) && bc.risks.length > 0) {
        const riskItems = bc.risks.map((r: string | RiskItem) => {
          if (typeof r === 'string') return r;
          return `${r.title || r.risk || 'Risk'} (${r.severity || 'Medium'}): ${r.mitigation || r.response || 'Mitigation TBD'}`;
        });
        addBulletSlide('Risks & Mitigation', riskItems);
      }

      if (bc.successCriteria && Array.isArray(bc.successCriteria) && bc.successCriteria.length > 0) {
        const criteria = bc.successCriteria.map((c: string | SuccessCriterion) =>
          typeof c === 'string' ? c : c.criteria || c.metric || c.description || JSON.stringify(c)
        );
        addBulletSlide('Success Criteria', criteria);
      }

      if (bc.keyAssumptions || financial.keyAssumptions) {
        const assumptions = bc.keyAssumptions || financial.keyAssumptions;
        const assumptionItems: string[] = [];
        if (assumptions && assumptions.pricing && Array.isArray(assumptions.pricing)) {
          assumptionItems.push(...assumptions.pricing.slice(0, 3).map((p: AssumptionItem) => `${p.category}: ${p.assumption}`));
        }
        if (assumptions && assumptions.volume && Array.isArray(assumptions.volume)) {
          assumptionItems.push(...assumptions.volume.slice(0, 3).map((v: AssumptionItem) => `${v.category}: ${v.assumption}`));
        }
        if (assumptionItems.length > 0) {
          addBulletSlide('Key Assumptions', assumptionItems);
        }
      }

      if (bc.recommendation || bc.businessRequirements) {
        addHighlightSlide('Recommendation', bc.recommendation || bc.businessRequirements || '');
      }
    }

    // ============================================================================
    // REQUIREMENTS PPTX RENDERING
    // ============================================================================
    if (type === 'requirements' && exportData?.requirements) {
      const req = exportData.requirements || {};
      const capabilities = Array.isArray(req.capabilities) ? req.capabilities : [];
      const functional = Array.isArray(req.functionalRequirements) ? req.functionalRequirements : [];
      const nonFunctional = Array.isArray(req.nonFunctionalRequirements) ? req.nonFunctionalRequirements : [];
      const security = Array.isArray(req.securityRequirements) ? req.securityRequirements : [];

      const allReqs = [...capabilities, ...functional, ...nonFunctional, ...security];
      const highPriority = allReqs.filter((item: RequirementItem) => String(item?.priority || '').toLowerCase() === 'high');

      addContentSlide('Executive Requirements Snapshot', [
        { label: 'Total Requirements', value: String(allReqs.length) },
        { label: 'High Priority', value: String(highPriority.length) },
        { label: 'Capabilities', value: String(capabilities.length) },
        { label: 'Functional', value: String(functional.length) },
        { label: 'Non-Functional', value: String(nonFunctional.length) },
        { label: 'Security', value: String(security.length) },
      ]);

      const criticalCapabilityBullets = (highPriority.length > 0 ? highPriority : capabilities)
        .slice(0, 8)
        .map((item: RequirementItem, idx: number) => {
          const name = item?.name || (item as Record<string, unknown>)?.title || (item as Record<string, unknown>)?.requirement || item?.description || `Capability ${idx + 1}`;
          const category = (item as Record<string, unknown>)?.category ? ` (${(item as Record<string, unknown>).category})` : '';
          return `${name}${category}`;
        });
      if (criticalCapabilityBullets.length > 0) {
        addBulletSlide('Critical Capabilities (Top 8)', criticalCapabilityBullets);
      }

      const qualitySignals = [
        `Priority density: ${allReqs.length > 0 ? Math.round((highPriority.length / allReqs.length) * 100) : 0}% high-priority requirements`,
        `Security coverage: ${security.length} security requirements explicitly defined`,
        `Execution readiness: ${functional.length > 0 && security.length > 0 ? 'Balanced functional + security baseline' : 'Further hardening recommended'}`,
      ];
      addBulletSlide('Executive Quality Signals', qualitySignals);
    }

    // ============================================================================
    // STRATEGIC FIT PPTX RENDERING
    // ============================================================================
    if (type === 'strategic_fit' && exportData?.strategicFit) {
      const sf = exportData.strategicFit;
      const primary = sf.primaryRecommendation || {};
      const alternatives = sf.alternativeRecommendations || [];
      const req = exportData.requirements || {};
      const reqCount = [
        ...(Array.isArray(req.capabilities) ? req.capabilities : []),
        ...(Array.isArray(req.functionalRequirements) ? req.functionalRequirements : []),
        ...(Array.isArray(req.nonFunctionalRequirements) ? req.nonFunctionalRequirements : []),
        ...(Array.isArray(req.securityRequirements) ? req.securityRequirements : []),
      ].length;

      // Executive Decision Slide
      const routeLabel = primary.route?.replace(/_/g, ' ') || 'Recommended Route';
      const routeConfidence = primary.confidence || primary.confidenceScore || 0;

      addContentSlide('Executive Route Decision', [
        { label: 'Route', value: routeLabel },
        { label: 'Confidence', value: `${routeConfidence}%` },
        { label: 'Timeline', value: primary.estimatedTimeToStart || primary.timeline || 'TBD' },
        { label: 'Budget', value: primary.budgetEstimate || primary.budget || 'TBD' },
        { label: 'Risk Level', value: primary.riskLevel || 'Medium' },
        { label: 'Complexity', value: primary.complexity || 'Medium' },
        { label: 'Requirements Evaluated', value: reqCount ? String(reqCount) : 'N/A' },
      ]);

      // Decision Narrative
      if (primary.justification || primary.rationale) {
        const rationale = primary.justification || primary.rationale;
        if (rationale) {
          addHighlightSlide('Decision Narrative', rationale);
        }
      }

      // Why this route now (cleaner, less dense)
      const whyNow = [
        ...(Array.isArray(primary.keyStrengths) ? primary.keyStrengths : []),
        ...(Array.isArray(primary.keyFactors) ? primary.keyFactors : []),
      ].slice(0, 8);
      if (whyNow.length > 0) {
        addBulletSlide('Why This Route Now', whyNow);
      }

      // Alternative Routes
      if (alternatives.length > 0) {
        const altItems = alternatives.map((alt: StrategicFitRecommendation, idx: number) => {
          const altRoute = alt.route?.replace(/_/g, ' ') || `Alternative ${idx + 1}`;
          const altConf = alt.confidence || alt.confidenceScore || 0;
          return `${altRoute} (${altConf}% confidence)${alt.riskLevel ? ` - ${alt.riskLevel} risk` : ''}`;
        }).slice(0, 6);
        addBulletSlide('Alternative Routes Considered', altItems);
      }

      // Decision Criteria
      if (sf.decisionCriteria && Array.isArray(sf.decisionCriteria) && sf.decisionCriteria.length > 0) {
        const criteriaItems = sf.decisionCriteria.map((c: string | { name?: string; criterion?: string; weight?: number; description?: string }) =>
          typeof c === 'string' ? c : `${c.name || c.criterion}${c.weight ? ` (${c.weight}%)` : ''}: ${c.description || ''}`
        );
        addBulletSlide('Decision Criteria', criteriaItems);
      }

      // Governance Requirements
      if (sf.governanceRequirements) {
        if (typeof sf.governanceRequirements === 'string') {
          addHighlightSlide('Governance Requirements', sf.governanceRequirements);
        } else if (Array.isArray(sf.governanceRequirements)) {
          addBulletSlide('Governance Requirements', sf.governanceRequirements.map((g: string | { requirement?: string }) =>
            typeof g === 'string' ? g : g.requirement || JSON.stringify(g)
          ));
        }
      }

      // Risk Mitigation
      if (sf.riskMitigation) {
        if (typeof sf.riskMitigation === 'string') {
          addHighlightSlide('Risk Mitigation', sf.riskMitigation);
        } else if (Array.isArray(sf.riskMitigation)) {
          addBulletSlide('Risk Mitigation', sf.riskMitigation.map((r: string | { strategy?: string; mitigation?: string }) =>
            typeof r === 'string' ? r : r.strategy || r.mitigation || JSON.stringify(r)
          ));
        }
      }

      // Compliance
      if (sf.complianceConsiderations) {
        if (typeof sf.complianceConsiderations === 'string') {
          addHighlightSlide('Compliance Considerations', sf.complianceConsiderations);
        } else if (Array.isArray(sf.complianceConsiderations)) {
          addBulletSlide('Compliance Considerations', sf.complianceConsiderations.map((c: string | { consideration?: string }) =>
            typeof c === 'string' ? c : c.consideration || JSON.stringify(c)
          ));
        }
      }
    }

    const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    return buffer;
  }
}

export const documentExportService = new DocumentExportService();
