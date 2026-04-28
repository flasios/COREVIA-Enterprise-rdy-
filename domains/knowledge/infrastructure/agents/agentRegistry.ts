import type { IStorage } from '@interfaces/storage';
import type { IRAGAgent } from './baseAgent';
import { FinanceAgent } from './financeAgent';
import { SecurityAgent } from './securityAgent';
import { TechnicalAgent } from './technicalAgent';
import { BusinessAgent } from './businessAgent';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '@platform/logging/Logger';

const log = logger.service('AgentRegistry');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AgentRegistry {
  private agents: Map<string, IRAGAgent> = new Map();
  
  constructor(storage: IStorage) {
    // Load prompt templates
    const promptsDir = path.join(__dirname, '../prompts');
    
    const financePrompt = this.loadPrompt(promptsDir, 'finance.md');
    const securityPrompt = this.loadPrompt(promptsDir, 'security.md');
    const technicalPrompt = this.loadPrompt(promptsDir, 'technical.md');
    const businessPrompt = this.loadPrompt(promptsDir, 'business.md');
    
    // Register agents
    this.agents.set('finance', new FinanceAgent(storage, financePrompt));
    this.agents.set('security', new SecurityAgent(storage, securityPrompt));
    this.agents.set('technical', new TechnicalAgent(storage, technicalPrompt));
    this.agents.set('business', new BusinessAgent(storage, businessPrompt));
  }
  
  getAgent(domain: string): IRAGAgent | undefined {
    return this.agents.get(domain);
  }
  
  getAllAgents(): IRAGAgent[] {
    return Array.from(this.agents.values());
  }
  
  getSupportedDomains(): string[] {
    return Array.from(this.agents.keys());
  }
  
  private loadPrompt(promptsDir: string, filename: string): string {
    try {
      const fullPath = path.join(promptsDir, filename);
      return fs.readFileSync(fullPath, 'utf-8');
    } catch (error) {
      log.error('Failed to load prompt template', error instanceof Error ? error : undefined, { filename });
      return 'You are a helpful AI assistant specialized in government procurement.';
    }
  }
}

// Singleton instance
let registryInstance: AgentRegistry | null = null;

export function getAgentRegistry(storage: IStorage): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry(storage);
  }
  return registryInstance;
}
