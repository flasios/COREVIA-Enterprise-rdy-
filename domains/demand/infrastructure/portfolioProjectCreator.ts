import type { IPortfolioStoragePort } from "@interfaces/storage/ports";
import type { PortfolioProjectCreator } from "../domain";

/**
 * Adapts IStorage.createPortfolioProject to the PortfolioProjectCreator port.
 */
export class StoragePortfolioProjectCreator implements PortfolioProjectCreator {
  constructor(private readonly storage: IPortfolioStoragePort) {}

  async createProject(data: Record<string, unknown>): Promise<{ id: string; [key: string]: unknown }> {
    const project = await this.storage.createPortfolioProject(data as unknown as Parameters<IPortfolioStoragePort['createPortfolioProject']>[0]);
    return project as { id: string; [key: string]: unknown };
  }
}
