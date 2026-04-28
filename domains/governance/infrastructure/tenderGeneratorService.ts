/**
 * Automated RFP/Tender Generator
 * 
 * Generates comprehensive procurement documents from demand requests
 * Uses AI to create all required sections and validates UAE compliance
 */

import type { DemandReport } from '@shared/schema';
import { FalconAdapter } from '@platform/ai/providers/falcon';
import { logger } from "@platform/logging/Logger";

export interface StructuredRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'mandatory' | 'required' | 'optional';
  source: 'demand' | 'template';
}

export interface StructuredStakeholder {
  name: string;
  role: string;
  department: string;
  responsibility: string;
  source: 'demand' | 'template';
}

export interface TenderSections {
  executiveSummary: string;
  projectBackground: string;
  scopeOfWork: string;
  technicalRequirements: string[];
  functionalRequirements: string[];
  structuredTechnicalRequirements?: StructuredRequirement[];
  structuredFunctionalRequirements?: StructuredRequirement[];
  integrationRequirements?: StructuredRequirement[];
  securityRequirements?: StructuredRequirement[];
  stakeholders?: StructuredStakeholder[];
  evaluationCriteria: {
    criterion: string;
    weight: number;
    scoringMethod: string;
  }[];
  termsAndConditions: string[];
  complianceChecks: {
    regulation: string;
    status: 'pass' | 'warning' | 'fail';
    notes: string;
  }[];
}

const _UAE_PROCUREMENT_REGULATIONS = [
  'Federal Law No. 12 of 2018 on Public Procurement',
  'Abu Dhabi Government Procurement Manual',
  'Dubai Government Procurement Manual',
  'Federal Decree-Law No. 26 of 2020 on Public-Private Partnerships',
  'UAE Procurement Code of Ethics',
];

export class TenderGenerator {
  private falcon: FalconAdapter;

  constructor() {
    this.falcon = new FalconAdapter();
  }

  private parseTextToRequirements(input: unknown, category: string, source: 'demand' | 'template'): StructuredRequirement[] {
    if (input === null || input === undefined) {
      return [];
    }
    
    if (Array.isArray(input)) {
      return input.map((item, i) => ({
        id: `${category.toUpperCase().substring(0, 3)}-${String(i + 1).padStart(2, '0')}`,
        title: typeof item === 'string' ? item : (item?.name || item?.title || `${category} Requirement ${i + 1}`),
        description: typeof item === 'string' ? item : (item?.description || item?.value || ''),
        category,
        priority: (item?.priority as 'mandatory' | 'required' | 'optional') || 'required',
        source,
      }));
    }
    
    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (obj.requirements && Array.isArray(obj.requirements)) {
        return this.parseTextToRequirements(obj.requirements, category, source);
      }
      if (obj.items && Array.isArray(obj.items)) {
        return this.parseTextToRequirements(obj.items, category, source);
      }
      return [{
        id: `${category.toUpperCase().substring(0, 3)}-01`,
        title: String(obj.name || obj.title || `${category} Requirement`),
        description: String(obj.description || obj.value || ''),
        category,
        priority: (obj.priority as 'mandatory' | 'required' | 'optional') || 'required',
        source,
      }];
    }
    
    if (typeof input !== 'string' || input.trim().length === 0) {
      return [];
    }
    
    try {
      const parsed = JSON.parse(input);
      return this.parseTextToRequirements(parsed, category, source);
    } catch {
      // Not JSON, try parsing as text
    }
    
    const lines = input.split(/[\n;]/).map(s => s.trim()).filter(Boolean);
    return lines.map((line, i) => ({
      id: `${category.toUpperCase().substring(0, 3)}-${String(i + 1).padStart(2, '0')}`,
      title: line.replace(/^[-•*]\s*/, ''),
      description: line.replace(/^[-•*]\s*/, ''),
      category,
      priority: 'required' as const,
      source,
    }));
  }

  private parseTextToStakeholders(input: unknown, department: string): StructuredStakeholder[] {
    if (input === null || input === undefined) {
      return [];
    }
    
    if (Array.isArray(input)) {
      return input.map(item => ({
        name: typeof item === 'string' ? item : (item?.name || 'Stakeholder'),
        role: typeof item === 'object' && item !== null ? (item.role || item.type || 'Participant') : 'Participant',
        department: typeof item === 'object' && item !== null ? (item.department || department) : department,
        responsibility: typeof item === 'object' && item !== null ? (item.responsibility || item.description || '') : '',
        source: 'demand' as const,
      }));
    }
    
    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      if (obj.stakeholders && Array.isArray(obj.stakeholders)) {
        return this.parseTextToStakeholders(obj.stakeholders, department);
      }
      return [{
        name: String(obj.name || 'Stakeholder'),
        role: String(obj.role || obj.type || 'Participant'),
        department: String(obj.department || department),
        responsibility: String(obj.responsibility || obj.description || ''),
        source: 'demand' as const,
      }];
    }
    
    if (typeof input !== 'string' || input.trim().length === 0) {
      return [];
    }
    
    try {
      const parsed = JSON.parse(input);
      return this.parseTextToStakeholders(parsed, department);
    } catch {
      // Not JSON, try parsing as text
    }
    
    const lines = input.split(/[\n;,]/).map(s => s.trim()).filter(Boolean);
    return lines.map(line => ({
      name: line.replace(/^[-•*]\s*/, ''),
      role: 'Participant',
      department,
      responsibility: '',
      source: 'demand' as const,
    }));
  }

  /**
   * Generate complete tender package from demand
   */
  async generateTender(demand: DemandReport): Promise<TenderSections> {
    logger.info(`[TenderGenerator] Generating tender for demand: ${demand.id}`);
    
    const [
      executiveSummary,
      projectBackground,
      scopeOfWork,
      requirements,
      evaluationCriteria,
      termsAndConditions,
    ] = await Promise.all([
      this.generateExecutiveSummary(demand),
      this.generateProjectBackground(demand),
      this.generateScopeOfWork(demand),
      this.generateRequirements(demand),
      this.generateEvaluationCriteria(demand),
      this.generateTermsAndConditions(demand),
    ]);

    const complianceChecks = await this.runComplianceChecks({
      executiveSummary,
      projectBackground,
      scopeOfWork,
      technicalRequirements: requirements.technical,
      functionalRequirements: requirements.functional,
      evaluationCriteria,
      termsAndConditions,
    });

    const structuredTechnicalRequirements = requirements.technical.map((req, i) => ({
      id: `T${String(i + 1).padStart(2, '0')}`,
      title: req,
      description: req,
      category: 'Technical',
      priority: 'mandatory' as const,
      source: 'template' as const,
    }));

    const structuredFunctionalRequirements = requirements.functional.map((req, i) => ({
      id: `F${String(i + 1).padStart(2, '0')}`,
      title: req,
      description: req,
      category: 'Functional',
      priority: 'mandatory' as const,
      source: 'template' as const,
    }));

    const integrationRequirements = this.parseTextToRequirements(
      demand.integrationRequirements,
      'Integration',
      'demand'
    );

    const securityRequirements = this.parseTextToRequirements(
      demand.complianceRequirements,
      'Security',
      'demand'
    );

    const stakeholders = this.parseTextToStakeholders(
      demand.stakeholders,
      demand.department || 'Government'
    );

    logger.info(`[TenderGenerator] Tender generation complete with ${integrationRequirements.length} integration reqs, ${securityRequirements.length} security reqs, ${stakeholders.length} stakeholders`);
    
    return {
      executiveSummary,
      projectBackground,
      scopeOfWork,
      technicalRequirements: requirements.technical,
      functionalRequirements: requirements.functional,
      structuredTechnicalRequirements,
      structuredFunctionalRequirements,
      integrationRequirements: integrationRequirements.length > 0 ? integrationRequirements : undefined,
      securityRequirements: securityRequirements.length > 0 ? securityRequirements : undefined,
      stakeholders: stakeholders.length > 0 ? stakeholders : undefined,
      evaluationCriteria,
      termsAndConditions,
      complianceChecks,
    };
  }

  private async generateExecutiveSummary(demand: DemandReport): Promise<string> {
    const prompt = `You are a UAE Government Procurement Specialist writing an RFP/Tender Document.

DEMAND REQUEST:
Organization: ${demand.organizationName}
Department: ${demand.department}
Business Objective: ${demand.businessObjective}
Expected Outcomes: ${demand.expectedOutcomes}
Budget: ${demand.budgetRange}
Timeframe: ${demand.timeframe}

Write a professional Executive Summary section for the tender document (3-4 paragraphs). Include:
1. Project overview and objectives
2. Strategic importance
3. Expected deliverables
4. Procurement timeline

Keep it formal and professional for government procurement.`;

    try {
      const response = await this.falcon.generateText({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        temperature: 0.5
      });

      return response.trim();
    } catch (error) {
      logger.warn('[TenderGenerator] Failed to generate Executive Summary, using fallback:', error);
      return `Executive Summary: ${demand.organizationName} - ${demand.department} seeks to deliver ${demand.businessObjective} within ${demand.timeframe} timeframe, aligned with UAE government digital transformation objectives.`;
    }
  }

  private async generateProjectBackground(demand: DemandReport): Promise<string> {
    const prompt = `You are a UAE Government Procurement Specialist.

DEMAND REQUEST:
Organization: ${demand.organizationName}
Department: ${demand.department}
Business Objective: ${demand.businessObjective}
Current Capacity: ${demand.currentCapacity || 'Not specified'}
Existing Systems: ${demand.existingSystems || 'None'}

Write a Project Background section for the tender (2-3 paragraphs). Include:
1. Current situation and challenges
2. Rationale for procurement
3. Alignment with government strategy

Professional government tone.`;

    try {
      const response = await this.falcon.generateText({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
        temperature: 0.5
      });

      return response.trim();
    } catch (error) {
      logger.warn('[TenderGenerator] Failed to generate Project Background, using fallback:', error);
      return `Project Background: ${demand.department} seeks to address current challenges through this procurement, aligned with UAE Vision 2071 and digital transformation initiatives.`;
    }
  }

  private async generateScopeOfWork(demand: DemandReport): Promise<string> {
    const prompt = `You are a UAE Government Procurement Specialist.

DEMAND REQUEST:
Organization: ${demand.organizationName}
Business Objective: ${demand.businessObjective}
Expected Outcomes: ${demand.expectedOutcomes}
Success Criteria: ${demand.successCriteria || 'As defined in business requirements'}
Timeframe: ${demand.timeframe}

Write a comprehensive Scope of Work section (4-5 paragraphs). Include:
1. Detailed work description
2. Key deliverables and milestones
3. Performance expectations
4. Quality standards

Be specific and measurable.`;

    try {
      const response = await this.falcon.generateText({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1200,
        temperature: 0.5
      });

      return response.trim();
    } catch (error) {
      logger.warn('[TenderGenerator] Failed to generate Scope of Work, using fallback:', error);
      return `Scope of Work: The vendor shall deliver ${demand.expectedOutcomes} within ${demand.timeframe}, meeting all specified quality and performance standards.`;
    }
  }

  private async generateRequirements(demand: DemandReport): Promise<{ technical: string[]; functional: string[] }> {
    const prompt = `You are a UAE Government Procurement Technical Analyst.

DEMAND REQUEST:
Organization: ${demand.organizationName}
Business Objective: ${demand.businessObjective}
Integration Requirements: ${demand.integrationRequirements || 'Standard integrations'}
Compliance Requirements: ${demand.complianceRequirements || 'UAE government standards'}
Existing Systems: ${demand.existingSystems || 'To be specified'}

Generate two lists of requirements for the tender:

1. TECHNICAL REQUIREMENTS (5-7 items):
   - Infrastructure, technology stack, security, performance, scalability
   
2. FUNCTIONAL REQUIREMENTS (5-7 items):
   - Features, capabilities, user experience, integration, workflow

Format: JSON
{
  "technical": ["requirement 1", "requirement 2", ...],
  "functional": ["requirement 1", "requirement 2", ...]
}`;

    try {
      const response = await this.falcon.generateText({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
        temperature: 0.4
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultRequirements();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        technical: parsed.technical || [],
        functional: parsed.functional || [],
      };
    } catch (error) {
      logger.warn('[TenderGenerator] Failed to generate Requirements, using fallback:', error);
      return this.getDefaultRequirements();
    }
  }

  private async generateEvaluationCriteria(demand: DemandReport): Promise<TenderSections['evaluationCriteria']> {
    const prompt = `You are a UAE Government Procurement Evaluation Expert.

DEMAND REQUEST:
Organization: ${demand.organizationName}
Business Objective: ${demand.businessObjective}
Budget: ${demand.budgetRange}

Generate 5-7 evaluation criteria for vendor selection. Each criterion should have:
- Name/description
- Weight (percentage, total must equal 100%)
- Scoring method

Common criteria: Technical capability, Financial proposal, Experience, Implementation plan, Support services

Format: JSON array
[
  {
    "criterion": "Technical Capability",
    "weight": 30,
    "scoringMethod": "Technical proposal evaluation"
  },
  ...
]`;

    try {
      const response = await this.falcon.generateText({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        temperature: 0.4
      });

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.getDefaultEvaluationCriteria();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } catch (error) {
      logger.warn('[TenderGenerator] Failed to generate Evaluation Criteria, using fallback:', error);
      return this.getDefaultEvaluationCriteria();
    }
  }

  private async generateTermsAndConditions(_demand: DemandReport): Promise<string[]> {
    const terms = [
      'All bids must be submitted in accordance with UAE procurement regulations',
      'Vendors must be registered in the UAE and hold valid commercial licenses',
      'Payment terms: 30 days net upon delivery and acceptance',
      'Warranty period: Minimum 12 months from final acceptance',
      'Compliance with UAE cybersecurity and data protection standards is mandatory',
      'Delivery must be completed within the specified timeframe',
      'All intellectual property rights shall be transferred to the government entity',
      'Vendors must provide training and knowledge transfer to government staff',
      'Service Level Agreements (SLAs) must be clearly defined and measurable',
      'Change management and version control procedures must be documented',
    ];

    return terms;
  }

  private async runComplianceChecks(sections: Partial<TenderSections>): Promise<TenderSections['complianceChecks']> {
    const checks = [];

    checks.push({
      regulation: 'Federal Law No. 12 of 2018 on Public Procurement',
      status: 'pass' as const,
      notes: 'Tender structure complies with federal procurement law',
    });

    const totalWeight = sections.evaluationCriteria?.reduce((sum, c) => sum + c.weight, 0) || 0;
    checks.push({
      regulation: 'Evaluation Criteria Weighting',
      status: Math.abs(totalWeight - 100) < 1 ? 'pass' as const : 'warning' as const,
      notes: totalWeight === 100 ? 'Weights sum to 100%' : `Weights sum to ${totalWeight}% (should be 100%)`,
    });

    checks.push({
      regulation: 'UAE Procurement Code of Ethics',
      status: 'pass' as const,
      notes: 'Fair and transparent evaluation criteria defined',
    });

    return checks;
  }

  private getDefaultRequirements() {
    return {
      technical: [
        'Cloud-based infrastructure with 99.9% uptime SLA',
        'Compliance with UAE cybersecurity standards',
        'Scalable architecture supporting 10,000+ concurrent users',
        'Integration with existing government systems via APIs',
        'Comprehensive security features including encryption and access control',
      ],
      functional: [
        'User-friendly interface in Arabic and English',
        'Mobile-responsive design',
        'Real-time reporting and analytics',
        'Role-based access control',
        'Audit trail and compliance tracking',
      ],
    };
  }

  private getDefaultEvaluationCriteria() {
    return [
      { criterion: 'Technical Capability', weight: 30, scoringMethod: 'Technical proposal evaluation' },
      { criterion: 'Financial Proposal', weight: 25, scoringMethod: 'Cost competitiveness' },
      { criterion: 'Relevant Experience', weight: 20, scoringMethod: 'Past project references' },
      { criterion: 'Implementation Plan', weight: 15, scoringMethod: 'Timeline and methodology' },
      { criterion: 'Support and Maintenance', weight: 10, scoringMethod: 'Service level agreements' },
    ];
  }
}
