/**
 * Governance Module — Infrastructure: Tender Content Generator Adapter
 */
import type { TenderContentGeneratorPort } from "../domain/ports";
import { TenderGenerator } from "./tenderGeneratorService";

export class LazyTenderGenerator implements TenderContentGeneratorPort {
  async generateTender(demand: unknown): Promise<unknown> {
    return new TenderGenerator().generateTender(demand as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}
