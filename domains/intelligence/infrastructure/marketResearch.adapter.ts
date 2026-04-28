/**
 * Intelligence — Market Research Service adapter
 */
import type { MarketResearchPort } from "../domain/ports";
import {
  marketResearchService,
  type MarketResearchRequest,
} from "./marketResearchService";

export class LegacyMarketResearchService implements MarketResearchPort {
  private get svc() {
    return marketResearchService;
  }

  async generateMarketResearch(request: Record<string, unknown>) {
    return this.svc.generateMarketResearch(request as unknown as MarketResearchRequest);
  }
}
