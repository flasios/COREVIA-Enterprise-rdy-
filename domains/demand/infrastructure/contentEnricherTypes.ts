export interface RecommendationsInput {
  title?: string;
  recommendations?: unknown;
  strategicRecommendations?: unknown;
  implementationRecommendations?: unknown;
  governanceRecommendations?: unknown;
}

export interface SmartObjective {
  objective: string;
  metric: string;
  target: string;
  timeline: string;
  owner?: string;
}