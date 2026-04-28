/**
 * Portfolio Module — StoragePaymentRepository
 * Wraps IStorage payment methods behind the PaymentRepository port.
 */
import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { PaymentRepository } from "../domain/ports";

export class StoragePaymentRepository implements PaymentRepository {
  constructor(private storage: IPortfolioStoragePort) {}
  getByProject(projectId: string) { return this.storage.getProjectPayments(projectId); }
  create(data: Record<string, unknown>) { return this.storage.createProcurementPayment(data as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
  update(id: string, data: Record<string, unknown>) { return this.storage.updateProcurementPayment(id, data as any) as any; } // eslint-disable-line @typescript-eslint/no-explicit-any
  delete(id: string) { return this.storage.deleteProcurementPayment(id); }
}
