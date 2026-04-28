export interface DomainAssumption {
  name: string;
  value: string | number;
  unit: string;
  source: string;
  description: string;
  impact?: 'benefit' | 'cost' | 'both'; // How this parameter affects the financial model
}

export interface ArchetypeAssumptions {
  adoptionRate: number;
  adoptionRampMonths: number;
  implementationMonths: number;
  maintenancePercent: number;
  benefitRealizationMonths: number;
  contingencyPercent: number;
  discountRate: number;
  costVarianceWorst: number;
  costVarianceBest: number;
  benefitVarianceWorst: number;
  benefitVarianceBest: number;
  domainAssumptions?: DomainAssumption[];
}

export interface ArchetypeConfig {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  assumptions: ArchetypeAssumptions;
  benchmarkSources: {
    adoptionRate: string;
    implementationTimeline: string;
    maintenanceCost: string;
    benefitRealization: string;
    contingency: string;
    discountRate: string;
  };
}

export const PROJECT_ARCHETYPES: Record<string, ArchetypeConfig> = {
  'Government-Wide System': {
    id: 'government-wide-system',
    name: 'Government-Wide System',
    description: 'Large-scale systems serving multiple government entities',
    keywords: ['government-wide', 'enterprise', 'national', 'federal', 'cross-agency', 'shared services'],
    assumptions: {
      adoptionRate: 0.75,
      adoptionRampMonths: 24,
      implementationMonths: 30,
      maintenancePercent: 0.20,
      benefitRealizationMonths: 42,
      contingencyPercent: 0.22,
      discountRate: 0.09,
      costVarianceWorst: 0.30,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.35,
      benefitVarianceBest: 0.15
    },
    benchmarkSources: {
      adoptionRate: 'UAE Digital Government Strategy 2024',
      implementationTimeline: 'TDRA enterprise project benchmarks',
      maintenanceCost: 'Gartner IT spending benchmarks',
      benefitRealization: 'McKinsey government digital ROI studies',
      contingency: 'PMI large government IT projects',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Smart Government Infrastructure': {
    id: 'smart-government-infrastructure',
    name: 'Smart Government Infrastructure',
    description: 'IoT, smart city, and infrastructure modernization projects',
    keywords: ['smart city', 'iot', 'infrastructure', 'sensors', 'connectivity', 'smart government'],
    assumptions: {
      adoptionRate: 0.82,
      adoptionRampMonths: 18,
      implementationMonths: 21,
      maintenancePercent: 0.17,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.18,
      discountRate: 0.09,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.20
    },
    benchmarkSources: {
      adoptionRate: 'UAE Smart Government benchmarks',
      implementationTimeline: 'TDRA infrastructure project data',
      maintenanceCost: 'Gartner infrastructure TCO',
      benefitRealization: 'Deloitte smart city ROI analysis',
      contingency: 'PMI infrastructure project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Digital Service Platform': {
    id: 'digital-service-platform',
    name: 'Digital Service Platform',
    description: 'Customer-facing digital platforms and e-services',
    keywords: ['platform', 'e-service', 'portal', 'digital service', 'customer-facing', 'online'],
    assumptions: {
      adoptionRate: 0.87,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.16,
      benefitRealizationMonths: 21,
      contingencyPercent: 0.14,
      discountRate: 0.09,
      costVarianceWorst: 0.20,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.25
    },
    benchmarkSources: {
      adoptionRate: 'UAE e-services adoption data 2024',
      implementationTimeline: 'TDRA digital platform benchmarks',
      maintenanceCost: 'Gartner SaaS/platform TCO',
      benefitRealization: 'Accenture digital platform studies',
      contingency: 'PMI digital project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Digital Service Enhancement': {
    id: 'digital-service-enhancement',
    name: 'Digital Service Enhancement',
    description: 'Upgrades and improvements to existing digital services',
    keywords: ['enhancement', 'upgrade', 'improvement', 'optimization', 'modernization', 'refresh'],
    assumptions: {
      adoptionRate: 0.90,
      adoptionRampMonths: 6,
      implementationMonths: 9,
      maintenancePercent: 0.13,
      benefitRealizationMonths: 15,
      contingencyPercent: 0.11,
      discountRate: 0.09,
      costVarianceWorst: 0.15,
      costVarianceBest: -0.05,
      benefitVarianceWorst: -0.20,
      benefitVarianceBest: 0.20
    },
    benchmarkSources: {
      adoptionRate: 'UAE service enhancement benchmarks',
      implementationTimeline: 'TDRA enhancement project data',
      maintenanceCost: 'Industry standard for enhancements',
      benefitRealization: 'Quick-win project analysis',
      contingency: 'PMI small project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'ERP Implementation': {
    id: 'erp-implementation',
    name: 'ERP Implementation',
    description: 'Enterprise resource planning and core business systems',
    keywords: ['erp', 'sap', 'oracle', 'enterprise resource', 'finance system', 'hr system', 'core business'],
    assumptions: {
      adoptionRate: 0.72,
      adoptionRampMonths: 24,
      implementationMonths: 24,
      maintenancePercent: 0.22,
      benefitRealizationMonths: 42,
      contingencyPercent: 0.25,
      discountRate: 0.09,
      costVarianceWorst: 0.35,
      costVarianceBest: -0.05,
      benefitVarianceWorst: -0.40,
      benefitVarianceBest: 0.15
    },
    benchmarkSources: {
      adoptionRate: 'SAP/Oracle UAE implementation data',
      implementationTimeline: 'ERP vendor benchmarks',
      maintenanceCost: 'Gartner ERP TCO studies',
      benefitRealization: 'Deloitte ERP ROI analysis',
      contingency: 'PMI ERP project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'AI/ML Platform': {
    id: 'ai-ml-platform',
    name: 'AI/ML Platform',
    description: 'Artificial intelligence and machine learning initiatives',
    keywords: ['ai platform', 'ml platform', 'machine learning', 'artificial intelligence', 'deep learning', 'neural network', 'llm', 'generative ai', 'data science platform', 'mlops', 'model training'],
    assumptions: {
      adoptionRate: 0.70,
      adoptionRampMonths: 18,
      implementationMonths: 18,
      maintenancePercent: 0.27,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.30,
      discountRate: 0.11,
      costVarianceWorst: 0.40,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.45,
      benefitVarianceBest: 0.30,
      domainAssumptions: [
        { name: 'Citizen Users', value: 100000, unit: 'users', source: 'UAE Digital Government Strategy', description: 'Population served by the AI/ML platform', impact: 'benefit' },
        { name: 'Transaction Volume', value: 500000, unit: 'transactions/year', source: 'UAE government digital transactions benchmark', description: 'Annual transactions processed through AI workflows', impact: 'benefit' },
        { name: 'Processing Time Reduction', value: 50, unit: '%', source: 'McKinsey AI transformation studies', description: 'Cycle-time reduction from AI automation', impact: 'benefit' },
        { name: 'Staff Efficiency Gain', value: 25, unit: '%', source: 'Gartner AI productivity benchmarks', description: 'Staff productivity uplift from AI assist', impact: 'benefit' },
        { name: 'GPU / ML Compute Annual', value: 450000, unit: 'AED/year', source: 'UAE cloud GPU (A100/H100) reserved-capacity pricing benchmark', description: 'Training and inference compute spend per year (GPU nodes + storage)', impact: 'cost' },
        { name: 'LLM Inference Cost Annual', value: 220000, unit: 'AED/year', source: 'Managed LLM API cost at UAE government transaction volumes', description: 'Annual token / inference spend for foundation-model calls', impact: 'cost' },
        { name: 'MLOps Platform Annual', value: 180000, unit: 'AED/year', source: 'Gartner MLOps platform TCO', description: 'ML experimentation, registry, monitoring, and deployment tooling', impact: 'cost' },
        { name: 'Data Labeling & Curation Annual', value: 140000, unit: 'AED/year', source: 'Annotation services benchmark for Arabic + English corpora', description: 'Annual data labeling, curation, and synthetic data generation spend', impact: 'cost' },
        { name: 'Model Retraining Cycles per Year', value: 4, unit: 'cycles/year', source: 'AI operations benchmark for regulated domains', description: 'Retraining frequency — drives compute, labeling, and validation cost', impact: 'cost' },
        { name: 'AI Automation Rate', value: 40, unit: '%', source: 'McKinsey AI-in-government benefit studies', description: 'Share of transactions handled end-to-end by AI (lifts benefit multiplier)', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE AI Strategy benchmarks',
      implementationTimeline: 'TDRA AI project data',
      maintenanceCost: 'Gartner AI/ML platform TCO',
      benefitRealization: 'McKinsey AI value creation studies',
      contingency: 'PMI emerging technology standards',
      discountRate: 'Higher risk technology projects'
    }
  },
  'Government Digital Transformation': {
    id: 'government-digital-transformation',
    name: 'Government Digital Transformation',
    description: 'Government digital transformation for citizen-facing workflows, services, case handling, and operational modernization',
    keywords: ['government digital', 'digital transformation', 'service transformation', 'digital government', 'citizen service modernization', 'workflow digitization', 'case handling', 'process automation', 'decision support'],
    assumptions: {
      adoptionRate: 0.75,
      adoptionRampMonths: 18,
      implementationMonths: 18,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.20,
      discountRate: 0.09,
      costVarianceWorst: 0.30,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.35,
      benefitVarianceBest: 0.20,
      domainAssumptions: [
        { name: 'Citizen Users', value: 100000, unit: 'users', source: 'UAE Digital Government Strategy', description: 'Population served by the digital transformation', impact: 'benefit' },
        { name: 'Transaction Volume', value: 500000, unit: 'transactions/year', source: 'UAE government digital transactions benchmark', description: 'Annual digital transactions processed', impact: 'benefit' },
        { name: 'Processing Time Reduction', value: 50, unit: '%', source: 'UAE digital service benchmarks', description: 'Cycle-time reduction from workflow digitization and service redesign', impact: 'benefit' },
        { name: 'Staff Efficiency Gain', value: 25, unit: '%', source: 'Gartner digital government productivity benchmarks', description: 'Staff productivity uplift from service redesign, workflow digitization, and automation', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Digital Government Strategy 2024 + UAE AI Strategy',
      implementationTimeline: 'TDRA digital transformation benchmarks',
      maintenanceCost: 'Gartner digital government platform TCO',
      benefitRealization: 'McKinsey public-sector digital transformation studies',
      contingency: 'PMI government digital transformation standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Cybersecurity Initiative': {
    id: 'cybersecurity-initiative',
    name: 'Cybersecurity Initiative',
    description: 'Security infrastructure and compliance projects',
    keywords: ['security', 'cybersecurity', 'compliance', 'protection', 'threat', 'risk management'],
    assumptions: {
      adoptionRate: 0.95,
      adoptionRampMonths: 6,
      implementationMonths: 12,
      maintenancePercent: 0.25,
      benefitRealizationMonths: 12,
      contingencyPercent: 0.15,
      discountRate: 0.08,
      costVarianceWorst: 0.20,
      costVarianceBest: -0.05,
      benefitVarianceWorst: -0.15,
      benefitVarianceBest: 0.10
    },
    benchmarkSources: {
      adoptionRate: 'UAE National Cybersecurity Strategy',
      implementationTimeline: 'NESA implementation guidelines',
      maintenanceCost: 'Gartner security spending benchmarks',
      benefitRealization: 'Risk reduction immediate upon deployment',
      contingency: 'Security project standards',
      discountRate: 'Low-risk essential infrastructure'
    }
  },
  'Data Analytics Platform': {
    id: 'data-analytics-platform',
    name: 'Data Analytics Platform',
    description: 'Business intelligence and data warehouse projects',
    keywords: ['analytics', 'bi', 'business intelligence', 'data warehouse', 'reporting', 'dashboard'],
    assumptions: {
      adoptionRate: 0.78,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.18,
      discountRate: 0.09,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.25
    },
    benchmarkSources: {
      adoptionRate: 'UAE data analytics adoption studies',
      implementationTimeline: 'TDRA analytics project data',
      maintenanceCost: 'Gartner BI/analytics TCO',
      benefitRealization: 'McKinsey data-driven decision studies',
      contingency: 'Analytics project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Disaster Recovery & Business Continuity Platform': {
    id: 'disaster-recovery-business-continuity-platform',
    name: 'Disaster Recovery & Business Continuity Platform',
    description: 'Disaster recovery, continuity, backup, failover, and mission-critical resilience programs',
    keywords: ['disaster recovery', 'business continuity', 'dr', 'bc', 'bcp', 'continuity', 'resilience', 'failover', 'backup', 'restore', 'replication', 'rto', 'rpo', 'active-active', 'active passive', 'high availability', 'mission critical', 'critical digital assets', 'crisis recovery', 'service recovery'],
    assumptions: {
      adoptionRate: 0.96,
      adoptionRampMonths: 6,
      implementationMonths: 14,
      maintenancePercent: 0.24,
      benefitRealizationMonths: 12,
      contingencyPercent: 0.18,
      discountRate: 0.07,
      costVarianceWorst: 0.24,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.18,
      benefitVarianceBest: 0.12,
      domainAssumptions: [
        { name: 'Critical Services Protected', value: 24, unit: 'services', source: 'UAE critical digital service resilience benchmark', description: 'Tier-1 and Tier-2 services covered by DR and continuity controls', impact: 'both' },
        { name: 'Annual Service Value at Risk', value: 18000000, unit: 'AED/year', source: 'Public-sector outage impact benchmark', description: 'Annual operational and service-value exposure protected by the continuity capability', impact: 'benefit' },
        { name: 'Expected Downtime Reduction', value: 75, unit: '%', source: 'BCI continuity and resilience benchmarks', description: 'Reduction in expected outage duration and service disruption', impact: 'benefit' },
        { name: 'Current RTO', value: 24, unit: 'hours', source: 'Enterprise DR planning baseline', description: 'Current recovery time objective before modernization', impact: 'both' },
        { name: 'Target RTO', value: 4, unit: 'hours', source: 'Mission-critical public service target', description: 'Target recovery time objective after implementation', impact: 'benefit' },
        { name: 'Current RPO', value: 12, unit: 'hours', source: 'Enterprise backup planning baseline', description: 'Current recovery point objective before modernization', impact: 'both' },
        { name: 'Target RPO', value: 1, unit: 'hours', source: 'Mission-critical public service target', description: 'Target recovery point objective after implementation', impact: 'benefit' },
        { name: 'Annual DR Exercise Cost', value: 450000, unit: 'AED/year', source: 'Continuity exercise and audit benchmark', description: 'Annual recovery exercise, simulation, audit, and evidence cost', impact: 'cost' },
        { name: 'Secondary Site Annual Run Cost', value: 1200000, unit: 'AED/year', source: 'Cloud and colocation resilience TCO benchmark', description: 'Ongoing secondary environment, replication, monitoring, and network cost', impact: 'cost' },
        { name: 'Cyber Resilience Uplift', value: 20, unit: '%', source: 'NESA and ISO 22301 control uplift benchmark', description: 'Residual risk reduction from hardened recovery patterns and tested runbooks', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'ISO 22301 continuity adoption and UAE critical-service resilience practices',
      implementationTimeline: 'BCI and Gartner DR modernization benchmarks',
      maintenanceCost: 'Gartner backup, replication, and resilience TCO',
      benefitRealization: 'Avoided outage loss and continuity-control benefit benchmarks',
      contingency: 'PMI critical infrastructure project standards',
      discountRate: 'Low-risk essential-resilience infrastructure rate'
    }
  },
  'Cloud Modernization Platform': {
    id: 'cloud-modernization-platform',
    name: 'Cloud Modernization Platform',
    description: 'Cloud migration, landing-zone, modernization, and hybrid platform programs',
    keywords: ['cloud migration', 'cloud modernization', 'landing zone', 'hybrid cloud', 'multi cloud', 'container platform', 'kubernetes', 'platform modernization', 'application modernization', 'data center migration'],
    assumptions: {
      adoptionRate: 0.82,
      adoptionRampMonths: 12,
      implementationMonths: 18,
      maintenancePercent: 0.20,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.20,
      discountRate: 0.09,
      costVarianceWorst: 0.28,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.20
    },
    benchmarkSources: {
      adoptionRate: 'UAE cloud adoption and enterprise migration benchmarks',
      implementationTimeline: 'Gartner cloud migration program benchmarks',
      maintenanceCost: 'FinOps and cloud operations TCO benchmarks',
      benefitRealization: 'McKinsey cloud value realization studies',
      contingency: 'PMI cloud migration program standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Integration & API Platform': {
    id: 'integration-api-platform',
    name: 'Integration & API Platform',
    description: 'API management, enterprise integration, event streaming, and interoperability platforms',
    keywords: ['api platform', 'api gateway', 'integration platform', 'enterprise integration', 'event streaming', 'service bus', 'middleware', 'interoperability', 'system integration', 'data exchange'],
    assumptions: {
      adoptionRate: 0.84,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 21,
      contingencyPercent: 0.17,
      discountRate: 0.09,
      costVarianceWorst: 0.24,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.28,
      benefitVarianceBest: 0.20
    },
    benchmarkSources: {
      adoptionRate: 'Government interoperability platform benchmarks',
      implementationTimeline: 'API management delivery benchmarks',
      maintenanceCost: 'Gartner integration platform TCO',
      benefitRealization: 'Enterprise API reuse and integration value studies',
      contingency: 'PMI platform project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'GRC & Compliance Platform': {
    id: 'grc-compliance-platform',
    name: 'GRC & Compliance Platform',
    description: 'Governance, risk, compliance, audit, controls, and policy management platforms',
    keywords: ['grc', 'governance risk compliance', 'compliance platform', 'audit management', 'control testing', 'risk register', 'policy management', 'regulatory compliance', 'controls assurance'],
    assumptions: {
      adoptionRate: 0.88,
      adoptionRampMonths: 9,
      implementationMonths: 12,
      maintenancePercent: 0.17,
      benefitRealizationMonths: 15,
      contingencyPercent: 0.14,
      discountRate: 0.08,
      costVarianceWorst: 0.20,
      costVarianceBest: -0.06,
      benefitVarianceWorst: -0.22,
      benefitVarianceBest: 0.15
    },
    benchmarkSources: {
      adoptionRate: 'Public-sector compliance automation benchmarks',
      implementationTimeline: 'GRC platform implementation benchmarks',
      maintenanceCost: 'Gartner GRC platform TCO',
      benefitRealization: 'Audit automation and risk-reduction value studies',
      contingency: 'Compliance program standards',
      discountRate: 'Low-risk control-platform rate'
    }
  },
  'Document & Records Management Platform': {
    id: 'document-records-management-platform',
    name: 'Document & Records Management Platform',
    description: 'Document management, records, archiving, correspondence, and retention platforms',
    keywords: ['document management', 'records management', 'archive', 'archiving', 'correspondence', 'retention', 'edms', 'ecm', 'content management', 'digital records'],
    assumptions: {
      adoptionRate: 0.86,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.16,
      benefitRealizationMonths: 18,
      contingencyPercent: 0.15,
      discountRate: 0.08,
      costVarianceWorst: 0.22,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.18
    },
    benchmarkSources: {
      adoptionRate: 'Government records modernization benchmarks',
      implementationTimeline: 'ECM and records implementation benchmarks',
      maintenanceCost: 'Content platform TCO benchmarks',
      benefitRealization: 'Paperless government and records automation studies',
      contingency: 'Information management project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Procurement & Supply Chain Platform': {
    id: 'procurement-supply-chain-platform',
    name: 'Procurement & Supply Chain Platform',
    description: 'Procurement, sourcing, contract, supplier, inventory, and supply-chain systems',
    keywords: ['procurement platform', 'sourcing', 'supplier management', 'contract lifecycle', 'inventory management', 'supply chain platform', 'warehouse management', 'purchase order', 'eprocurement'],
    assumptions: {
      adoptionRate: 0.80,
      adoptionRampMonths: 15,
      implementationMonths: 18,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.18,
      discountRate: 0.09,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.22
    },
    benchmarkSources: {
      adoptionRate: 'Public procurement digitization benchmarks',
      implementationTimeline: 'Procure-to-pay platform implementation benchmarks',
      maintenanceCost: 'Gartner procurement platform TCO',
      benefitRealization: 'Deloitte procurement savings studies',
      contingency: 'PMI enterprise system standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'CRM & Citizen Experience Platform': {
    id: 'crm-citizen-experience-platform',
    name: 'CRM & Citizen Experience Platform',
    description: 'CRM, omnichannel, citizen engagement, and contact-experience platforms',
    keywords: ['crm', 'citizen experience', 'customer experience', 'omnichannel', 'contact center', 'case intake', 'service request', 'customer 360', 'citizen 360', 'complaints management'],
    assumptions: {
      adoptionRate: 0.86,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.17,
      benefitRealizationMonths: 18,
      contingencyPercent: 0.15,
      discountRate: 0.09,
      costVarianceWorst: 0.22,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.22
    },
    benchmarkSources: {
      adoptionRate: 'Government CRM and contact center adoption benchmarks',
      implementationTimeline: 'CRM implementation benchmarks',
      maintenanceCost: 'Gartner CRM platform TCO',
      benefitRealization: 'Citizen experience transformation value studies',
      contingency: 'Digital service delivery standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Autonomous Vehicle Platform': {
    id: 'autonomous-vehicle-platform',
    name: 'Autonomous Vehicle Platform',
    description: 'Autonomous vehicle taxi and transportation services',
    keywords: ['autonomous', 'av', 'self-driving', 'driverless', 'robo-taxi', 'autonomous taxi', 'autonomous vehicle', 'vehicle fleet', 'mobility platform'],
    assumptions: {
      adoptionRate: 0.68,
      adoptionRampMonths: 30,
      implementationMonths: 24,
      maintenancePercent: 0.22,
      benefitRealizationMonths: 36,
      contingencyPercent: 0.28,
      discountRate: 0.12,
      costVarianceWorst: 0.45,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.50,
      benefitVarianceBest: 0.35,
      domainAssumptions: [
        { name: 'Taxi Fare Rate', value: 2.7, unit: 'AED/km', source: 'RTA Dubai taxi blended tariff benchmark', description: 'Blended effective fare yield per kilometer', impact: 'benefit' },
        { name: 'Fleet Size', value: 120, unit: 'vehicles', source: 'Commercial launch wave assumption', description: 'Initial autonomous vehicle fleet for regulated launch', impact: 'both' },
        { name: 'Daily Trips per Vehicle', value: 16, unit: 'trips/day', source: 'Early-phase AV operations benchmark (limited zones, trust curve, regulator-imposed caps)', description: 'Average daily autonomous trip volume during commercialisation window', impact: 'benefit' },
        { name: 'Average Trip Distance', value: 13, unit: 'km', source: 'RTA urban mobility studies', description: 'Mean commercial trip length', impact: 'benefit' },
        { name: 'Vehicle Cost', value: 380000, unit: 'AED/vehicle', source: 'AV platform commercialization estimate', description: 'All-in vehicle acquisition cost per AV unit', impact: 'cost' },
        { name: 'Operating Cost per km', value: 1.25, unit: 'AED/km', source: 'Fully loaded AV operating benchmark incl. redundant safety systems, high-premium insurance, continuous sensor recalibration, and fleet downtime buffers', description: 'Variable energy, cleaning, support, insurance allocation, and downtime-adjusted cost per kilometer', impact: 'cost' },
        { name: 'Fleet Utilization Rate', value: 0.65, unit: '%', source: 'Early-phase AV utilization benchmark (limited operating zones, customer-trust curve, regulatory window constraints)', description: 'Active hours vs available hours during commercialisation', impact: 'benefit' },
        { name: 'Driver Cost Savings', value: 132000, unit: 'AED/vehicle/year', source: 'Dubai regulated fleet labor benchmark', description: 'Avoided annual driver staffing cost per vehicle (gross — net savings materialise only as safety-operator coverage is phased down)', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Autonomous Transport Strategy and regulated launch benchmarks',
      implementationTimeline: 'RTA AV pilot and commercialization program data',
      maintenanceCost: 'Electric AV fleet operating benchmarks',
      benefitRealization: 'Autonomous mobility commercialization case studies',
      contingency: 'Regulated emerging mobility program benchmark',
      discountRate: 'High-risk autonomous mobility hurdle rate (AV-class technology, regulatory, and commercialisation risk)'
    }
  },
  'Healthcare Digital Transformation': {
    id: 'healthcare-digital',
    name: 'Healthcare Digital Transformation',
    description: 'Hospital and healthcare system digitization',
    keywords: ['healthcare', 'hospital', 'medical', 'patient', 'clinical', 'ehr', 'emr', 'epic', 'cerner', 'health', 'facility care', 'dubai health', 'care coordination', 'medication', 'physician', 'nurse'],
    assumptions: {
      adoptionRate: 0.80,
      adoptionRampMonths: 18,
      implementationMonths: 24,
      maintenancePercent: 0.20,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.20,
      discountRate: 0.09,
      costVarianceWorst: 0.30,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.35,
      benefitVarianceBest: 0.20,
      domainAssumptions: [
        { name: 'Patient Throughput Increase', value: 15, unit: '%', source: 'MOHAP benchmarks', description: 'Efficiency gain in patient processing' },
        { name: 'Cost per Outpatient Visit', value: 350, unit: 'AED', source: 'DHA health economics', description: 'Average visit cost' },
        { name: 'Bed Occupancy Target', value: 85, unit: '%', source: 'WHO hospital standards', description: 'Optimal bed utilization' },
        { name: 'Medical Error Reduction', value: 40, unit: '%', source: 'Healthcare IT studies', description: 'Expected reduction in errors' },
        { name: 'Staff Time Savings', value: 2.5, unit: 'hours/day/nurse', source: 'EMR implementation studies', description: 'Time saved on documentation' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE MOHAP digital health strategy',
      implementationTimeline: 'Hospital IT project data',
      maintenanceCost: 'HIMSS healthcare IT benchmarks',
      benefitRealization: 'Healthcare ROI studies',
      contingency: 'Healthcare IT project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Smart Mobility Platform': {
    id: 'smart-mobility',
    name: 'Smart Mobility Platform',
    description: 'Integrated transportation and mobility solutions',
    keywords: ['mobility', 'transport', 'traffic', 'metro', 'bus', 'public transport', 'ride', 'sharing'],
    assumptions: {
      adoptionRate: 0.75,
      adoptionRampMonths: 18,
      implementationMonths: 24,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.20,
      discountRate: 0.09,
      costVarianceWorst: 0.28,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.35,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Daily Ridership Increase', value: 12, unit: '%', source: 'RTA mobility studies', description: 'Expected increase in public transport usage' },
        { name: 'Average Fare', value: 8, unit: 'AED', source: 'RTA fare structure', description: 'Mean ticket price' },
        { name: 'Traffic Congestion Reduction', value: 18, unit: '%', source: 'Smart city benchmarks', description: 'Expected reduction in congestion' },
        { name: 'Fuel Cost Savings', value: 0.45, unit: 'AED/km saved', source: 'Environmental studies', description: 'Per-km fuel cost avoided' },
        { name: 'Carbon Emission Reduction', value: 25, unit: '%', source: 'UAE Net Zero strategy', description: 'Emissions reduction target' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'RTA ridership growth data',
      implementationTimeline: 'TDRA smart transport projects',
      maintenanceCost: 'Transport platform TCO studies',
      benefitRealization: 'Deloitte smart mobility ROI',
      contingency: 'Infrastructure project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Insurance Digital Platform': {
    id: 'insurance-digital',
    name: 'Insurance Digital Platform',
    description: 'Insurance claims processing, policy management, and digital insurance services',
    keywords: ['insurance', 'claims', 'policy', 'insurer', 'underwriting', 'premium', 'coverage', 'enaya', 'daman', 'takaful', 'reinsurance', 'actuary', 'risk pool'],
    assumptions: {
      adoptionRate: 0.78,
      adoptionRampMonths: 15,
      implementationMonths: 18,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.18,
      discountRate: 0.10,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Claims Processing Cost', value: 500, unit: 'AED/claim manual', source: 'Insurance Operations Benchmarks', description: 'Cost per claim before automation', impact: 'cost' },
        { name: 'Digital Claims Cost', value: 50, unit: 'AED/claim automated', source: 'Insurance IT Studies', description: 'Cost per claim after automation', impact: 'benefit' },
        { name: 'Annual Claims Volume', value: 50000, unit: 'claims/year', source: 'Industry average', description: 'Total claims processed annually', impact: 'benefit' },
        { name: 'Fraud Detection Rate', value: 12, unit: '%', source: 'UAE Insurance Authority', description: 'Percentage of fraudulent claims detected', impact: 'benefit' },
        { name: 'Average Claim Value', value: 15000, unit: 'AED', source: 'DHA health insurance data', description: 'Mean claim amount', impact: 'benefit' },
        { name: 'Policy Renewal Rate', value: 85, unit: '%', source: 'Insurance retention benchmarks', description: 'Customer retention rate', impact: 'benefit' },
        { name: 'Processing Time Reduction', value: 60, unit: '%', source: 'Digital transformation studies', description: 'Time saved per claim', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Insurance Authority digital adoption',
      implementationTimeline: 'Insurance IT project benchmarks',
      maintenanceCost: 'Gartner insurance platform TCO',
      benefitRealization: 'McKinsey insurance digitization ROI',
      contingency: 'Financial services IT standards',
      discountRate: 'UAE Central Bank guidance'
    }
  },
  'Education Digital Platform': {
    id: 'education-digital',
    name: 'Education Digital Platform',
    description: 'Educational technology, e-learning, and school management systems',
    keywords: ['education', 'school', 'university', 'student', 'learning', 'lms', 'e-learning', 'curriculum', 'teacher', 'classroom', 'academic'],
    assumptions: {
      adoptionRate: 0.82,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.16,
      benefitRealizationMonths: 18,
      contingencyPercent: 0.15,
      discountRate: 0.09,
      costVarianceWorst: 0.22,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.20,
      domainAssumptions: [
        { name: 'Student Enrollment', value: 25000, unit: 'students', source: 'KHDA school data', description: 'Total students served', impact: 'benefit' },
        { name: 'Cost per Student', value: 500, unit: 'AED/student/year', source: 'Education technology benchmarks', description: 'Platform cost per student', impact: 'cost' },
        { name: 'Administrative Efficiency Gain', value: 35, unit: '%', source: 'EdTech ROI studies', description: 'Time saved on administration', impact: 'benefit' },
        { name: 'Teacher Productivity Gain', value: 20, unit: '%', source: 'LMS implementation studies', description: 'Increased teaching efficiency', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Ministry of Education digital strategy',
      implementationTimeline: 'EdTech implementation data',
      maintenanceCost: 'Education platform TCO studies',
      benefitRealization: 'UNESCO digital education ROI',
      contingency: 'Education IT project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Drone Last Mile Delivery': {
    id: 'drone-last-mile-delivery',
    name: 'Drone Last Mile Delivery',
    description: 'Autonomous drone delivery services for final-mile logistics from distribution centers to customers',
    keywords: ['drone', 'last mile', 'last-mile', 'delivery drone', 'drone delivery', 'delivery', 'uav', 'autonomous delivery', 'parcel', 'package', 'logistics', 'final mile', 'doorstep', 'e-commerce delivery', 'unmanned aerial'],
    assumptions: {
      adoptionRate: 0.60,
      adoptionRampMonths: 30,
      implementationMonths: 24,
      maintenancePercent: 0.22,
      benefitRealizationMonths: 36,
      contingencyPercent: 0.32,
      discountRate: 0.11,
      costVarianceWorst: 0.40,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.45,
      benefitVarianceBest: 0.30,
      domainAssumptions: [
        { name: 'Fleet Size', value: 180, unit: 'drones', source: 'Stage-gated UAE drone network benchmark', description: 'Target scale fleet once unit economics are proven', impact: 'both' },
        { name: 'Pilot Fleet Size', value: 12, unit: 'drones', source: 'Pilot validation benchmark', description: 'Validation fleet used to prove safety, service quality, and demand', impact: 'both' },
        { name: 'Drone Unit Cost', value: 85000, unit: 'AED/drone', source: 'Commercial drone market analysis', description: 'Cost per delivery drone', impact: 'cost' },
        { name: 'Pilot Deliveries per Drone', value: 70, unit: 'deliveries/day', source: 'Pilot validation benchmark', description: 'Expected pilot throughput on a 6–12 month validation scope.', impact: 'benefit' },
        { name: 'Scale Deliveries per Drone', value: 160, unit: 'deliveries/day', source: 'Scaled drone-network operating benchmark', description: 'Target steady-state throughput required for scale economics.', impact: 'benefit' },
        { name: 'Premium Fare Rate', value: 52, unit: 'AED/delivery', source: 'UAE urgent-delivery pricing', description: 'Premium express delivery price', impact: 'benefit' },
        { name: 'Pharma Fare Rate', value: 60, unit: 'AED/delivery', source: 'Healthcare logistics pricing', description: 'Pharma / critical delivery price', impact: 'benefit' },
        { name: 'B2B Contract Fare Rate', value: 38, unit: 'AED/delivery', source: 'Contracted enterprise delivery pricing', description: 'Contracted B2B price for committed volume', impact: 'benefit' },
        { name: 'Platform Fee per Delivery', value: 4, unit: 'AED/delivery', source: 'API platform monetization benchmark', description: 'Platform fee charged on enterprise-integrated deliveries', impact: 'benefit' },
        { name: 'Enterprise Contract Share', value: 0.6, unit: 'share', source: 'Enterprise demand mix benchmark', description: 'Share of deliveries backed by contracted enterprise demand', impact: 'benefit' },
        { name: 'Pilot Partner Delivery Share', value: 0.65, unit: 'share', source: 'Partner-led pilot operating benchmark', description: 'Share of pilot operating playbooks and early corridor execution transferred through a launch partner', impact: 'both' },
        { name: 'Pilot Partner Ops Offset', value: 0.3, unit: 'share', source: 'Partner-led operating model benchmark', description: 'Initial reduction in direct in-house operations overhead during Phase 1', impact: 'cost' },
        { name: 'Learning Curve Annual Improvement', value: 0.06, unit: 'share', source: 'Scaled drone network learning benchmark', description: 'Annual reduction in direct operating cost from route learning and standardization', impact: 'cost' },
        { name: 'Automation Target', value: 0.55, unit: 'share', source: 'Remote-ops automation benchmark', description: 'Target share of operating workflows supported by automation at scale', impact: 'cost' },
        { name: 'Idle Time Reduction', value: 0.12, unit: 'share', source: 'Fleet orchestration optimization benchmark', description: 'Reduction in idle fleet time from routing and dispatch optimization', impact: 'cost' },
        { name: 'Average Delivery Distance', value: 8, unit: 'km', source: 'Last mile delivery studies', description: 'Mean delivery range', impact: 'both' },
        { name: 'Cost per Delivery (Traditional)', value: 35, unit: 'AED/delivery', source: 'UAE logistics market data', description: 'Current van/bike delivery cost', impact: 'benefit' },
        { name: 'Cost per Drone Delivery', value: 33, unit: 'AED/delivery', source: 'Stage-gated unit economics benchmark', description: 'Target scale cost including operations, handling, and support.', impact: 'cost' },
        { name: 'Package Weight Limit', value: 5, unit: 'kg', source: 'GCAA drone regulations', description: 'Maximum payload per delivery', impact: 'cost' },
        { name: 'Delivery Time Reduction', value: 65, unit: '%', source: 'Drone delivery pilot data', description: 'Time saved vs ground transport', impact: 'benefit' },
        { name: 'Carbon Emission Reduction', value: 70, unit: '%', source: 'Environmental impact studies', description: 'Emissions reduction vs vans', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Drone Delivery Strategy 2024',
      implementationTimeline: 'GCAA commercial drone operations data',
      maintenanceCost: 'Commercial drone fleet TCO studies',
      benefitRealization: 'McKinsey drone logistics ROI analysis',
      contingency: 'Emerging technology project standards',
      discountRate: 'High-risk logistics technology rates'
    }
  },
  'Drone First Mile Delivery': {
    id: 'drone-first-mile-delivery',
    name: 'Drone First Mile Delivery',
    description: 'Autonomous drone pickup and collection services from source locations to distribution centers',
    keywords: ['drone', 'first mile', 'pickup', 'collection', 'uav', 'autonomous pickup', 'logistics', 'source collection', 'warehouse', 'distribution', 'supply chain', 'unmanned aerial'],
    assumptions: {
      adoptionRate: 0.55,
      adoptionRampMonths: 36,
      implementationMonths: 28,
      maintenancePercent: 0.24,
      benefitRealizationMonths: 42,
      contingencyPercent: 0.35,
      discountRate: 0.12,
      costVarianceWorst: 0.45,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.50,
      benefitVarianceBest: 0.28,
      domainAssumptions: [
        { name: 'Fleet Size', value: 30, unit: 'drones', source: 'UAE logistics pilot programs', description: 'Initial cargo drone fleet', impact: 'both' },
        { name: 'Drone Unit Cost', value: 150000, unit: 'AED/drone', source: 'Heavy-lift drone market', description: 'Cost per cargo collection drone', impact: 'cost' },
        { name: 'Daily Pickups per Drone', value: 18, unit: 'pickups/day', source: 'First mile logistics benchmarks', description: 'Average daily collection capacity', impact: 'benefit' },
        { name: 'Average Pickup Distance', value: 15, unit: 'km', source: 'Supply chain studies', description: 'Mean collection distance', impact: 'both' },
        { name: 'Cost per Traditional Pickup', value: 55, unit: 'AED/pickup', source: 'UAE logistics market data', description: 'Current truck collection cost', impact: 'benefit' },
        { name: 'Cost per Drone Pickup', value: 22, unit: 'AED/pickup', source: 'Drone operations benchmarks', description: 'Automated drone pickup cost', impact: 'cost' },
        { name: 'Cargo Capacity', value: 15, unit: 'kg', source: 'Heavy-lift drone specifications', description: 'Maximum payload per pickup', impact: 'cost' },
        { name: 'Collection Time Reduction', value: 50, unit: '%', source: 'First mile pilot data', description: 'Time saved vs ground collection', impact: 'benefit' },
        { name: 'Supply Chain Efficiency', value: 30, unit: '%', source: 'Supply chain optimization studies', description: 'Overall efficiency improvement', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Logistics Strategy 2024',
      implementationTimeline: 'GCAA cargo drone operations data',
      maintenanceCost: 'Heavy-lift drone fleet TCO studies',
      benefitRealization: 'Deloitte supply chain automation ROI',
      contingency: 'High-risk emerging technology standards',
      discountRate: 'Venture capital logistics technology rates'
    }
  },
  'Border Security & Immigration': {
    id: 'border-security-immigration',
    name: 'Border Security & Immigration',
    description: 'Border control, immigration processing, and security systems',
    keywords: ['border', 'immigration', 'visa', 'passport', 'customs', 'entry', 'exit', 'security checkpoint', 'biometric', 'identity', 'traveler', 'airport security', 'seaport', 'ica', 'gdrfa'],
    assumptions: {
      adoptionRate: 0.88,
      adoptionRampMonths: 18,
      implementationMonths: 24,
      maintenancePercent: 0.22,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.20,
      discountRate: 0.08,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.20,
      domainAssumptions: [
        { name: 'Annual Travelers', value: 25000000, unit: 'travelers/year', source: 'UAE immigration statistics', description: 'Total annual border crossings', impact: 'benefit' },
        { name: 'Processing Time Current', value: 45, unit: 'seconds', source: 'Airport benchmarks', description: 'Current average processing time', impact: 'cost' },
        { name: 'Processing Time Target', value: 15, unit: 'seconds', source: 'Smart gates performance', description: 'Target processing time', impact: 'benefit' },
        { name: 'Threat Detection Rate', value: 99.5, unit: '%', source: 'Security requirements', description: 'Required detection accuracy', impact: 'benefit' },
        { name: 'Staff Efficiency Gain', value: 40, unit: '%', source: 'Automation benchmarks', description: 'Expected staff productivity increase', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE ICA digitization data',
      implementationTimeline: 'Airport security system projects',
      maintenanceCost: 'Critical infrastructure TCO',
      benefitRealization: 'Smart border ROI studies',
      contingency: 'Security infrastructure standards',
      discountRate: 'Low-risk critical infrastructure'
    }
  },
  'Tourism & Hospitality Platform': {
    id: 'tourism-hospitality-platform',
    name: 'Tourism & Hospitality Platform',
    description: 'Tourism promotion, hospitality management, and visitor experience systems',
    keywords: ['tourism', 'hospitality', 'hotel', 'visitor', 'attraction', 'destination', 'booking', 'experience', 'tourist', 'entertainment', 'leisure', 'dtcm', 'expo', 'museum'],
    assumptions: {
      adoptionRate: 0.80,
      adoptionRampMonths: 12,
      implementationMonths: 15,
      maintenancePercent: 0.16,
      benefitRealizationMonths: 18,
      contingencyPercent: 0.15,
      discountRate: 0.09,
      costVarianceWorst: 0.22,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.28,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Annual Visitors', value: 20000000, unit: 'visitors/year', source: 'DTCM tourism data', description: 'Total annual tourist arrivals', impact: 'benefit' },
        { name: 'Average Spend per Visitor', value: 4500, unit: 'AED', source: 'Tourism economic reports', description: 'Mean visitor expenditure', impact: 'benefit' },
        { name: 'Booking Conversion Rate', value: 12, unit: '%', source: 'Digital tourism benchmarks', description: 'Online booking conversion', impact: 'benefit' },
        { name: 'Customer Satisfaction Target', value: 90, unit: '%', source: 'Service quality standards', description: 'Target satisfaction score', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE tourism digital adoption',
      implementationTimeline: 'DTCM platform projects',
      maintenanceCost: 'Tourism platform TCO',
      benefitRealization: 'Tourism ROI benchmarks',
      contingency: 'Digital platform standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Financial Services Platform': {
    id: 'financial-services-platform',
    name: 'Financial Services Platform',
    description: 'Banking, payment systems, and financial technology platforms',
    keywords: ['banking', 'payment', 'fintech', 'transaction', 'transfer', 'wallet', 'finance', 'credit', 'debit', 'loan', 'mortgage', 'investment', 'central bank', 'cbuae'],
    assumptions: {
      adoptionRate: 0.75,
      adoptionRampMonths: 18,
      implementationMonths: 21,
      maintenancePercent: 0.20,
      benefitRealizationMonths: 27,
      contingencyPercent: 0.22,
      discountRate: 0.10,
      costVarianceWorst: 0.28,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.32,
      benefitVarianceBest: 0.22,
      domainAssumptions: [
        { name: 'Annual Transactions', value: 500000000, unit: 'transactions/year', source: 'CBUAE payment data', description: 'Total annual transactions', impact: 'benefit' },
        { name: 'Transaction Cost Current', value: 2.5, unit: 'AED', source: 'Banking benchmarks', description: 'Current cost per transaction', impact: 'cost' },
        { name: 'Transaction Cost Target', value: 0.5, unit: 'AED', source: 'Digital banking targets', description: 'Target cost per transaction', impact: 'benefit' },
        { name: 'Fraud Reduction Rate', value: 60, unit: '%', source: 'Fintech security studies', description: 'Expected fraud reduction', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Central Bank digital banking',
      implementationTimeline: 'Financial system projects',
      maintenanceCost: 'Banking platform TCO',
      benefitRealization: 'Fintech ROI studies',
      contingency: 'Financial services standards',
      discountRate: 'CBUAE guidance rates'
    }
  },
  'Agriculture & Food Security': {
    id: 'agriculture-food-security',
    name: 'Agriculture & Food Security',
    description: 'Agricultural technology, food supply chain, and food security systems',
    keywords: ['agriculture', 'farming', 'food', 'crop', 'livestock', 'irrigation', 'harvest', 'supply chain', 'food security', 'vertical farming', 'aquaculture', 'fisheries', 'ministry of climate'],
    assumptions: {
      adoptionRate: 0.70,
      adoptionRampMonths: 24,
      implementationMonths: 21,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 36,
      contingencyPercent: 0.25,
      discountRate: 0.09,
      costVarianceWorst: 0.30,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.35,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Food Self-Sufficiency Target', value: 50, unit: '%', source: 'UAE Food Security Strategy', description: 'Target local food production', impact: 'benefit' },
        { name: 'Yield Improvement', value: 30, unit: '%', source: 'AgTech benchmarks', description: 'Expected crop yield increase', impact: 'benefit' },
        { name: 'Water Efficiency Gain', value: 40, unit: '%', source: 'Smart irrigation studies', description: 'Water usage reduction', impact: 'benefit' },
        { name: 'Food Waste Reduction', value: 25, unit: '%', source: 'Supply chain optimization', description: 'Reduction in food waste', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE AgTech adoption data',
      implementationTimeline: 'Agricultural technology projects',
      maintenanceCost: 'AgTech platform TCO',
      benefitRealization: 'Food security ROI studies',
      contingency: 'Agricultural project standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Energy & Utilities Platform': {
    id: 'energy-utilities-platform',
    name: 'Energy & Utilities Platform',
    description: 'Energy management, smart grid, and utility optimization systems',
    keywords: ['energy', 'electricity', 'power', 'grid', 'renewable', 'solar', 'nuclear', 'water', 'utility', 'smart meter', 'dewa', 'adwea', 'enoc', 'masdar'],
    assumptions: {
      adoptionRate: 0.82,
      adoptionRampMonths: 18,
      implementationMonths: 24,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.20,
      discountRate: 0.08,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.28,
      benefitVarianceBest: 0.22,
      domainAssumptions: [
        { name: 'Energy Consumption Reduction', value: 20, unit: '%', source: 'UAE Energy Strategy 2050', description: 'Target consumption reduction', impact: 'benefit' },
        { name: 'Renewable Energy Share', value: 50, unit: '%', source: 'Clean energy targets', description: 'Target renewable percentage', impact: 'benefit' },
        { name: 'Grid Efficiency Improvement', value: 15, unit: '%', source: 'Smart grid benchmarks', description: 'Transmission loss reduction', impact: 'benefit' },
        { name: 'Customer Connections', value: 1000000, unit: 'connections', source: 'Utility data', description: 'Total smart meter connections', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'DEWA smart grid adoption',
      implementationTimeline: 'Energy infrastructure projects',
      maintenanceCost: 'Utility platform TCO',
      benefitRealization: 'Smart grid ROI studies',
      contingency: 'Critical infrastructure standards',
      discountRate: 'Low-risk infrastructure rates'
    }
  },
  'Public Safety & Emergency': {
    id: 'public-safety-emergency',
    name: 'Public Safety & Emergency',
    description: 'Emergency response, public safety, and disaster management systems',
    keywords: ['emergency', 'safety', 'police', 'fire', 'ambulance', 'rescue', 'disaster', 'crisis', 'incident', 'response', '999', 'civil defense', 'ncema', 'dubai police'],
    assumptions: {
      adoptionRate: 0.92,
      adoptionRampMonths: 12,
      implementationMonths: 18,
      maintenancePercent: 0.22,
      benefitRealizationMonths: 18,
      contingencyPercent: 0.18,
      discountRate: 0.07,
      costVarianceWorst: 0.22,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.20,
      benefitVarianceBest: 0.15,
      domainAssumptions: [
        { name: 'Response Time Improvement', value: 35, unit: '%', source: 'Emergency services benchmarks', description: 'Faster emergency response', impact: 'benefit' },
        { name: 'Annual Incidents', value: 500000, unit: 'incidents/year', source: 'Safety statistics', description: 'Total incidents handled', impact: 'benefit' },
        { name: 'Resolution Rate Target', value: 95, unit: '%', source: 'Service standards', description: 'Target incident resolution', impact: 'benefit' },
        { name: 'Coordination Efficiency', value: 40, unit: '%', source: 'Multi-agency studies', description: 'Inter-agency coordination improvement', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE emergency services modernization',
      implementationTimeline: 'Public safety projects',
      maintenanceCost: 'Emergency system TCO',
      benefitRealization: 'Public safety ROI studies',
      contingency: 'Critical service standards',
      discountRate: 'Essential service rates'
    }
  },
  'Social Welfare & Housing': {
    id: 'social-welfare-housing',
    name: 'Social Welfare & Housing',
    description: 'Social services, housing programs, and citizen welfare systems',
    keywords: ['welfare', 'housing', 'social', 'benefit', 'subsidy', 'pension', 'allowance', 'support', 'citizen', 'family', 'community', 'mocd', 'sheikh zayed housing'],
    assumptions: {
      adoptionRate: 0.85,
      adoptionRampMonths: 15,
      implementationMonths: 18,
      maintenancePercent: 0.16,
      benefitRealizationMonths: 21,
      contingencyPercent: 0.15,
      discountRate: 0.08,
      costVarianceWorst: 0.20,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.25,
      benefitVarianceBest: 0.18,
      domainAssumptions: [
        { name: 'Beneficiaries Served', value: 200000, unit: 'families', source: 'Social welfare data', description: 'Total families receiving support', impact: 'benefit' },
        { name: 'Processing Time Reduction', value: 60, unit: '%', source: 'Digital services benchmarks', description: 'Application processing improvement', impact: 'benefit' },
        { name: 'Fraud Detection Rate', value: 15, unit: '%', source: 'Welfare system studies', description: 'Fraudulent claims detected', impact: 'benefit' },
        { name: 'Service Satisfaction', value: 90, unit: '%', source: 'Citizen satisfaction surveys', description: 'Target satisfaction rate', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE social services digital adoption',
      implementationTimeline: 'Welfare system projects',
      maintenanceCost: 'Social platform TCO',
      benefitRealization: 'Social services ROI studies',
      contingency: 'Government service standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Environmental Sustainability': {
    id: 'environmental-sustainability',
    name: 'Environmental Sustainability',
    description: 'Environmental monitoring, sustainability, and climate action systems',
    keywords: ['environment', 'sustainability', 'climate', 'carbon', 'emission', 'pollution', 'waste', 'recycling', 'green', 'net zero', 'conservation', 'moccae'],
    assumptions: {
      adoptionRate: 0.75,
      adoptionRampMonths: 18,
      implementationMonths: 21,
      maintenancePercent: 0.17,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.20,
      discountRate: 0.08,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.30,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Carbon Reduction Target', value: 40, unit: '%', source: 'UAE Net Zero Strategy', description: 'Target carbon emission reduction', impact: 'benefit' },
        { name: 'Waste Diversion Rate', value: 75, unit: '%', source: 'Circular economy targets', description: 'Waste diverted from landfill', impact: 'benefit' },
        { name: 'Air Quality Improvement', value: 25, unit: '%', source: 'Environmental monitoring', description: 'Target air quality improvement', impact: 'benefit' },
        { name: 'Monitoring Stations', value: 500, unit: 'stations', source: 'Environmental network', description: 'IoT monitoring points', impact: 'cost' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE environmental technology adoption',
      implementationTimeline: 'Sustainability projects',
      maintenanceCost: 'Environmental platform TCO',
      benefitRealization: 'Green initiative ROI studies',
      contingency: 'Environmental project standards',
      discountRate: 'Sustainability initiative rates'
    }
  },
  'Blockchain & Digital Identity': {
    id: 'blockchain-digital-identity',
    name: 'Blockchain & Digital Identity',
    description: 'Blockchain platforms, digital identity, and distributed ledger systems',
    keywords: ['blockchain', 'identity', 'digital id', 'uae pass', 'ledger', 'smart contract', 'verification', 'credential', 'trust', 'decentralized', 'nft', 'token'],
    assumptions: {
      adoptionRate: 0.68,
      adoptionRampMonths: 24,
      implementationMonths: 21,
      maintenancePercent: 0.25,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.28,
      discountRate: 0.11,
      costVarianceWorst: 0.35,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.40,
      benefitVarianceBest: 0.30,
      domainAssumptions: [
        { name: 'Digital Identity Users', value: 5000000, unit: 'users', source: 'UAE Pass adoption', description: 'Total digital identity users', impact: 'benefit' },
        { name: 'Transaction Verification Time', value: 3, unit: 'seconds', source: 'Blockchain benchmarks', description: 'Average verification time', impact: 'benefit' },
        { name: 'Fraud Reduction', value: 80, unit: '%', source: 'Identity fraud studies', description: 'Identity fraud reduction', impact: 'benefit' },
        { name: 'Process Automation', value: 50, unit: '%', source: 'Smart contract studies', description: 'Automated processes percentage', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Blockchain Strategy',
      implementationTimeline: 'Blockchain project benchmarks',
      maintenanceCost: 'Distributed ledger TCO',
      benefitRealization: 'Digital identity ROI studies',
      contingency: 'Emerging technology standards',
      discountRate: 'Higher risk technology rates'
    }
  },
  'Smart Buildings & Facilities': {
    id: 'smart-buildings-facilities',
    name: 'Smart Buildings & Facilities',
    description: 'Building automation, facilities management, and smart infrastructure',
    keywords: ['building', 'facility', 'bms', 'hvac', 'elevator', 'parking', 'access control', 'lighting', 'occupancy', 'maintenance', 'property', 'real estate'],
    assumptions: {
      adoptionRate: 0.78,
      adoptionRampMonths: 15,
      implementationMonths: 18,
      maintenancePercent: 0.18,
      benefitRealizationMonths: 24,
      contingencyPercent: 0.18,
      discountRate: 0.09,
      costVarianceWorst: 0.25,
      costVarianceBest: -0.08,
      benefitVarianceWorst: -0.28,
      benefitVarianceBest: 0.22,
      domainAssumptions: [
        { name: 'Buildings Managed', value: 100, unit: 'buildings', source: 'Facilities portfolio', description: 'Total buildings in system', impact: 'benefit' },
        { name: 'Energy Savings', value: 30, unit: '%', source: 'Smart building benchmarks', description: 'Energy consumption reduction', impact: 'benefit' },
        { name: 'Maintenance Cost Reduction', value: 25, unit: '%', source: 'Predictive maintenance studies', description: 'Maintenance cost savings', impact: 'benefit' },
        { name: 'Occupant Satisfaction', value: 85, unit: '%', source: 'Facility surveys', description: 'Target occupant satisfaction', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE smart building adoption',
      implementationTimeline: 'BMS implementation projects',
      maintenanceCost: 'Facilities management TCO',
      benefitRealization: 'Smart building ROI studies',
      contingency: 'Property technology standards',
      discountRate: 'UAE Ministry of Finance hurdle rate'
    }
  },
  'Space Technology & Satellite': {
    id: 'space-technology-satellite',
    name: 'Space Technology & Satellite',
    description: 'Space programs, satellite systems, and aerospace technology',
    keywords: ['space', 'satellite', 'aerospace', 'orbit', 'launch', 'remote sensing', 'gps', 'communication', 'earth observation', 'mbrsc', 'hope probe', 'mars'],
    assumptions: {
      adoptionRate: 0.60,
      adoptionRampMonths: 36,
      implementationMonths: 36,
      maintenancePercent: 0.28,
      benefitRealizationMonths: 48,
      contingencyPercent: 0.40,
      discountRate: 0.13,
      costVarianceWorst: 0.50,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.50,
      benefitVarianceBest: 0.35,
      domainAssumptions: [
        { name: 'Satellite Coverage', value: 95, unit: '%', source: 'UAE Space Agency', description: 'Target coverage area', impact: 'benefit' },
        { name: 'Data Resolution', value: 0.5, unit: 'meters', source: 'Earth observation standards', description: 'Imaging resolution', impact: 'benefit' },
        { name: 'Communication Bandwidth', value: 100, unit: 'Gbps', source: 'Satellite capacity', description: 'Total communication capacity', impact: 'benefit' },
        { name: 'Mission Success Rate', value: 95, unit: '%', source: 'Aerospace benchmarks', description: 'Target mission success', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE National Space Strategy',
      implementationTimeline: 'Space mission project data',
      maintenanceCost: 'Satellite operations TCO',
      benefitRealization: 'Space program ROI studies',
      contingency: 'High-risk aerospace standards',
      discountRate: 'Venture capital space rates'
    }
  },
  'Manufacturing & Industry 4.0': {
    id: 'manufacturing-industry-4',
    name: 'Manufacturing & Industry 4.0',
    description: 'Smart manufacturing, industrial automation, and Industry 4.0 systems',
    keywords: ['manufacturing', 'industry', 'factory', 'automation', 'robotics', 'iot', 'plc', 'scada', 'mes', 'erp', 'supply chain', 'production', 'assembly', 'industrial zone'],
    assumptions: {
      adoptionRate: 0.72,
      adoptionRampMonths: 21,
      implementationMonths: 24,
      maintenancePercent: 0.20,
      benefitRealizationMonths: 30,
      contingencyPercent: 0.22,
      discountRate: 0.10,
      costVarianceWorst: 0.28,
      costVarianceBest: -0.10,
      benefitVarianceWorst: -0.32,
      benefitVarianceBest: 0.25,
      domainAssumptions: [
        { name: 'Production Efficiency Gain', value: 25, unit: '%', source: 'Industry 4.0 benchmarks', description: 'Manufacturing efficiency improvement', impact: 'benefit' },
        { name: 'Defect Reduction', value: 40, unit: '%', source: 'Quality control studies', description: 'Product defect reduction', impact: 'benefit' },
        { name: 'Downtime Reduction', value: 35, unit: '%', source: 'Predictive maintenance data', description: 'Unplanned downtime reduction', impact: 'benefit' },
        { name: 'Labor Productivity', value: 30, unit: '%', source: 'Automation studies', description: 'Worker productivity increase', impact: 'benefit' }
      ]
    },
    benchmarkSources: {
      adoptionRate: 'UAE Industry 4.0 Strategy',
      implementationTimeline: 'Manufacturing technology projects',
      maintenanceCost: 'Industrial automation TCO',
      benefitRealization: 'Smart factory ROI studies',
      contingency: 'Industrial project standards',
      discountRate: 'Industrial technology rates'
    }
  }
};

export const DEFAULT_ARCHETYPE = 'Digital Service Platform';

export interface ArchetypeDetectionContext {
  projectName?: string;
  projectDescription?: string;
  projectType?: string;
  organization?: string;
  objectives?: string;
  problemStatement?: string;
}

const ORGANIZATION_TO_SECTOR: Record<string, string> = {
  'dha': 'Healthcare Digital Transformation',
  'dubai health': 'Healthcare Digital Transformation',
  'dubai health authority': 'Healthcare Digital Transformation',
  'mohap': 'Healthcare Digital Transformation',
  'ministry of health': 'Healthcare Digital Transformation',
  'seha': 'Healthcare Digital Transformation',
  'cleveland clinic': 'Healthcare Digital Transformation',
  'mediclinic': 'Healthcare Digital Transformation',
  'rta': 'Smart Mobility Platform',
  'roads and transport': 'Smart Mobility Platform',
  'dubai metro': 'Smart Mobility Platform',
  'khda': 'Education Digital Platform',
  'ministry of education': 'Education Digital Platform',
  'moe': 'Education Digital Platform',
  'dubai police': 'Public Safety & Emergency',
  'adnoc': 'Energy & Utilities Platform',
  'dewa': 'Energy & Utilities Platform',
  'dubai electricity': 'Energy & Utilities Platform',
  'etisalat': 'Digital Service Platform',
  'du': 'Digital Service Platform',
  'central bank': 'Financial Services Platform',
  'cbuae': 'Financial Services Platform',
  'insurance authority': 'Insurance Digital Platform',
  'ica': 'Border Security & Immigration',
  'gdrfa': 'Border Security & Immigration',
  'immigration': 'Border Security & Immigration',
  'customs': 'Border Security & Immigration',
  'dtcm': 'Tourism & Hospitality Platform',
  'tourism': 'Tourism & Hospitality Platform',
  'expo': 'Tourism & Hospitality Platform',
  'ministry of climate': 'Agriculture & Food Security',
  'food security': 'Agriculture & Food Security',
  'ncema': 'Public Safety & Emergency',
  'civil defense': 'Public Safety & Emergency',
  'mocd': 'Social Welfare & Housing',
  'sheikh zayed housing': 'Social Welfare & Housing',
  'moccae': 'Environmental Sustainability',
  'environment agency': 'Environmental Sustainability',
  'uae pass': 'Blockchain & Digital Identity',
  'mbrsc': 'Space Technology & Satellite',
  'space agency': 'Space Technology & Satellite',
  'masdar': 'Energy & Utilities Platform',
};

// Keywords that are UNIQUELY specific to an archetype (immediate match)
// These are multi-word phrases that ONLY apply to one domain
const HIGH_SPECIFICITY_KEYWORDS: Record<string, string[]> = {
  'AI/ML Platform': ['ai platform', 'ml platform', 'machine learning platform', 'artificial intelligence platform', 'generative ai', 'llm platform', 'mlops platform', 'model training', 'ai-powered', 'ai driven', 'ai-enabled', 'predictive analytics'],
  'Disaster Recovery & Business Continuity Platform': ['disaster recovery', 'business continuity', 'dr site', 'bc plan', 'bcp program', 'rto/rpo', 'rto and rpo', 'recovery time objective', 'recovery point objective', 'failover site', 'active-active resilience', 'critical digital assets', 'mission critical recovery'],
  'Autonomous Vehicle Platform': ['flying taxi', 'robo-taxi', 'autonomous taxi', 'self-driving taxi', 'driverless taxi', 'autonomous vehicle platform', 'autonomous mobility', 'autonomous fleet', 'waymo', 'cruise autonomous'],
  'Healthcare Digital Transformation': ['electronic health record', 'electronic medical record', 'epic implementation', 'cerner implementation', 'hospital information system', 'patient medical record'],
  'Drone Last Mile Delivery': ['drone delivery', 'drone last mile', 'drone last-mile', 'uav last mile', 'uav delivery', 'drone parcel delivery', 'autonomous drone delivery'],
  'Drone First Mile Delivery': ['drone first mile', 'uav first mile', 'drone cargo pickup', 'drone collection service'],
  'Insurance Digital Platform': ['insurance claims processing', 'insurance policy management', 'claims automation', 'insurance underwriting system'],
  'ERP Implementation': ['sap implementation', 'oracle erp', 'enterprise resource planning', 'erp system implementation'],
  'Cloud Modernization Platform': ['cloud migration', 'cloud modernization', 'landing zone', 'data center migration'],
  'Integration & API Platform': ['api gateway', 'api management', 'integration platform', 'enterprise integration platform'],
  'GRC & Compliance Platform': ['governance risk compliance', 'grc platform', 'audit management platform', 'control testing platform'],
  'Document & Records Management Platform': ['document management system', 'records management system', 'enterprise content management', 'digital records platform'],
  'Procurement & Supply Chain Platform': ['procurement platform', 'supplier management platform', 'contract lifecycle management', 'eprocurement platform'],
  'CRM & Citizen Experience Platform': ['citizen experience platform', 'customer 360', 'citizen 360', 'omnichannel contact center'],
  // Performance management must resolve to a generic enterprise platform — never AI/ML — unless the user explicitly describes AI capabilities.
  'Digital Service Platform': ['performance management system', 'performance management platform', 'kpi management', 'okr platform', 'balanced scorecard', 'performance tracking system', 'strategy execution platform', 'performance nexus', 'performance dashboard'],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeywordMatch(searchText: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9]+$/i.test(normalizedKeyword) && normalizedKeyword.length <= 3) {
    return new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i').test(searchText);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedKeyword)}([^a-z0-9]|$)`, 'i').test(searchText);
}

export function detectArchetype(contextOrDescription: string | ArchetypeDetectionContext, projectType?: string): string {
  let searchText: string;
  let organizationHint: string | undefined;
  
  if (typeof contextOrDescription === 'string') {
    searchText = `${contextOrDescription} ${projectType || ''}`.toLowerCase();
  } else {
    const ctx = contextOrDescription;
    searchText = [
      ctx.projectName || '',
      ctx.projectDescription || '',
      ctx.projectType || '',
      ctx.objectives || '',
      ctx.problemStatement || '',
      ctx.organization || ''
    ].join(' ').toLowerCase();
    organizationHint = ctx.organization?.toLowerCase();
  }
  
  // PRIORITY 1: Check for HIGH SPECIFICITY keywords first (exact domain matches)
  // These are very specific terms that definitively identify an archetype
  for (const [archetypeName, keywords] of Object.entries(HIGH_SPECIFICITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (hasKeywordMatch(searchText, keyword)) {
        console.log(`[Archetype Detection] HIGH SPECIFICITY match: "${keyword}" -> ${archetypeName}`);
        return archetypeName;
      }
    }
  }
  
  // PRIORITY 2: Check keyword matches with weighted scoring
  // Longer/more specific keywords get higher scores
  let bestMatch = { name: DEFAULT_ARCHETYPE, score: 0, keywords: [] as string[] };
  
  for (const [archetypeName, config] of Object.entries(PROJECT_ARCHETYPES)) {
    let totalScore = 0;
    const matchedKeywords: string[] = [];
    
    for (const keyword of config.keywords) {
      if (hasKeywordMatch(searchText, keyword)) {
        matchedKeywords.push(keyword);
        // Weight by keyword length - more specific keywords get higher scores
        const keywordWeight = keyword.length >= 10 ? 3 : (keyword.length >= 6 ? 2 : 1);
        totalScore += keywordWeight;
      }
    }
    
    if (totalScore > bestMatch.score) {
      bestMatch = { name: archetypeName, score: totalScore, keywords: matchedKeywords };
    }
  }
  
  if (bestMatch.score > 0) {
    console.log(`[Archetype Detection] Best match: ${bestMatch.name} (weighted score: ${bestMatch.score}, keywords: ${bestMatch.keywords.join(', ')})`);
    return bestMatch.name;
  }
  
  // PRIORITY 3: Fall back to organization-based matching only if no keywords matched
  // Use word boundary matching to avoid false positives (e.g., "du" inside "Dubai")
  if (organizationHint) {
    for (const [orgKey, archetype] of Object.entries(ORGANIZATION_TO_SECTOR)) {
      // For short keys (<=3 chars), require word boundary match to avoid substring false positives
      if (orgKey.length <= 3) {
        const wordBoundaryRegex = new RegExp(`\\b${orgKey}\\b`, 'i');
        if (wordBoundaryRegex.test(organizationHint)) {
          console.log(`[Archetype Detection] Organization match (exact): "${orgKey}" -> ${archetype}`);
          return archetype;
        }
      } else if (organizationHint.includes(orgKey)) {
        console.log(`[Archetype Detection] Organization match: "${orgKey}" -> ${archetype}`);
        return archetype;
      }
    }
  }
  
  return DEFAULT_ARCHETYPE;
}

export function getArchetypeAssumptions(archetypeName: string): ArchetypeAssumptions {
  const archetype = (PROJECT_ARCHETYPES[archetypeName] || PROJECT_ARCHETYPES[DEFAULT_ARCHETYPE])!;
  return archetype.assumptions;
}

export function getArchetypeConfig(archetypeName: string): ArchetypeConfig {
  return (PROJECT_ARCHETYPES[archetypeName] || PROJECT_ARCHETYPES[DEFAULT_ARCHETYPE])!;
}
