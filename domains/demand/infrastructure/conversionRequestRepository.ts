import type { IDemandStoragePort } from "@interfaces/storage/ports";
import type {
  ConversionRequestRepository,
  DemandConversionRequest,
  CreateConversionData,
  SubmitConversionData,
} from "../domain";

/**
 * Adapts the legacy IStorage interface to the ConversionRequestRepository port.
 */
export class StorageConversionRequestRepository implements ConversionRequestRepository {
  constructor(private readonly storage: IDemandStoragePort) {}

  async findById(id: string): Promise<DemandConversionRequest | undefined> {
    const req = await this.storage.getDemandConversionRequest(id);
    return req ? (req as unknown as DemandConversionRequest) : undefined;
  }

  async findByDemandId(demandId: string): Promise<DemandConversionRequest | undefined> {
    const req = await this.storage.getDemandConversionRequestByDemandId(demandId);
    return req ? (req as unknown as DemandConversionRequest) : undefined;
  }

  async findAll(): Promise<DemandConversionRequest[]> {
    const reqs = await this.storage.getAllDemandConversionRequests();
    return reqs as unknown as DemandConversionRequest[];
  }

  async findByStatus(status: string): Promise<DemandConversionRequest[]> {
    const reqs = await this.storage.getDemandConversionRequestsByStatus(status);
    return reqs as unknown as DemandConversionRequest[];
  }

  async create(data: CreateConversionData): Promise<DemandConversionRequest> {
    const req = await this.storage.createDemandConversionRequest({
      demandId: data.demandId,
      requestedBy: data.requestedBy,
      notes: data.notes,
      status: "pending",
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return req as unknown as DemandConversionRequest;
  }

  async createFull(data: SubmitConversionData): Promise<DemandConversionRequest> {
    const req = await this.storage.createDemandConversionRequest(data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return req as unknown as DemandConversionRequest;
  }

  async update(id: string, data: Partial<DemandConversionRequest>): Promise<DemandConversionRequest | undefined> {
    const req = await this.storage.updateDemandConversionRequest(id, data as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return req ? (req as unknown as DemandConversionRequest) : undefined;
  }
}
