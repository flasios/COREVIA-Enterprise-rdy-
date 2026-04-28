import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { IDemandStoragePort } from '@interfaces/storage/ports/demand.port';
import type { IVersioningStoragePort } from '@interfaces/storage/ports/versioning.port';
import type { ReportVersion, DemandReport } from "@shared/schema";
import { format } from "date-fns";

// UAE Government branding colors
const COLORS = {
  primary: "#0055A5", // UAE Blue
  secondary: "#71787E", // Gray
  accent: "#C9A961", // Gold
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
  background: "#F9FAFB"
};

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
  draft: COLORS.textLight,
  under_review: COLORS.warning,
  approved: COLORS.primary,
  published: COLORS.success,
  rejected: COLORS.danger,
  archived: COLORS.secondary,
  superseded: COLORS.secondary
};


interface PDFExportOptions {
  storage: Pick<IDemandStoragePort, "getDemandReport"> & Pick<IVersioningStoragePort, "getReportVersions">;
  reportId: string;
  versionId?: string;
  compareVersionId?: string;
  type: "full_history" | "single_version" | "comparison";
}

/**
 * Professional PDF Export Service for Business Case Versions
 * Government-grade formatting with UAE branding
 */
export class PDFExportService {
  private doc: jsPDF;
  private pageNumber: number = 0;
  private readonly marginLeft = 20;
  private readonly marginRight = 20;
  private readonly marginTop = 20;
  private readonly marginBottom = 25;
  private readonly pageWidth: number;
  private readonly pageHeight: number;

  constructor() {
    this.doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  /**
   * Main export method
   */
  async exportPDF(options: PDFExportOptions): Promise<Buffer> {
    const { storage, reportId, versionId, compareVersionId, type } = options;

    // Fetch report and versions
    const report = await storage.getDemandReport(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const versions = await storage.getReportVersions(reportId);
    if (!versions || versions.length === 0) {
      throw new Error("No versions found for this report");
    }

    // Generate PDF based on type
    switch (type) {
      case "full_history": {
        await this.generateFullHistoryPDF(report, versions);
        break;
      }
      case "single_version": {
        if (!versionId) throw new Error("Version ID required for single version export");
        const version = versions.find(v => v.id === versionId);
        if (!version) throw new Error("Version not found");
        await this.generateSingleVersionPDF(report, version);
        break;
      }
      case "comparison": {
        if (!versionId || !compareVersionId) {
          throw new Error("Two version IDs required for comparison");
        }
        const v1 = versions.find(v => v.id === versionId);
        const v2 = versions.find(v => v.id === compareVersionId);
        if (!v1 || !v2) throw new Error("One or both versions not found");
        await this.generateComparisonPDF(report, v1, v2);
        break;
      }
    }

    // Return PDF as buffer
    const pdfBuffer = Buffer.from(this.doc.output("arraybuffer"));
    return pdfBuffer;
  }

  /**
   * Generate Full Version History PDF
   */
  private async generateFullHistoryPDF(report: DemandReport, versions: ReportVersion[]): Promise<void> {
    // Sort versions by date (newest first)
    const sortedVersions = [...versions].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const latestVersion = sortedVersions[0];
    const isPublished = latestVersion?.status === "published";

    // Cover Page
    this.addCoverPage(report, sortedVersions, isPublished);

    // Executive Summary
    this.addExecutiveSummary(report, sortedVersions);

    // Version Timeline
    this.addVersionTimeline(sortedVersions);

    // Detailed Version Information
    for (const version of sortedVersions) {
      this.addVersionDetails(version);
    }

    // Audit Trail
    this.addAuditTrail(sortedVersions);
  }

  /**
   * Generate Single Version PDF
   */
  private async generateSingleVersionPDF(
    report: DemandReport,
    version: ReportVersion
  ): Promise<void> {
    const isPublished = version.status === "published";

    // Cover Page
    this.addCoverPage(report, [version], isPublished);

    // Version Details
    this.addVersionDetails(version);

    // Version Data Content
    this.addVersionDataContent(version);

    // Audit Information
    this.addSingleVersionAudit(version);
  }

  /**
   * Generate Version Comparison PDF
   */
  private async generateComparisonPDF(
    report: DemandReport,
    version1: ReportVersion,
    version2: ReportVersion
  ): Promise<void> {
    // Cover Page for Comparison
    this.addComparisonCoverPage(report, version1, version2);

    // Side-by-Side Comparison
    this.addVersionComparison(version1, version2);

    // Change Analysis
    this.addChangeAnalysis(version1, version2);

    // Impact Assessment
    this.addImpactAssessment(version1, version2);
  }

  /**
   * Cover Page
   */
  private addCoverPage(report: DemandReport, versions: ReportVersion[], isPublished: boolean): void {
    this.addPage();

    const centerX = this.pageWidth / 2;
    let yPos = 60;

    // Title
    this.doc.setFontSize(28);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.primary);
    this.doc.text("Business Case Report", centerX, yPos, { align: "center" });

    // Subtitle
    yPos += 15;
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Version History Document", centerX, yPos, { align: "center" });

    // Watermark for published documents
    if (isPublished) {
      yPos += 20;
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(COLORS.accent);
      this.doc.text("OFFICIAL DOCUMENT", centerX, yPos, { align: "center" });
    }

    // Organization
    yPos += 30;
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Organization:", centerX, yPos, { align: "center" });

    yPos += 8;
    this.doc.setFont("helvetica", "normal");
    this.doc.text(report.organizationName, centerX, yPos, { align: "center" });

    // Department
    if (report.department) {
      yPos += 10;
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Department:", centerX, yPos, { align: "center" });

      yPos += 8;
      this.doc.setFont("helvetica", "normal");
      this.doc.text(report.department, centerX, yPos, { align: "center" });
    }

    // Version Range
    yPos += 15;
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Version Range:", centerX, yPos, { align: "center" });

    yPos += 8;
    this.doc.setFont("helvetica", "normal");
    const versionRange = versions.length === 1
      ? versions[0]!.versionNumber
      : `${versions[versions.length - 1]!.versionNumber} - ${versions[0]!.versionNumber}`;
    this.doc.text(versionRange, centerX, yPos, { align: "center" });

    // Generated Date
    yPos += 15;
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Generated Date:", centerX, yPos, { align: "center" });

    yPos += 8;
    this.doc.setFont("helvetica", "normal");
    this.doc.text(format(new Date(), "PPP"), centerX, yPos, { align: "center" });

    // Footer line
    yPos = this.pageHeight - 40;
    this.doc.setDrawColor(COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.marginLeft, yPos, this.pageWidth - this.marginRight, yPos);
  }

  /**
   * Executive Summary Page
   */
  private addExecutiveSummary(report: DemandReport, versions: ReportVersion[]): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Executive Summary", yPos);
    yPos += 15;

    // Statistics
    const stats = this.calculateVersionStats(versions);

    const statsData = [
      ["Total Versions", stats.totalVersions.toString()],
      ["Draft Versions", stats.draftCount.toString()],
      ["Under Review", stats.underReviewCount.toString()],
      ["Approved Versions", stats.approvedCount.toString()],
      ["Published Versions", stats.publishedCount.toString()],
      ["Latest Version", stats.latestVersion],
      ["Latest Status", this.formatStatus(stats.latestStatus)],
      ["First Created", format(new Date(stats.firstCreated), "PPP")],
      ["Last Updated", format(new Date(stats.lastUpdated), "PPP")]
    ];

    autoTable(this.doc, {
      startY: yPos,
      head: [["Metric", "Value"]],
      body: statsData,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 11
      },
      bodyStyles: {
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: COLORS.background
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });

    yPos = this.getLastAutoTableFinalY(yPos) + 15;

    // Key Changes Summary
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Key Changes Overview", this.marginLeft, yPos);
    yPos += 8;

    const recentChanges = versions.slice(0, 5).map(v => ({
      version: v.versionNumber,
      date: format(new Date(v.createdAt), "PP"),
      summary: this.truncateText(v.changesSummary, 100)
    }));

    autoTable(this.doc, {
      startY: yPos,
      head: [["Version", "Date", "Summary"]],
      body: recentChanges.map(c => [c.version, c.date, c.summary]),
      theme: "grid",
      headStyles: {
        fillColor: COLORS.secondary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });
  }

  /**
   * Version Timeline
   */
  private addVersionTimeline(versions: ReportVersion[]): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Version Timeline", yPos);
    yPos += 15;

    const timelineData = versions.map(v => [
      v.versionNumber,
      format(new Date(v.createdAt), "PP p"),
      this.formatStatus(v.status),
      v.createdByName,
      this.truncateText(v.changesSummary, 60)
    ]);

    autoTable(this.doc, {
      startY: yPos,
      head: [["Version", "Created", "Status", "Author", "Changes"]],
      body: timelineData,
      theme: "striped",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight },
      didDrawPage: () => {
        this.addHeaderFooter();
      }
    });
  }

  /**
   * Detailed Version Information
   */
  private addVersionDetails(version: ReportVersion): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Version Header
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.primary);
    this.doc.text(`Version ${version.versionNumber}`, this.marginLeft, yPos);

    yPos += 10;

    // Status Badge
    const statusColor = STATUS_COLORS[version.status] || COLORS.textLight;
    this.doc.setFillColor(statusColor);
    this.doc.setDrawColor(statusColor);
    this.doc.roundedRect(this.marginLeft, yPos - 4, 30, 6, 2, 2, "F");
    this.doc.setFontSize(9);
    this.doc.setTextColor("#FFFFFF");
    this.doc.text(this.formatStatus(version.status), this.marginLeft + 15, yPos, { align: "center" });

    yPos += 12;

    // Version Metadata
    const metadata = [
      ["Created By", version.createdByName],
      ["Role", version.createdByRole || "N/A"],
      ["Department", version.createdByDepartment || "N/A"],
      ["Created At", format(new Date(version.createdAt), "PPP p")],
      ["Version Type", this.formatVersionType(version.versionType || "business_case")]
    ];

    if (version.approvedBy) {
      metadata.push(
        ["Approved By", version.approvedByName || version.approvedBy],
        ["Approved At", version.approvedAt ? format(new Date(version.approvedAt), "PPP p") : "N/A"]
      );
    }

    if (version.publishedBy) {
      metadata.push(
        ["Published By", version.publishedByName || version.publishedBy],
        ["Published At", version.publishedAt ? format(new Date(version.publishedAt), "PPP p") : "N/A"]
      );
    }

    autoTable(this.doc, {
      startY: yPos,
      body: metadata,
      theme: "plain",
      bodyStyles: {
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold", textColor: COLORS.textLight },
        1: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });

    yPos = this.getLastAutoTableFinalY(yPos) + 10;

    // Changes Summary
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Changes Summary", this.marginLeft, yPos);
    yPos += 7;

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(COLORS.text);
    const summaryLines = this.doc.splitTextToSize(version.changesSummary, this.pageWidth - this.marginLeft - this.marginRight);
    this.doc.text(summaryLines, this.marginLeft, yPos);
    yPos += summaryLines.length * 5 + 10;

    // Edit Reason (if exists)
    if (version.editReason) {
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Edit Reason", this.marginLeft, yPos);
      yPos += 7;

      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "normal");
      const reasonLines = this.doc.splitTextToSize(version.editReason, this.pageWidth - this.marginLeft - this.marginRight);
      this.doc.text(reasonLines, this.marginLeft, yPos);
    }
  }

  /**
   * Version Data Content (for single version export)
   */
  private addVersionDataContent(version: ReportVersion): void {
    if (!version.versionData || typeof version.versionData !== 'object') {
      return;
    }

    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Version Content", yPos);
    yPos += 15;

    const data = version.versionData as Record<string, unknown>;

    // Business Case Content
    if (data.businessObjective) {
      this.addContentSection("Business Objective", String(data.businessObjective), yPos);
      yPos = this.getCurrentY() + 10;
    }

    if (data.expectedOutcomes) {
      this.addContentSection("Expected Outcomes", String(data.expectedOutcomes), yPos);
      yPos = this.getCurrentY() + 10;
    }

    if (data.successCriteria) {
      this.addContentSection("Success Criteria", String(data.successCriteria), yPos);
      yPos = this.getCurrentY() + 10;
    }

    // Recommendations
    if (data.recommendations) {
      const recommendations = data.recommendations as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const recText = typeof recommendations === 'string'
        ? recommendations
        : recommendations?.primaryRecommendation || recommendations?.summary || '';

      if (recText) {
        this.addContentSection("Recommendations", recText, yPos);
      }
    }
  }

  /**
   * Audit Trail for all versions
   */
  private addAuditTrail(versions: ReportVersion[]): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Audit Trail", yPos);
    yPos += 15;

    const auditData = versions.flatMap(v => {
      const entries: Array<Array<string | number>> = [];

      entries.push([
        v.versionNumber,
        "Created",
        v.createdByName,
        v.createdByRole || "N/A",
        format(new Date(v.createdAt), "PP p")
      ]);

      if (v.approvedBy) {
        entries.push([
          v.versionNumber,
          "Approved",
          v.approvedByName || v.approvedBy,
          "Approver",
          v.approvedAt ? format(new Date(v.approvedAt), "PP p") : "N/A"
        ]);
      }

      if (v.publishedBy) {
        entries.push([
          v.versionNumber,
          "Published",
          v.publishedByName || v.publishedBy,
          "Publisher",
          v.publishedAt ? format(new Date(v.publishedAt), "PP p") : "N/A"
        ]);
      }

      if (v.rejectedBy) {
        entries.push([
          v.versionNumber,
          "Rejected",
          v.rejectedByName || v.rejectedBy,
          "Reviewer",
          v.rejectedAt ? format(new Date(v.rejectedAt), "PP p") : "N/A"
        ]);
      }

      return entries;
    });

    autoTable(this.doc, {
      startY: yPos,
      head: [["Version", "Action", "User", "Role", "Timestamp"]],
      body: auditData,
      theme: "striped",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight },
      didDrawPage: () => {
        this.addHeaderFooter();
      }
    });
  }

  /**
   * Single Version Audit
   */
  private addSingleVersionAudit(version: ReportVersion): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Audit Information", yPos);
    yPos += 15;

    const auditEntries: Array<[string, string, string]> = [];

    auditEntries.push(["Version Created", version.createdByName, format(new Date(version.createdAt), "PPP p")]);

    if (version.reviewedBy) {
      auditEntries.push([
        "Reviewed",
        version.reviewedByName || version.reviewedBy,
        version.reviewedAt ? format(new Date(version.reviewedAt), "PPP p") : "N/A"
      ]);
    }

    if (version.approvedBy) {
      auditEntries.push([
        "Approved",
        version.approvedByName || version.approvedBy,
        version.approvedAt ? format(new Date(version.approvedAt), "PPP p") : "N/A"
      ]);
    }

    if (version.publishedBy) {
      auditEntries.push([
        "Published",
        version.publishedByName || version.publishedBy,
        version.publishedAt ? format(new Date(version.publishedAt), "PPP p") : "N/A"
      ]);
    }

    if (version.rejectedBy) {
      auditEntries.push([
        "Rejected",
        version.rejectedByName || version.rejectedBy,
        version.rejectedAt ? format(new Date(version.rejectedAt), "PPP p") : "N/A"
      ]);
    }

    autoTable(this.doc, {
      startY: yPos,
      head: [["Action", "User", "Timestamp"]],
      body: auditEntries,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold" },
        1: { cellWidth: 60 },
        2: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });
  }

  /**
   * Comparison Cover Page
   */
  private addComparisonCoverPage(report: DemandReport, v1: ReportVersion, v2: ReportVersion): void {
    this.addPage();

    const centerX = this.pageWidth / 2;
    let yPos = 60;

    // Title
    this.doc.setFontSize(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.primary);
    this.doc.text("Version Comparison Report", centerX, yPos, { align: "center" });

    // Organization
    yPos += 25;
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Organization:", centerX, yPos, { align: "center" });

    yPos += 8;
    this.doc.setFont("helvetica", "normal");
    this.doc.text(report.organizationName, centerX, yPos, { align: "center" });

    // Versions Being Compared
    yPos += 20;
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Comparing Versions:", centerX, yPos, { align: "center" });

    yPos += 10;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(16);
    this.doc.text(`${v1.versionNumber}  vs  ${v2.versionNumber}`, centerX, yPos, { align: "center" });

    // Date Range
    yPos += 15;
    this.doc.setFontSize(12);
    this.doc.setTextColor(COLORS.textLight);
    const date1 = format(new Date(v1.createdAt), "PP");
    const date2 = format(new Date(v2.createdAt), "PP");
    this.doc.text(`${date1}  →  ${date2}`, centerX, yPos, { align: "center" });

    // Generated Date
    yPos += 25;
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Generated:", centerX, yPos, { align: "center" });

    yPos += 8;
    this.doc.setFont("helvetica", "normal");
    this.doc.text(format(new Date(), "PPP"), centerX, yPos, { align: "center" });
  }

  /**
   * Version Comparison Side-by-Side
   */
  private addVersionComparison(v1: ReportVersion, v2: ReportVersion): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Version Comparison", yPos);
    yPos += 15;

    const comparisonData = [
      ["Version Number", v1.versionNumber, v2.versionNumber],
      ["Status", this.formatStatus(v1.status), this.formatStatus(v2.status)],
      ["Created By", v1.createdByName, v2.createdByName],
      ["Created At", format(new Date(v1.createdAt), "PP p"), format(new Date(v2.createdAt), "PP p")],
      ["Version Type", this.formatVersionType(v1.versionType || "business_case"), this.formatVersionType(v2.versionType || "business_case")]
    ];

    if (v1.approvedBy || v2.approvedBy) {
      comparisonData.push([
        "Approved By",
        v1.approvedByName || "N/A",
        v2.approvedByName || "N/A"
      ]);
    }

    autoTable(this.doc, {
      startY: yPos,
      head: [["Attribute", v1.versionNumber, v2.versionNumber]],
      body: comparisonData,
      theme: "grid",
      headStyles: {
        fillColor: COLORS.primary,
        textColor: "#FFFFFF",
        fontStyle: "bold",
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: "bold", fillColor: COLORS.background },
        1: { cellWidth: "auto" },
        2: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });
  }

  /**
   * Change Analysis
   */
  private addChangeAnalysis(v1: ReportVersion, v2: ReportVersion): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Change Analysis", yPos);
    yPos += 15;

    // Changes Summary Comparison
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text(`${v1.versionNumber} Changes:`, this.marginLeft, yPos);
    yPos += 7;

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    const lines1 = this.doc.splitTextToSize(v1.changesSummary, this.pageWidth - this.marginLeft - this.marginRight);
    this.doc.text(lines1, this.marginLeft, yPos);
    yPos += lines1.length * 5 + 10;

    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(`${v2.versionNumber} Changes:`, this.marginLeft, yPos);
    yPos += 7;

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    const lines2 = this.doc.splitTextToSize(v2.changesSummary, this.pageWidth - this.marginLeft - this.marginRight);
    this.doc.text(lines2, this.marginLeft, yPos);
    yPos += lines2.length * 5 + 15;

    // Detailed Changes (if available)
    if (v2.changesDetails) {
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(COLORS.primary);
      this.doc.text("Detailed Changes", this.marginLeft, yPos);
      yPos += 10;

      const changes = Array.isArray(v2.changesDetails) ? v2.changesDetails : [];
      if (changes.length > 0) {
        const changesData = changes.slice(0, 10).map((change): [string, string, string] => {
          const changeRecord = this.asRecord(change);
          const field = changeRecord.field ?? "Unknown";
          const oldValue = changeRecord.oldValue ?? "N/A";
          const newValue = changeRecord.newValue ?? "N/A";

          return [
            this.truncateText(String(field), 40),
            this.truncateText(String(oldValue), 40),
            this.truncateText(String(newValue), 40)
          ];
        });

        autoTable(this.doc, {
          startY: yPos,
          head: [["Field", "Before", "After"]],
          body: changesData,
          theme: "striped",
          headStyles: {
            fillColor: COLORS.secondary,
            textColor: "#FFFFFF",
            fontStyle: "bold",
            fontSize: 10
          },
          bodyStyles: {
            fontSize: 9
          },
          margin: { left: this.marginLeft, right: this.marginRight }
        });
      }
    }
  }

  /**
   * Impact Assessment
   */
  private addImpactAssessment(v1: ReportVersion, v2: ReportVersion): void {
    this.addPage();

    let yPos = this.marginTop + 10;

    // Section Title
    this.addSectionTitle("Impact Assessment", yPos);
    yPos += 15;

    // Time elapsed
    const timeElapsed = new Date(v2.createdAt).getTime() - new Date(v1.createdAt).getTime();
    const daysElapsed = Math.floor(timeElapsed / (1000 * 60 * 60 * 24));

    const impactData = [
      ["Time Between Versions", `${daysElapsed} days`],
      ["Status Change", `${this.formatStatus(v1.status)} → ${this.formatStatus(v2.status)}`],
      ["Version Type", this.formatVersionType(v2.versionType || "business_case")],
      ["Modified By", v2.createdByName]
    ];

    autoTable(this.doc, {
      startY: yPos,
      body: impactData,
      theme: "plain",
      bodyStyles: {
        fontSize: 10
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: "bold", textColor: COLORS.textLight },
        1: { cellWidth: "auto" }
      },
      margin: { left: this.marginLeft, right: this.marginRight }
    });

    yPos = this.getLastAutoTableFinalY(yPos) + 15;

    // Recommendation
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text("Assessment:", this.marginLeft, yPos);
    yPos += 7;

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    const assessment = this.generateImpactAssessment(v1, v2, daysElapsed);
    const assessmentLines = this.doc.splitTextToSize(assessment, this.pageWidth - this.marginLeft - this.marginRight);
    this.doc.text(assessmentLines, this.marginLeft, yPos);
  }

  /**
   * Helper Methods
   */

  private addPage(): void {
    if (this.pageNumber > 0) {
      this.doc.addPage();
    }
    this.pageNumber++;
    this.addHeaderFooter();
  }

  private addHeaderFooter(): void {
    // Header
    this.doc.setDrawColor(COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.marginLeft, 15, this.pageWidth - this.marginRight, 15);

    // Footer
    const footerY = this.pageHeight - 15;
    this.doc.setDrawColor(COLORS.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.marginLeft, footerY, this.pageWidth - this.marginRight, footerY);

    // Page Number
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(COLORS.textLight);
    this.doc.text(
      `Page ${this.pageNumber}`,
      this.pageWidth / 2,
      this.pageHeight - 10,
      { align: "center" }
    );

    // Generated Date (footer left)
    this.doc.text(
      `Generated: ${format(new Date(), "PP")}`,
      this.marginLeft,
      this.pageHeight - 10
    );
  }

  private addSectionTitle(title: string, yPos: number): void {
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.primary);
    this.doc.text(title, this.marginLeft, yPos);

    // Underline
    const textWidth = this.doc.getTextWidth(title);
    this.doc.setDrawColor(COLORS.primary);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.marginLeft, yPos + 2, this.marginLeft + textWidth, yPos + 2);
  }

  private addContentSection(title: string, content: string, yPos: number): void {
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(COLORS.text);
    this.doc.text(title, this.marginLeft, yPos);
    yPos += 6;

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    const contentLines = this.doc.splitTextToSize(content, this.pageWidth - this.marginLeft - this.marginRight);
    this.doc.text(contentLines, this.marginLeft, yPos);
  }

  private getLastAutoTableFinalY(fallback: number): number {
    const docWithTable = this.doc as jsPDF & { lastAutoTable?: { finalY?: number } };
    return docWithTable.lastAutoTable?.finalY ?? fallback;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === "object" && value !== null) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private getCurrentY(): number {
    return this.getLastAutoTableFinalY(this.marginTop);
  }

  private formatStatus(status: string): string {
    return status
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private formatVersionType(type: string): string {
    return type
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  }

  private calculateVersionStats(versions: ReportVersion[]) {
    const sortedVersions = [...versions].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const latest = sortedVersions[sortedVersions.length - 1]!;

    return {
      totalVersions: versions.length,
      draftCount: versions.filter(v => v.status === "draft").length,
      underReviewCount: versions.filter(v => v.status === "under_review").length,
      approvedCount: versions.filter(v => v.status === "approved").length,
      publishedCount: versions.filter(v => v.status === "published").length,
      latestVersion: latest.versionNumber,
      latestStatus: latest.status,
      firstCreated: sortedVersions[0]!.createdAt,
      lastUpdated: latest.createdAt
    };
  }

  private generateImpactAssessment(v1: ReportVersion, v2: ReportVersion, daysElapsed: number): string {
    const assessments: string[] = [];

    if (v1.status !== v2.status) {
      assessments.push(`Status changed from ${this.formatStatus(v1.status)} to ${this.formatStatus(v2.status)}.`);
    }

    if (daysElapsed === 0) {
      assessments.push("Versions created on the same day, indicating rapid iteration.");
    } else if (daysElapsed < 7) {
      assessments.push(`${daysElapsed} days between versions suggests active development.`);
    } else {
      assessments.push(`${daysElapsed} days between versions indicates measured review process.`);
    }

    if (v2.status === "published") {
      assessments.push("Latest version is published and represents the official document.");
    }

    return assessments.join(" ");
  }
}

/**
 * Export function for easy use in routes
 */
export async function generateVersionPDF(options: PDFExportOptions): Promise<Buffer> {
  const service = new PDFExportService();
  return await service.exportPDF(options);
}
