import { AIConfidenceBadge, AICitationsList } from '@/components/shared/ai';
import type { AIConfidence, AICitation } from '@shared/aiAdapters';

interface DetailedRequirementsAiMetadataProps {
  generatedConfidence: AIConfidence | null;
  generatedCitations: AICitation[] | null;
}

export function DetailedRequirementsAiMetadata({
  generatedConfidence,
  generatedCitations,
}: DetailedRequirementsAiMetadataProps) {
  if (!generatedConfidence && (!generatedCitations || generatedCitations.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      {generatedConfidence && (
        <div className="flex justify-end">
          <AIConfidenceBadge
            confidence={generatedConfidence}
            data-testid="badge-requirements-confidence"
          />
        </div>
      )}
      {generatedCitations && generatedCitations.length > 0 && (
        <AICitationsList
          citations={generatedCitations}
          data-testid="list-requirements-citations"
        />
      )}
    </div>
  );
}