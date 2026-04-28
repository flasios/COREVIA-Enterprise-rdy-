/**
 * Knowledge Module — LegacyRagIntegration
 * Wraps the ragIntegration getStageSuggestions function behind the RagIntegrationPort.
 */
import type { RagIntegrationPort } from "../domain/ports";
import { getStageSuggestions } from "./ragIntegrationService";

export class LegacyRagIntegration implements RagIntegrationPort {
	async getStageSuggestions(context: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
		return (getStageSuggestions as (c: Record<string, unknown>) => Promise<unknown[]>)(context) as unknown as Array<Record<string, unknown>>;
	}
}
