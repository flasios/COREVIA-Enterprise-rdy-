/**
 * Governance Query Port — Read-only interface for governance dashboards.
 *
 * Separates read queries for gate status, tender lists, and vendor scores
 * from the write-heavy IGovernanceStoragePort (~65 methods).
 */

export interface IGovernanceQueryPort {
  /** Gate status overview for a demand or project */
  getGateStatusSummary(params: {
    demandId?: string;
    projectId?: string;
  }): Promise<{
    totalGates: number;
    passed: number;
    pending: number;
    failed: number;
    gates: Array<{
      id: string;
      name: string;
      status: string;
      reviewedAt: Date | null;
      reviewedBy: string | null;
    }>;
  }>;

  /** Active tenders list with summary metrics */
  getTendersList(params: {
    status?: string[];
    search?: string;
    limit?: number;
    offset?: number;
    organizationId?: string;
  }): Promise<{
    items: Array<{
      id: string;
      title: string;
      status: string;
      deadline: Date | null;
      vendorCount: number;
      estimatedValue: number;
    }>;
    total: number;
  }>;

  /** Vendor evaluation scores summary */
  getVendorScoresSummary(tenderId: string): Promise<{
    tenderId: string;
    tenderTitle: string;
    vendors: Array<{
      vendorId: string;
      vendorName: string;
      overallScore: number;
      technicalScore: number;
      financialScore: number;
      complianceScore: number;
      rank: number;
    }>;
  }>;
}
