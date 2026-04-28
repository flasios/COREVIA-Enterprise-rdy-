/**
 * Intelligence Storage Port — Orchestration, synergy, innovation, portfolio optimization, feedback, LoRA
 */
import type {
  OrchestrationRun,
  InsertOrchestrationRun,
  SynergyOpportunity,
  InsertSynergyOpportunity,
  InnovationTemplate,
  InsertInnovationTemplate,
  InnovationRecommendation,
  InsertInnovationRecommendation,
  PortfolioRun,
  InsertPortfolioRun,
  PortfolioRecommendation,
  InsertPortfolioRecommendation,
  AgentFeedback,
  InsertAgentFeedback,
  LoraGoldExample,
  InsertLoraGoldExample,
  LoraDataset,
  InsertLoraDataset,
  LoraTrainingJob,
  InsertLoraTrainingJob,
  LoraAdapter,
  InsertLoraAdapter,
} from "@shared/schema";

export interface IIntelligenceStoragePort {
  // Orchestration Run Management
  createOrchestrationRun(run: InsertOrchestrationRun): Promise<OrchestrationRun>;
  getOrchestrationRun(id: string): Promise<OrchestrationRun | undefined>;
  getOrchestrationRunsByUser(userId: string): Promise<OrchestrationRun[]>;
  getOrchestrationRunsByReport(reportId: string): Promise<OrchestrationRun[]>;

  // Synergy Opportunity Management
  createSynergyOpportunity(synergy: InsertSynergyOpportunity): Promise<SynergyOpportunity>;
  getSynergyOpportunity(id: string): Promise<SynergyOpportunity | undefined>;
  getAllSynergyOpportunities(): Promise<SynergyOpportunity[]>;
  getSynergyOpportunitiesByStatus(status: string): Promise<SynergyOpportunity[]>;
  updateSynergyOpportunity(id: string, updates: Partial<InsertSynergyOpportunity>): Promise<void>;

  // Innovation Templates Management
  getInnovationTemplates(): Promise<InnovationTemplate[]>;
  getInnovationTemplateById(id: string): Promise<InnovationTemplate | undefined>;
  searchInnovationTemplates(filters: { sector?: string; technologyTags?: string[] }): Promise<InnovationTemplate[]>;
  createInnovationTemplate(template: InsertInnovationTemplate): Promise<InnovationTemplate>;

  // Innovation Recommendations Management
  getInnovationRecommendations(demandId: string): Promise<InnovationRecommendation[]>;
  createInnovationRecommendation(recommendation: InsertInnovationRecommendation): Promise<InnovationRecommendation>;

  // Portfolio Optimization Management
  createPortfolioRun(run: InsertPortfolioRun & { triggeredBy: string }): Promise<PortfolioRun>;
  getPortfolioRuns(): Promise<PortfolioRun[]>;
  getPortfolioRunById(id: string): Promise<PortfolioRun | undefined>;
  updatePortfolioRun(id: string, updates: Partial<PortfolioRun>): Promise<PortfolioRun | undefined>;
  createPortfolioRecommendation(rec: InsertPortfolioRecommendation): Promise<PortfolioRecommendation>;
  getPortfolioRecommendations(runId: string): Promise<PortfolioRecommendation[]>;
  updatePortfolioRecommendation(id: string, updates: Partial<PortfolioRecommendation>): Promise<PortfolioRecommendation | undefined>;

  // Agent Feedback Management
  createAgentFeedback(feedback: InsertAgentFeedback): Promise<AgentFeedback>;
  getAgentFeedback(id: string): Promise<AgentFeedback | undefined>;
  getAgentFeedbackByDomain(domain: string): Promise<AgentFeedback[]>;
  getAgentFeedbackByUser(userId: string): Promise<AgentFeedback[]>;
  getAgentFeedbackByReport(reportId: string): Promise<AgentFeedback[]>;

  // LoRA Fine-Tuning System — Gold Examples
  createLoraGoldExample(example: InsertLoraGoldExample): Promise<LoraGoldExample>;
  getLoraGoldExample(id: string): Promise<LoraGoldExample | undefined>;
  getLoraGoldExamplesBySectionType(sectionType: string): Promise<LoraGoldExample[]>;
  getLoraGoldExamplesByDataset(datasetId: string): Promise<LoraGoldExample[]>;
  getLoraGoldExamplesAboveQuality(minQuality: number): Promise<LoraGoldExample[]>;
  updateLoraGoldExample(id: string, updates: Partial<InsertLoraGoldExample>): Promise<LoraGoldExample | undefined>;
  deleteLoraGoldExample(id: string): Promise<boolean>;

  // Datasets
  createLoraDataset(dataset: InsertLoraDataset): Promise<LoraDataset>;
  getLoraDataset(id: string): Promise<LoraDataset | undefined>;
  getAllLoraDatasets(): Promise<LoraDataset[]>;
  getLoraDatasetsByStatus(status: string): Promise<LoraDataset[]>;
  updateLoraDataset(id: string, updates: Partial<InsertLoraDataset>): Promise<LoraDataset | undefined>;
  deleteLoraDataset(id: string): Promise<boolean>;

  // Training Jobs
  createLoraTrainingJob(job: InsertLoraTrainingJob): Promise<LoraTrainingJob>;
  getLoraTrainingJob(id: string): Promise<LoraTrainingJob | undefined>;
  getLoraTrainingJobsByStatus(status: string): Promise<LoraTrainingJob[]>;
  getLoraTrainingJobsByDataset(datasetId: string): Promise<LoraTrainingJob[]>;
  updateLoraTrainingJob(id: string, updates: Partial<InsertLoraTrainingJob>): Promise<LoraTrainingJob | undefined>;

  // Adapters
  createLoraAdapter(adapter: InsertLoraAdapter): Promise<LoraAdapter>;
  getLoraAdapter(id: string): Promise<LoraAdapter | undefined>;
  getLoraAdaptersByModel(baseModel: string): Promise<LoraAdapter[]>;
  getActiveLoraAdapters(): Promise<LoraAdapter[]>;
  updateLoraAdapter(id: string, updates: Partial<InsertLoraAdapter>): Promise<LoraAdapter | undefined>;
  incrementLoraAdapterUsage(id: string): Promise<void>;
}
