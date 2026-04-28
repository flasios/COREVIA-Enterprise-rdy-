/**
 * Portfolio Module — Reporting Exporter Adapter
 *
 * Wraps the portfolio-owned reporting export service so routes
 * stay behind the module port.
 */
import type { ReportingExporterPort, ReportingExportOptions } from "../domain/ports";
import { generateReportingExport, type ReportingExportOptions as ServiceExportOptions } from "./reportingExportService";

export class LegacyReportingExporter implements ReportingExporterPort {
  generate(options: ReportingExportOptions) {
    return generateReportingExport(options as unknown as ServiceExportOptions);
  }
}
