/**
 * Portfolio Module — StorageRiskRepository
 * Wraps IStorage risk methods behind the RiskRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { RiskRepository } from "../domain/ports";

export class StorageRiskRepository implements RiskRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectRisks(projectId); }
  getById(id: string) { return this.storage.getProjectRisk(id); }
  create(data: Record<string, unknown>) { return this.storage.createProjectRisk(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProjectRisk(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProjectRisk(id); }
  createEvidence(data: Record<string, unknown>) { return this.storage.createRiskEvidence(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  getEvidence(riskId: string) { return this.storage.getRiskEvidence(riskId); }
  getEvidenceById(id: string) { return this.storage.getRiskEvidenceById(id); }
  updateEvidence(id: string, data: Record<string, unknown>) { return this.storage.updateRiskEvidence(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  deleteEvidence(id: string) { return this.storage.deleteRiskEvidence(id); }
}
