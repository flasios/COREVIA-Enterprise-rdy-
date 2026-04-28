import { ReactNode } from "react";
import {
  TrendingUp, MessageSquare, Lightbulb, Award, Sparkles,
  Target, Users, Shield, Settings, Layers, Search, Globe,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import type { TFunction } from "i18next";
import i18next from "i18next";

// ============================================================================
// TYPES
// ============================================================================

export interface GatewayService {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  isActive: boolean;
}

export interface AssessmentService {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: ReactNode;
  color: string;
  isActive: boolean;
}

export interface Framework {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  color: string;
  rating: number;
  metrics: string[];
  duration: string;
  details: string;
}

export interface ProcessStage {
  id: number;
  name: string;
  description: string;
  duration: string;
  status: string;
}

export interface RACIItem {
  role: string;
  responsible: boolean;
  accountable: boolean;
  consulted: boolean;
  informed: boolean;
}

export interface ApprovalLevel {
  level: number;
  authority: string;
  threshold: string;
  autoApprove: boolean;
}

export interface SubServiceMetrics {
  label: string;
  value: string;
  status: string;
}

export interface DetailedMetrics {
  slaCompliance: number;
  avgProcessingDays: number;
  pendingApproval: number;
  thisMonth: number;
  priorityBreakdown: { high: number; medium: number; low: number };
  recentActivity: Array<{ action: string; time: string; user: string; type: string }>;
  quickStats: Array<{ label: string; value: string }>;
}

export interface ProcessFlow {
  title: string;
  stages: ProcessStage[];
  raci: RACIItem[];
  sla: { target: string; warning: string; critical: string };
  approvalLevels: ApprovalLevel[];
}

export interface DemandSubService {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
  metrics: SubServiceMetrics;
  detailedMetrics: DetailedMetrics;
  processFlow: ProcessFlow;
}

export interface AssessmentSubService {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  executiveSummary: string;
  icon: ReactNode;
  color: string;
  colorClass: string;
  kpis: string[];
  metrics: { label: string; value: string; status: string };
}

export interface DemandKpis {
  total: number;
  pending: number;
  approved: number;
  converted: number;
  rejected: number;
  inReview: number;
  pendingApproval: number;
  createdThisMonth: number;
  avgProcessingDays: number;
  slaCompliancePercent: number;
  priorityBreakdown: { high: number; medium: number; low: number; critical: number };
}

// ============================================================================
// ASSESSMENT SERVICES
// ============================================================================

export const assessmentServices: AssessmentService[] = [
  {
    id: "intelligent-frameworks",
    title: "Intelligent Frameworks",
    shortTitle: "Frameworks",
    description: "AI-powered organizational maturity and capability assessments",
    icon: <Layers className="h-4 w-4" />,
    color: "violet",
    isActive: true
  },
  {
    id: "intelligent-iso",
    title: "Intelligent ISO",
    shortTitle: "ISO",
    description: "ISO standards compliance and certification management",
    icon: <Shield className="h-4 w-4" />,
    color: "emerald",
    isActive: true
  },
  {
    id: "intelligent-auditor",
    title: "Intelligent Auditor",
    shortTitle: "Auditor",
    description: "AI-assisted audit planning and execution platform",
    icon: <Search className="h-4 w-4" />,
    color: "blue",
    isActive: true
  }
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAssessmentServices(t: TFunction<any, any>): AssessmentService[] {
  return [
    {
      id: "intelligent-frameworks",
      title: t('demand.gateway.assessmentServices.frameworks.title'),
      shortTitle: t('demand.gateway.assessmentServices.frameworks.shortTitle'),
      description: t('demand.gateway.assessmentServices.frameworks.description'),
      icon: <Layers className="h-4 w-4" />,
      color: "violet",
      isActive: true
    },
    {
      id: "intelligent-iso",
      title: t('demand.gateway.assessmentServices.iso.title'),
      shortTitle: t('demand.gateway.assessmentServices.iso.shortTitle'),
      description: t('demand.gateway.assessmentServices.iso.description'),
      icon: <Shield className="h-4 w-4" />,
      color: "emerald",
      isActive: true
    },
    {
      id: "intelligent-auditor",
      title: t('demand.gateway.assessmentServices.auditor.title'),
      shortTitle: t('demand.gateway.assessmentServices.auditor.shortTitle'),
      description: t('demand.gateway.assessmentServices.auditor.description'),
      icon: <Search className="h-4 w-4" />,
      color: "blue",
      isActive: true
    }
  ];
}

// ============================================================================
// FRAMEWORK DATA BY DIMENSION
// ============================================================================

export const frameworksByDimension: Record<string, Framework[]> = {
  "dubai-by-design": [
    { id: "dubai-digital-maturity", title: "Dubai Digital Maturity Model", shortTitle: "Dubai Digital Maturity", description: "Smart Dubai's digital transformation assessment framework", icon: "Globe", color: "amber", rating: 5, metrics: ["5 Maturity Levels", "8 Dimensions"], duration: "3-4 weeks", details: "Smart Dubai's comprehensive framework measuring government entity digital maturity across citizen services, data management, and smart infrastructure aligned with Dubai's vision to become the smartest city globally." },
    { id: "dgep", title: "Dubai Government Excellence Program", shortTitle: "DGEP", description: "Government excellence and innovation awards framework", icon: "Trophy", color: "violet", rating: 5, metrics: ["9 Categories", "Excellence Awards"], duration: "4-6 weeks", details: "The Dubai Government Excellence Program (DGEP) framework evaluates government entities across service excellence, innovation, and employee happiness aligned with His Highness Sheikh Mohammed's vision." },
    { id: "dubai-10x", title: "Dubai 10X Initiative", shortTitle: "Dubai 10X", description: "Disruptive innovation and future-readiness assessment", icon: "Sparkles", color: "emerald", rating: 5, metrics: ["Future Readiness", "10-Year Leap"], duration: "2-3 weeks", details: "Dubai 10X framework assesses organizational capability to implement disruptive innovations that position Dubai 10 years ahead of other global cities through emerging technologies." },
    { id: "uae-vision-2071", title: "UAE Centennial 2071", shortTitle: "UAE 2071", description: "Long-term strategic alignment with UAE's centennial goals", icon: "Target", color: "sky", rating: 5, metrics: ["4 Pillars", "50-Year Vision"], duration: "2-3 weeks", details: "Assessment framework aligned with UAE Centennial 2071 pillars: Future-focused Government, Excellent Education, Diversified Economy, and Happy Cohesive Society." },
    { id: "smart-dubai", title: "Smart Dubai Index", shortTitle: "Smart Dubai", description: "Smart city transformation and happiness measurement", icon: "Brain", color: "indigo", rating: 4, metrics: ["Happiness Index", "Smart Services"], duration: "2-3 weeks", details: "Measures entity contribution to Dubai's smart city transformation including digital services adoption, data sharing, and citizen happiness metrics." },
    { id: "dubai-data-law", title: "Dubai Data Law Framework", shortTitle: "Dubai Data Law", description: "Data governance aligned with Dubai Data Law", icon: "Shield", color: "rose", rating: 5, metrics: ["Data Classification", "Sharing Protocols"], duration: "2-3 weeks", details: "Framework ensuring compliance with Dubai Data Law for data classification, sharing, and protection across government entities." },
    { id: "dubai-paperless", title: "Dubai Paperless Strategy", shortTitle: "Paperless Strategy", description: "Digital-first government services assessment", icon: "FileText", color: "blue", rating: 4, metrics: ["Digitization Rate", "Paper Reduction"], duration: "2-3 weeks", details: "Measures progress toward Dubai's paperless government initiative including digital transactions and document management." },
    { id: "dubai-blockchain", title: "Dubai Blockchain Strategy", shortTitle: "Blockchain Strategy", description: "Blockchain adoption and implementation readiness", icon: "Layers", color: "purple", rating: 5, metrics: ["Use Cases", "Implementation Readiness"], duration: "3-4 weeks", details: "Assessment framework for Dubai's Blockchain Strategy aiming to make Dubai the first blockchain-powered government by 2025." },
    { id: "uae-we-the-people", title: "UAE We the People 2031", shortTitle: "We the People 2031", description: "Social development and community well-being", icon: "Users", color: "teal", rating: 4, metrics: ["Social Cohesion", "Community Engagement"], duration: "2-3 weeks", details: "Framework aligned with UAE's social development agenda focusing on community well-being, social cohesion, and quality of life." },
  ],
  "strategy-leadership": [
    { id: "mckinsey-dq", title: "McKinsey Digital Quotient (DQ)", shortTitle: "McKinsey DQ", description: "Digital strategy assessment across 18 management practices", icon: "Compass", color: "violet", rating: 5, metrics: ["18 Dimensions", "150+ Questions"], duration: "2-3 weeks", details: "The McKinsey Digital Quotient is a comprehensive assessment framework measuring organizational digital maturity across 18 management practices. Developed by McKinsey & Company, it benchmarks your organization against 1,500+ global enterprises." },
    { id: "gartner-it", title: "Gartner IT Score", shortTitle: "Gartner IT Score", description: "IT leadership effectiveness and peer benchmarking", icon: "BarChart", color: "blue", rating: 4, metrics: ["12 Competencies", "Peer Benchmark"], duration: "1-2 weeks", details: "Gartner IT Score evaluates IT leadership effectiveness across 12 key competencies with global peer benchmarking against thousands of organizations." },
    { id: "efqm", title: "EFQM Excellence Model", shortTitle: "EFQM Excellence", description: "European excellence framework for sustainable transformation", icon: "Trophy", color: "emerald", rating: 5, metrics: ["7 Criteria", "32 Sub-criteria"], duration: "3-4 weeks", details: "European foundation framework assessing leadership, strategy, and stakeholder value creation. Used by 50,000+ organizations globally." },
    { id: "bsc", title: "Balanced Scorecard Strategic", shortTitle: "Balanced Scorecard", description: "Strategic execution across 4 perspectives", icon: "Target", color: "amber", rating: 4, metrics: ["4 Perspectives", "20+ KPIs"], duration: "1-2 weeks", details: "Kaplan-Norton framework evaluating strategy execution across financial, customer, process, and learning perspectives." },
    { id: "bcg-digital", title: "BCG Digital Acceleration Index", shortTitle: "BCG DAI", description: "Digital transformation acceleration measurement", icon: "Zap", color: "rose", rating: 5, metrics: ["35 Enablers", "Benchmark"], duration: "2-3 weeks", details: "Boston Consulting Group's framework measuring digital acceleration across technology, people, and processes with industry benchmarking." },
    { id: "deloitte-dmi", title: "Deloitte Digital Maturity Index", shortTitle: "Deloitte DMI", description: "Enterprise-wide digital maturity assessment", icon: "Layers", color: "indigo", rating: 4, metrics: ["5 Dimensions", "Maturity Levels"], duration: "2-3 weeks", details: "Deloitte's comprehensive digital maturity framework evaluating customer, strategy, technology, operations, and culture dimensions." },
    { id: "porter-five-forces", title: "Porter's Five Forces", shortTitle: "Porter's Five Forces", description: "Competitive strategy and industry analysis", icon: "Target", color: "sky", rating: 5, metrics: ["5 Forces", "Industry Analysis"], duration: "1-2 weeks", details: "Michael Porter's framework for analyzing competitive forces in an industry to inform strategic positioning and decision-making." },
    { id: "okr-framework", title: "OKR Framework", shortTitle: "OKR", description: "Objectives and Key Results goal-setting", icon: "Target", color: "purple", rating: 5, metrics: ["Objectives", "Key Results"], duration: "1-2 weeks", details: "Goal-setting framework popularized by Google for aligning organizational objectives with measurable key results." },
    { id: "hoshin-kanri", title: "Hoshin Kanri", shortTitle: "Hoshin Kanri", description: "Strategic policy deployment methodology", icon: "Compass", color: "teal", rating: 4, metrics: ["X-Matrix", "Catchball Process"], duration: "2-3 weeks", details: "Japanese strategic planning methodology for aligning organizational goals with tactical initiatives through systematic deployment." },
    { id: "palladium-strategy", title: "Palladium Strategy Execution", shortTitle: "Palladium", description: "Strategy execution and management system", icon: "Award", color: "orange", rating: 5, metrics: ["Strategy Maps", "Execution Premium"], duration: "3-4 weeks", details: "Comprehensive strategy execution framework by Palladium Group focusing on translating strategy into operational objectives." },
  ],
  "people-culture": [
    { id: "adkar", title: "Prosci ADKAR Model", shortTitle: "ADKAR", description: "Individual change readiness assessment", icon: "Users", color: "sky", rating: 5, metrics: ["5 Stages", "40 Questions"], duration: "1-2 weeks", details: "Measures Awareness, Desire, Knowledge, Ability, and Reinforcement across workforce transformation initiatives." },
    { id: "korn-ferry", title: "Korn Ferry Leadership", shortTitle: "Korn Ferry", description: "Leadership competency assessment", icon: "Award", color: "violet", rating: 5, metrics: ["38 Competencies", "360 Review"], duration: "2-3 weeks", details: "Comprehensive leadership competency framework with 360-degree assessment capabilities." },
    { id: "gallup-q12", title: "Gallup Q12 Engagement", shortTitle: "Gallup Q12", description: "Employee engagement measurement", icon: "Users", color: "emerald", rating: 4, metrics: ["12 Questions", "Benchmark"], duration: "1 week", details: "Industry-standard employee engagement survey measuring 12 key engagement elements." },
    { id: "bersin-talent", title: "Bersin Talent Maturity", shortTitle: "Bersin Talent", description: "Talent management and HR transformation", icon: "Users", color: "amber", rating: 5, metrics: ["4 Levels", "HR Practices"], duration: "2-3 weeks", details: "Deloitte Bersin framework for assessing talent acquisition, development, and retention maturity." },
    { id: "culture-amp", title: "Culture Amp Assessment", shortTitle: "Culture Amp", description: "Employee experience and culture measurement", icon: "Award", color: "rose", rating: 4, metrics: ["Culture Drivers", "Benchmarks"], duration: "1-2 weeks", details: "Data-driven culture and employee experience assessment with global benchmarking." },
    { id: "hogan-assessment", title: "Hogan Leadership Assessment", shortTitle: "Hogan", description: "Personality-based leadership potential", icon: "Brain", color: "indigo", rating: 5, metrics: ["Personality Scales", "Derailment Risks"], duration: "1-2 weeks", details: "Scientific personality assessment for leadership selection and development." },
    { id: "ddi-leadership", title: "DDI Leadership Assessment", shortTitle: "DDI Leadership", description: "Leadership potential and readiness evaluation", icon: "Award", color: "blue", rating: 5, metrics: ["Leadership Potential", "Readiness Levels"], duration: "2-3 weeks", details: "Development Dimensions International's framework for assessing leadership potential, readiness, and development needs." },
    { id: "lominger-competency", title: "Lominger Competency Model", shortTitle: "Lominger", description: "67 leadership competencies framework", icon: "Users", color: "purple", rating: 5, metrics: ["67 Competencies", "Career Stallers"], duration: "2-3 weeks", details: "Korn Ferry's Lominger competency framework covering 67 competencies and career stallers for leadership development." },
    { id: "great-place-work", title: "Great Place to Work", shortTitle: "Great Place to Work", description: "Workplace culture and trust assessment", icon: "Trophy", color: "teal", rating: 4, metrics: ["Trust Index", "Culture Audit"], duration: "2-3 weeks", details: "Globally recognized certification framework measuring workplace culture, trust, and employee satisfaction." },
    { id: "mercer-hr", title: "Mercer HR Transformation", shortTitle: "Mercer HR", description: "HR operating model and service delivery", icon: "Settings", color: "orange", rating: 4, metrics: ["HR Efficiency", "Service Delivery"], duration: "3-4 weeks", details: "Mercer's framework for evaluating HR operating model effectiveness, service delivery, and transformation readiness." },
  ],
  "process-operations": [
    { id: "cmmi", title: "CMMI Maturity Model", shortTitle: "CMMI", description: "Process capability maturity assessment", icon: "Layers", color: "indigo", rating: 5, metrics: ["5 Levels", "22 Areas"], duration: "4-6 weeks", details: "Capability Maturity Model Integration for assessing process improvement across development and services." },
    { id: "lean-six-sigma", title: "Lean Six Sigma", shortTitle: "Lean Six Sigma", description: "Operational excellence evaluation", icon: "Zap", color: "emerald", rating: 4, metrics: ["DMAIC Process", "Waste Analysis"], duration: "2-3 weeks", details: "Combines lean manufacturing principles with Six Sigma methodology for operational excellence." },
    { id: "bpm-maturity", title: "BPM Maturity Model", shortTitle: "BPM Maturity", description: "Business process management assessment", icon: "Settings", color: "blue", rating: 4, metrics: ["6 Dimensions", "5 Levels"], duration: "2-3 weeks", details: "Evaluates business process management capabilities across strategic alignment, governance, and technology." },
    { id: "apqc-pcf", title: "APQC Process Classification", shortTitle: "APQC PCF", description: "Process benchmarking and best practices", icon: "BarChart", color: "violet", rating: 5, metrics: ["13 Categories", "1,500+ Processes"], duration: "3-4 weeks", details: "APQC's Process Classification Framework for benchmarking operational processes against best-in-class organizations." },
    { id: "scor-model", title: "SCOR Supply Chain Model", shortTitle: "SCOR", description: "Supply chain operations reference", icon: "Globe", color: "amber", rating: 4, metrics: ["6 Processes", "Metrics"], duration: "3-4 weeks", details: "Supply Chain Operations Reference model for evaluating and improving supply chain performance." },
    { id: "tqm", title: "Total Quality Management", shortTitle: "TQM", description: "Organization-wide quality excellence", icon: "Trophy", color: "rose", rating: 4, metrics: ["8 Principles", "Continuous Improvement"], duration: "4-6 weeks", details: "Comprehensive quality management approach focusing on continuous improvement and customer satisfaction." },
    { id: "iso-9001", title: "ISO 9001 Quality Management", shortTitle: "ISO 9001", description: "Quality management system standards", icon: "Shield", color: "sky", rating: 5, metrics: ["10 Clauses", "PDCA Cycle"], duration: "4-6 weeks", details: "International standard for quality management systems ensuring consistent quality and continuous improvement." },
    { id: "kaizen", title: "Kaizen Continuous Improvement", shortTitle: "Kaizen", description: "Continuous incremental improvement methodology", icon: "TrendingUp", color: "purple", rating: 4, metrics: ["PDCA Cycle", "Gemba Walks"], duration: "2-3 weeks", details: "Japanese philosophy of continuous incremental improvement involving all employees in process optimization." },
    { id: "theory-constraints", title: "Theory of Constraints (TOC)", shortTitle: "TOC", description: "Constraint-focused process improvement", icon: "Target", color: "teal", rating: 4, metrics: ["5 Focusing Steps", "Throughput"], duration: "2-3 weeks", details: "Eliyahu Goldratt's methodology for identifying and eliminating constraints that limit organizational performance." },
    { id: "value-stream-mapping", title: "Value Stream Mapping", shortTitle: "Value Stream", description: "End-to-end process flow analysis", icon: "Activity", color: "orange", rating: 4, metrics: ["Current State", "Future State"], duration: "1-2 weeks", details: "Lean management tool for analyzing and designing material and information flow required to deliver products or services." },
  ],
  "technology-infrastructure": [
    { id: "togaf", title: "TOGAF Architecture", shortTitle: "TOGAF", description: "Enterprise architecture maturity", icon: "Building2", color: "indigo", rating: 5, metrics: ["ADM Phases", "Architecture"], duration: "4-6 weeks", details: "The Open Group Architecture Framework for developing enterprise architecture capabilities." },
    { id: "cloud-maturity", title: "Cloud Adoption Maturity", shortTitle: "Cloud Maturity", description: "Cloud readiness and migration assessment", icon: "Globe", color: "sky", rating: 4, metrics: ["6 Pillars", "Best Practices"], duration: "2-3 weeks", details: "Evaluates cloud adoption readiness across security, operations, reliability, and cost optimization." },
    { id: "itil", title: "ITIL Service Management", shortTitle: "ITIL", description: "IT service management practices", icon: "Settings", color: "purple", rating: 5, metrics: ["34 Practices", "4 Dimensions"], duration: "3-4 weeks", details: "IT Infrastructure Library framework for IT service management best practices." },
    { id: "aws-well-architected", title: "AWS Well-Architected", shortTitle: "AWS Well-Arch", description: "Cloud architecture best practices", icon: "Globe", color: "amber", rating: 5, metrics: ["6 Pillars", "Best Practices"], duration: "2-3 weeks", details: "Amazon's framework for building secure, high-performing, resilient, and efficient cloud infrastructure." },
    { id: "azure-caf", title: "Azure Cloud Adoption", shortTitle: "Azure CAF", description: "Microsoft cloud adoption framework", icon: "Globe", color: "blue", rating: 5, metrics: ["8 Stages", "Landing Zones"], duration: "3-4 weeks", details: "Microsoft's proven guidance for cloud adoption including strategy, planning, and governance." },
    { id: "devops-maturity", title: "DevOps Maturity Model", shortTitle: "DevOps", description: "DevOps practices and automation", icon: "Zap", color: "emerald", rating: 4, metrics: ["5 Levels", "CI/CD Practices"], duration: "2-3 weeks", details: "Assessment of DevOps capabilities including continuous integration, delivery, and monitoring." },
    { id: "zachman-framework", title: "Zachman Framework", shortTitle: "Zachman", description: "Enterprise architecture classification", icon: "Layers", color: "violet", rating: 5, metrics: ["6x6 Matrix", "Perspectives"], duration: "4-6 weeks", details: "John Zachman's enterprise architecture framework using a 6x6 matrix for comprehensive architectural classification." },
    { id: "feaf", title: "Federal Enterprise Architecture", shortTitle: "FEAF", description: "Government enterprise architecture standard", icon: "Building2", color: "rose", rating: 5, metrics: ["5 Reference Models", "Government Standards"], duration: "4-6 weeks", details: "U.S. Federal Enterprise Architecture Framework providing government-wide guidance for IT architecture." },
    { id: "safe-architecture", title: "SAFe for Architecture", shortTitle: "SAFe Architecture", description: "Agile enterprise architecture practices", icon: "Layers", color: "teal", rating: 4, metrics: ["Architectural Runway", "Agile Teams"], duration: "3-4 weeks", details: "Scaled Agile Framework's approach to enterprise architecture enabling agility while maintaining architectural integrity." },
    { id: "microservices-maturity", title: "Microservices Maturity", shortTitle: "Microservices", description: "Microservices architecture assessment", icon: "Zap", color: "orange", rating: 4, metrics: ["5 Levels", "Service Decomposition"], duration: "2-3 weeks", details: "Assessment framework for evaluating microservices architecture adoption, service decomposition, and operational maturity." },
  ],
  "data-intelligence": [
    { id: "dama-dmbok", title: "DAMA-DMBOK Data Management", shortTitle: "DAMA-DMBOK", description: "Data management body of knowledge", icon: "Brain", color: "indigo", rating: 5, metrics: ["11 Knowledge Areas", "Governance"], duration: "3-4 weeks", details: "Comprehensive data management framework covering governance, quality, architecture, and security." },
    { id: "ai-readiness", title: "AI/ML Readiness Assessment", shortTitle: "AI Readiness", description: "Artificial intelligence adoption readiness", icon: "Sparkles", color: "violet", rating: 4, metrics: ["Data Quality", "Infrastructure"], duration: "2-3 weeks", details: "Evaluates organizational readiness for AI/ML adoption across data, talent, and infrastructure." },
    { id: "analytics-maturity", title: "Analytics Maturity Model", shortTitle: "Analytics Maturity", description: "Business analytics capabilities", icon: "BarChart", color: "blue", rating: 4, metrics: ["5 Levels", "Descriptive to Prescriptive"], duration: "2 weeks", details: "Assesses analytics maturity from descriptive through predictive to prescriptive analytics." },
    { id: "cdmc", title: "Cloud Data Management", shortTitle: "CDMC", description: "Cloud data management capabilities", icon: "Globe", color: "sky", rating: 5, metrics: ["6 Components", "Best Practices"], duration: "2-3 weeks", details: "EDM Council's Cloud Data Management Capabilities framework for governing data in cloud environments." },
    { id: "dcam", title: "Data Management Capability", shortTitle: "DCAM", description: "Enterprise data management maturity", icon: "Layers", color: "emerald", rating: 5, metrics: ["8 Capabilities", "37 Components"], duration: "3-4 weeks", details: "EDM Council's Data Management Capability Assessment Model for financial services and enterprises." },
    { id: "tdwi-analytics", title: "TDWI Analytics Maturity", shortTitle: "TDWI", description: "Business intelligence and analytics", icon: "BarChart", color: "amber", rating: 4, metrics: ["5 Stages", "BI Maturity"], duration: "2-3 weeks", details: "TDWI's framework for assessing business intelligence and analytics program maturity." },
    { id: "data-mesh", title: "Data Mesh Framework", shortTitle: "Data Mesh", description: "Decentralized data architecture", icon: "Globe", color: "rose", rating: 5, metrics: ["Domain Ownership", "Self-Serve Platform"], duration: "3-4 weeks", details: "Zhamak Dehghani's framework for decentralized data architecture with domain-oriented ownership and self-serve data infrastructure." },
    { id: "dataops-maturity", title: "DataOps Maturity Model", shortTitle: "DataOps", description: "Data operations and automation", icon: "Zap", color: "purple", rating: 4, metrics: ["Automation Level", "Data Pipeline"], duration: "2-3 weeks", details: "Framework for assessing DataOps practices including automated data pipelines, testing, and deployment." },
    { id: "fair-data", title: "FAIR Data Principles", shortTitle: "FAIR Data", description: "Findable, Accessible, Interoperable, Reusable", icon: "Target", color: "teal", rating: 5, metrics: ["4 Principles", "15 Metrics"], duration: "2-3 weeks", details: "Assessment framework for FAIR data principles ensuring data is Findable, Accessible, Interoperable, and Reusable." },
    { id: "data-literacy", title: "Data Literacy Framework", shortTitle: "Data Literacy", description: "Organizational data literacy assessment", icon: "Users", color: "orange", rating: 4, metrics: ["Literacy Levels", "Training Needs"], duration: "2-3 weeks", details: "Framework for assessing and developing organizational data literacy skills across all employee levels." },
  ],
  "governance-security": [
    { id: "iso-27001", title: "ISO 27001 Security", shortTitle: "ISO 27001", description: "Information security management", icon: "Shield", color: "rose", rating: 5, metrics: ["114 Controls", "14 Domains"], duration: "4-6 weeks", details: "International standard for information security management systems (ISMS)." },
    { id: "nist-csf", title: "NIST Cybersecurity Framework", shortTitle: "NIST CSF", description: "Cybersecurity risk management", icon: "Shield", color: "sky", rating: 5, metrics: ["5 Functions", "23 Categories"], duration: "3-4 weeks", details: "Comprehensive cybersecurity framework covering Identify, Protect, Detect, Respond, and Recover." },
    { id: "cobit", title: "COBIT IT Governance", shortTitle: "COBIT", description: "IT governance framework", icon: "Settings", color: "indigo", rating: 4, metrics: ["40 Objectives", "5 Domains"], duration: "3-4 weeks", details: "Control Objectives for Information Technologies - IT governance and management framework." },
    { id: "cis-controls", title: "CIS Critical Controls", shortTitle: "CIS Controls", description: "Prioritized cybersecurity actions", icon: "Shield", color: "emerald", rating: 5, metrics: ["18 Controls", "Safeguards"], duration: "2-3 weeks", details: "Center for Internet Security's prioritized set of actions to protect against cyber attacks." },
    { id: "sox-compliance", title: "SOX Compliance", shortTitle: "SOX", description: "Financial reporting controls", icon: "FileText", color: "amber", rating: 4, metrics: ["Internal Controls", "Audit Trail"], duration: "4-6 weeks", details: "Sarbanes-Oxley compliance assessment for financial reporting and internal controls." },
    { id: "gdpr-privacy", title: "GDPR Privacy Assessment", shortTitle: "GDPR", description: "Data privacy and protection", icon: "Shield", color: "violet", rating: 5, metrics: ["8 Rights", "Privacy Impact"], duration: "3-4 weeks", details: "General Data Protection Regulation compliance assessment for data privacy and protection." },
    { id: "iso-22301", title: "ISO 22301 Business Continuity", shortTitle: "ISO 22301", description: "Business continuity management", icon: "Shield", color: "blue", rating: 5, metrics: ["BCM Lifecycle", "BIA"], duration: "4-6 weeks", details: "International standard for business continuity management systems ensuring organizational resilience." },
    { id: "pci-dss", title: "PCI DSS Compliance", shortTitle: "PCI DSS", description: "Payment card industry data security", icon: "Shield", color: "purple", rating: 5, metrics: ["12 Requirements", "400+ Controls"], duration: "4-6 weeks", details: "Payment Card Industry Data Security Standard for protecting cardholder data and securing payment systems." },
    { id: "zero-trust", title: "Zero Trust Maturity Model", shortTitle: "Zero Trust", description: "Zero trust security architecture", icon: "Shield", color: "teal", rating: 5, metrics: ["5 Pillars", "Maturity Stages"], duration: "3-4 weeks", details: "CISA's Zero Trust Maturity Model for implementing never trust, always verify security architecture." },
    { id: "coso-erm", title: "COSO ERM Framework", shortTitle: "COSO ERM", description: "Enterprise risk management", icon: "Target", color: "orange", rating: 5, metrics: ["5 Components", "20 Principles"], duration: "4-6 weeks", details: "Committee of Sponsoring Organizations' Enterprise Risk Management framework for comprehensive risk governance." },
  ],
};

// ============================================================================
// GATEWAY SERVICES
// ============================================================================

export const services: GatewayService[] = [
  {
    id: "intelligent-demand",
    title: "Intelligent Demand",
    description: "Comprehensive demand analysis and insights platform",
    icon: <TrendingUp className="h-6 w-6" />,
    color: "bg-blue-500",
    isActive: true
  },
  {
    id: "intelligent-assessments",
    title: "Intelligent Assessments",
    description: "AI-powered organizational maturity and capability assessments",
    icon: <Award className="h-6 w-6" />,
    color: "bg-violet-500",
    isActive: true
  },
  {
    id: "intelligent-workspace",
    title: "Intelligent Workspace",
    description: "Mission rooms, delivery studios, and sovereign-ready orchestration spaces",
    icon: <Sparkles className="h-6 w-6" />,
    color: "bg-amber-500",
    isActive: true
  }
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildServices(t: TFunction<any, any>): GatewayService[] {
  return [
    {
      id: "intelligent-demand",
      title: t('demand.gateway.services.intelligentDemand.title'),
      description: t('demand.gateway.services.intelligentDemand.description'),
      icon: <TrendingUp className="h-6 w-6" />,
      color: "bg-blue-500",
      isActive: true
    },
    {
      id: "intelligent-assessments",
      title: t('demand.gateway.services.intelligentAssessments.title'),
      description: t('demand.gateway.services.intelligentAssessments.description'),
      icon: <Award className="h-6 w-6" />,
      color: "bg-violet-500",
      isActive: true
    },
    {
      id: "intelligent-workspace",
      title: "Intelligent Workspace",
      description: "Mission rooms, delivery studios, and sovereign-ready orchestration spaces",
      icon: <Sparkles className="h-6 w-6" />,
      color: "bg-amber-500",
      isActive: true
    }
  ];
}

// ============================================================================
// ASSESSMENT SUB-SERVICES (DIMENSIONS)
// ============================================================================

export function getAssessmentSubServices(): AssessmentSubService[] {
  const t = i18next.t.bind(i18next);
  return [
  {
    id: "dubai-by-design",
    title: t('demand.gateway.data.dims.dubaiByDesign.title'),
    shortTitle: t('demand.gateway.data.dims.dubaiByDesign.shortTitle'),
    description: t('demand.gateway.data.dims.dubaiByDesign.description'),
    executiveSummary: t('demand.gateway.data.dims.dubaiByDesign.executiveSummary'),
    icon: <Globe className="h-5 w-5" />,
    color: "amber",
    colorClass: "bg-amber-500",
    kpis: [t('demand.gateway.data.kpis.digitalMaturity'), t('demand.gateway.data.kpis.excellenceScore'), t('demand.gateway.data.kpis.innovationIndex')],
    metrics: { label: t('demand.gateway.data.metricsLabels.uaeFrameworks'), value: "5", status: t('demand.gateway.data.metricsLabels.dubaiAligned') }
  },
  {
    id: "strategy-leadership",
    title: t('demand.gateway.data.dims.strategyLeadership.title'),
    shortTitle: t('demand.gateway.data.dims.strategyLeadership.shortTitle'),
    description: t('demand.gateway.data.dims.strategyLeadership.description'),
    executiveSummary: t('demand.gateway.data.dims.strategyLeadership.executiveSummary'),
    icon: <Target className="h-5 w-5" />,
    color: "violet",
    colorClass: "bg-violet-500",
    kpis: [t('demand.gateway.data.kpis.visionClarity'), t('demand.gateway.data.kpis.executiveAlignment'), t('demand.gateway.data.kpis.roadmapMaturity')],
    metrics: { label: t('demand.gateway.data.metricsLabels.dimensions'), value: "8", status: t('demand.gateway.data.metricsLabels.visionClarityScore') }
  },
  {
    id: "people-culture",
    title: t('demand.gateway.data.dims.peopleCulture.title'),
    shortTitle: t('demand.gateway.data.dims.peopleCulture.shortTitle'),
    description: t('demand.gateway.data.dims.peopleCulture.description'),
    executiveSummary: t('demand.gateway.data.dims.peopleCulture.executiveSummary'),
    icon: <Users className="h-5 w-5" />,
    color: "sky",
    colorClass: "bg-sky-500",
    kpis: [t('demand.gateway.data.kpis.digitalFluency'), t('demand.gateway.data.kpis.changeReadiness'), t('demand.gateway.data.kpis.innovationCulture')],
    metrics: { label: t('demand.gateway.data.metricsLabels.competencies'), value: "12", status: t('demand.gateway.data.metricsLabels.skillGapAnalysis') }
  },
  {
    id: "process-operations",
    title: t('demand.gateway.data.dims.processOperations.title'),
    shortTitle: t('demand.gateway.data.dims.processOperations.shortTitle'),
    description: t('demand.gateway.data.dims.processOperations.description'),
    executiveSummary: t('demand.gateway.data.dims.processOperations.executiveSummary'),
    icon: <Settings className="h-5 w-5" />,
    color: "emerald",
    colorClass: "bg-emerald-500",
    kpis: [t('demand.gateway.data.kpis.automationIndex'), t('demand.gateway.data.kpis.processEfficiency'), t('demand.gateway.data.kpis.qualityScore')],
    metrics: { label: t('demand.gateway.data.metricsLabels.processes'), value: "24", status: t('demand.gateway.data.metricsLabels.automationIndexLabel') }
  },
  {
    id: "technology-infrastructure",
    title: t('demand.gateway.data.dims.technologyInfrastructure.title'),
    shortTitle: t('demand.gateway.data.dims.technologyInfrastructure.shortTitle'),
    description: t('demand.gateway.data.dims.technologyInfrastructure.description'),
    executiveSummary: t('demand.gateway.data.dims.technologyInfrastructure.executiveSummary'),
    icon: <Layers className="h-5 w-5" />,
    color: "orange",
    colorClass: "bg-orange-500",
    kpis: [t('demand.gateway.data.kpis.cloudReadiness'), t('demand.gateway.data.kpis.architectureFlexibility'), t('demand.gateway.data.kpis.techDebtScore')],
    metrics: { label: t('demand.gateway.data.metricsLabels.systems'), value: "18", status: t('demand.gateway.data.metricsLabels.cloudReadinessLabel') }
  },
  {
    id: "data-intelligence",
    title: t('demand.gateway.data.dims.dataIntelligence.title'),
    shortTitle: t('demand.gateway.data.dims.dataIntelligence.shortTitle'),
    description: t('demand.gateway.data.dims.dataIntelligence.description'),
    executiveSummary: t('demand.gateway.data.dims.dataIntelligence.executiveSummary'),
    icon: <HexagonLogoFrame px={20} />,
    color: "indigo",
    colorClass: "bg-indigo-500",
    kpis: [t('demand.gateway.data.kpis.dataQuality'), t('demand.gateway.data.kpis.analyticsMaturity'), t('demand.gateway.data.kpis.aiReadiness')],
    metrics: { label: t('demand.gateway.data.metricsLabels.dataAssets'), value: "32", status: t('demand.gateway.data.metricsLabels.aiReadinessScore') }
  },
  {
    id: "governance-security",
    title: t('demand.gateway.data.dims.governanceSecurity.title'),
    shortTitle: t('demand.gateway.data.dims.governanceSecurity.shortTitle'),
    description: t('demand.gateway.data.dims.governanceSecurity.description'),
    executiveSummary: t('demand.gateway.data.dims.governanceSecurity.executiveSummary'),
    icon: <Shield className="h-5 w-5" />,
    color: "rose",
    colorClass: "bg-rose-500",
    kpis: [t('demand.gateway.data.kpis.complianceScore'), t('demand.gateway.data.kpis.cyberMaturity'), t('demand.gateway.data.kpis.riskPosture')],
    metrics: { label: t('demand.gateway.data.metricsLabels.controls'), value: "45", status: t('demand.gateway.data.metricsLabels.riskPostureLabel') }
  }
];
}

// ============================================================================
// DEMAND SUB-SERVICES FACTORY
// ============================================================================

export function buildDemandSubServices(demandKpis: DemandKpis): DemandSubService[] {
  const t = i18next.t.bind(i18next);
  return [
    {
      id: "demand-request-form",
      title: t('demand.gateway.data.subServices.demandRequestForm.title'),
      description: t('demand.gateway.data.subServices.demandRequestForm.description'),
      icon: <TrendingUp className="h-5 w-5" />,
      color: "bg-emerald-500",
      metrics: {
        label: t('demand.gateway.data.subServices.totalRequests'),
        value: demandKpis.total.toLocaleString(),
        status: t('demand.gateway.data.subServices.pendingApproval', { num: demandKpis.pendingApproval.toLocaleString() })
      },
      detailedMetrics: {
        slaCompliance: Math.round(demandKpis.slaCompliancePercent),
        avgProcessingDays: Number(demandKpis.avgProcessingDays.toFixed(1)),
        pendingApproval: demandKpis.pendingApproval,
        thisMonth: demandKpis.createdThisMonth,
        priorityBreakdown: {
          high: demandKpis.priorityBreakdown.high + demandKpis.priorityBreakdown.critical,
          medium: demandKpis.priorityBreakdown.medium,
          low: demandKpis.priorityBreakdown.low,
        },
        recentActivity: [
          { action: t('demand.gateway.data.activity.newDemandSubmitted'), time: "2 hours ago", user: "Ahmed Al-Rashid", type: "submission" },
          { action: t('demand.gateway.data.activity.businessCaseApproved'), time: "5 hours ago", user: "PMO Office", type: "approval" },
          { action: t('demand.gateway.data.activity.requirementsUpdated'), time: "1 day ago", user: "Sarah Hassan", type: "update" }
        ],
        quickStats: [
          { label: t('demand.gateway.data.quickStats.totalRequests'), value: demandKpis.total.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.inReview'), value: demandKpis.inReview.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.approved'), value: demandKpis.approved.toLocaleString() }
        ]
      },
      processFlow: {
        title: t('demand.gateway.data.process.demandIntakeWorkflow'),
        stages: [
          { id: 1, name: t('demand.gateway.data.stages.initiation'), description: t('demand.gateway.data.stages.initiationDesc'), duration: "1 day", status: "active" },
          { id: 2, name: t('demand.gateway.data.stages.aiAnalysis'), description: t('demand.gateway.data.stages.aiAnalysisDesc'), duration: "2 days", status: "pending" },
          { id: 3, name: t('demand.gateway.data.stages.technicalReview'), description: t('demand.gateway.data.stages.technicalReviewDesc'), duration: "3 days", status: "pending" },
          { id: 4, name: t('demand.gateway.data.stages.governanceApproval'), description: t('demand.gateway.data.stages.governanceApprovalDesc'), duration: "5 days", status: "pending" },
          { id: 5, name: t('demand.gateway.data.stages.portfolioIntegration'), description: t('demand.gateway.data.stages.portfolioIntegrationDesc'), duration: "2 days", status: "pending" }
        ],
        raci: [
          { role: t('demand.gateway.data.raci.requestor'), responsible: true, accountable: false, consulted: false, informed: true },
          { role: t('demand.gateway.data.raci.pmoOffice'), responsible: false, accountable: true, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.technicalLead'), responsible: true, accountable: false, consulted: true, informed: false },
          { role: t('demand.gateway.data.raci.steeringCommittee'), responsible: false, accountable: true, consulted: false, informed: true }
        ],
        sla: { target: "10 business days", warning: "8 days", critical: "12 days" },
        approvalLevels: [
          { level: 1, authority: t('demand.gateway.data.approvalLevels.departmentHead'), threshold: t('demand.gateway.data.thresholds.under500k'), autoApprove: false },
          { level: 2, authority: t('demand.gateway.data.approvalLevels.directorGeneral'), threshold: t('demand.gateway.data.thresholds.range500k2m'), autoApprove: false },
          { level: 3, authority: t('demand.gateway.data.approvalLevels.steeringCommittee'), threshold: t('demand.gateway.data.thresholds.over2m'), autoApprove: false }
        ]
      }
    },
    {
      id: "ims-analysis",
      title: t('demand.gateway.data.subServices.imsAnalysis.title'),
      description: t('demand.gateway.data.subServices.imsAnalysis.description'),
      icon: <HexagonLogoFrame px={20} />,
      color: "bg-purple-500",
      metrics: {
        label: t('demand.gateway.data.subServices.imsReports'),
        value: demandKpis.inReview.toLocaleString(),
        status: t('demand.gateway.data.subServices.pendingApproval', { num: demandKpis.pendingApproval.toLocaleString() })
      },
      detailedMetrics: {
        slaCompliance: Math.round(demandKpis.slaCompliancePercent),
        avgProcessingDays: Number(demandKpis.avgProcessingDays.toFixed(1)),
        pendingApproval: demandKpis.pendingApproval,
        thisMonth: demandKpis.createdThisMonth,
        priorityBreakdown: {
          high: demandKpis.priorityBreakdown.high + demandKpis.priorityBreakdown.critical,
          medium: demandKpis.priorityBreakdown.medium,
          low: demandKpis.priorityBreakdown.low,
        },
        recentActivity: [
          { action: t('demand.gateway.data.activity.processGapIdentified'), time: "3 hours ago", user: "AI Engine", type: "analysis" },
          { action: t('demand.gateway.data.activity.efficiencyReportGenerated'), time: "8 hours ago", user: "System", type: "report" },
          { action: t('demand.gateway.data.activity.integrationAuditCompleted'), time: "2 days ago", user: "Audit Team", type: "audit" }
        ],
        quickStats: [
          { label: t('demand.gateway.data.quickStats.pendingApproval'), value: demandKpis.pendingApproval.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.createdThisMonth'), value: demandKpis.createdThisMonth.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.avgProcessing'), value: `${demandKpis.avgProcessingDays.toFixed(1)}d` }
        ]
      },
      processFlow: {
        title: t('demand.gateway.data.process.imsAnalysisProcedure'),
        stages: [
          { id: 1, name: t('demand.gateway.data.stages.dataCollection'), description: t('demand.gateway.data.stages.dataCollectionDesc'), duration: "2 days", status: "active" },
          { id: 2, name: t('demand.gateway.data.stages.aiProcessing'), description: t('demand.gateway.data.stages.aiProcessingDesc'), duration: "1 day", status: "pending" },
          { id: 3, name: t('demand.gateway.data.stages.expertReview'), description: t('demand.gateway.data.stages.expertReviewDesc'), duration: "2 days", status: "pending" },
          { id: 4, name: t('demand.gateway.data.stages.reportGeneration'), description: t('demand.gateway.data.stages.reportGenerationDesc'), duration: "1 day", status: "pending" },
          { id: 5, name: t('demand.gateway.data.stages.actionPlanning'), description: t('demand.gateway.data.stages.actionPlanningDesc'), duration: "3 days", status: "pending" }
        ],
        raci: [
          { role: t('demand.gateway.data.raci.processOwner'), responsible: true, accountable: true, consulted: false, informed: true },
          { role: t('demand.gateway.data.raci.qualityTeam'), responsible: true, accountable: false, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.aiAnalyst'), responsible: true, accountable: false, consulted: false, informed: false },
          { role: t('demand.gateway.data.raci.executiveSponsor'), responsible: false, accountable: true, consulted: true, informed: true }
        ],
        sla: { target: "9 business days", warning: "7 days", critical: "12 days" },
        approvalLevels: [
          { level: 1, authority: t('demand.gateway.data.approvalLevels.qualityManager'), threshold: t('demand.gateway.data.thresholds.minorFindings'), autoApprove: true },
          { level: 2, authority: t('demand.gateway.data.approvalLevels.processOwner'), threshold: t('demand.gateway.data.thresholds.majorGaps'), autoApprove: false },
          { level: 3, authority: t('demand.gateway.data.approvalLevels.executiveTeam'), threshold: t('demand.gateway.data.thresholds.systemChanges'), autoApprove: false }
        ]
      }
    },
    {
      id: "complaints-analysis",
      title: t('demand.gateway.data.subServices.complaintsAnalysis.title'),
      description: t('demand.gateway.data.subServices.complaintsAnalysis.description'),
      icon: <MessageSquare className="h-5 w-5" />,
      color: "bg-rose-500",
      metrics: {
        label: t('demand.gateway.data.subServices.complaints'),
        value: demandKpis.total.toLocaleString(),
        status: t('demand.gateway.data.subServices.pendingApproval', { num: demandKpis.pendingApproval.toLocaleString() })
      },
      detailedMetrics: {
        slaCompliance: Math.round(demandKpis.slaCompliancePercent),
        avgProcessingDays: Number(demandKpis.avgProcessingDays.toFixed(1)),
        pendingApproval: demandKpis.pendingApproval,
        thisMonth: demandKpis.createdThisMonth,
        priorityBreakdown: {
          high: demandKpis.priorityBreakdown.high + demandKpis.priorityBreakdown.critical,
          medium: demandKpis.priorityBreakdown.medium,
          low: demandKpis.priorityBreakdown.low,
        },
        recentActivity: [
          { action: t('demand.gateway.data.activity.trendPatternDetected'), time: "1 hour ago", user: "AI Analytics", type: "insight" },
          { action: t('demand.gateway.data.activity.escalationResolved'), time: "4 hours ago", user: "Director Office", type: "resolution" },
          { action: t('demand.gateway.data.activity.satisfactionSurveySent'), time: "6 hours ago", user: "CX Team", type: "survey" }
        ],
        quickStats: [
          { label: t('demand.gateway.data.quickStats.totalRequests'), value: demandKpis.total.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.approved'), value: demandKpis.approved.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.rejected'), value: demandKpis.rejected.toLocaleString() }
        ]
      },
      processFlow: {
        title: t('demand.gateway.data.process.complaintsHandlingProcess'),
        stages: [
          { id: 1, name: t('demand.gateway.data.stages.receiptLogging'), description: t('demand.gateway.data.stages.receiptLoggingDesc'), duration: "< 1 hour", status: "active" },
          { id: 2, name: t('demand.gateway.data.stages.sentimentAnalysis'), description: t('demand.gateway.data.stages.sentimentAnalysisDesc'), duration: "< 2 hours", status: "pending" },
          { id: 3, name: t('demand.gateway.data.stages.assignment'), description: t('demand.gateway.data.stages.assignmentDesc'), duration: "< 4 hours", status: "pending" },
          { id: 4, name: t('demand.gateway.data.stages.investigation'), description: t('demand.gateway.data.stages.investigationDesc'), duration: "1-3 days", status: "pending" },
          { id: 5, name: t('demand.gateway.data.stages.resolution'), description: t('demand.gateway.data.stages.resolutionDesc'), duration: "1 day", status: "pending" },
          { id: 6, name: t('demand.gateway.data.stages.followUp'), description: t('demand.gateway.data.stages.followUpDesc'), duration: "3 days", status: "pending" }
        ],
        raci: [
          { role: t('demand.gateway.data.raci.cxRepresentative'), responsible: true, accountable: false, consulted: false, informed: true },
          { role: t('demand.gateway.data.raci.teamSupervisor'), responsible: false, accountable: true, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.resolutionSpecialist'), responsible: true, accountable: false, consulted: true, informed: false },
          { role: t('demand.gateway.data.raci.qualityAssurance'), responsible: false, accountable: false, consulted: true, informed: true }
        ],
        sla: { target: "3 business days", warning: "2 days", critical: "5 days" },
        approvalLevels: [
          { level: 1, authority: t('demand.gateway.data.approvalLevels.teamLead'), threshold: t('demand.gateway.data.thresholds.standardResolution'), autoApprove: true },
          { level: 2, authority: t('demand.gateway.data.approvalLevels.departmentHeadApproval'), threshold: t('demand.gateway.data.thresholds.compensationRequired'), autoApprove: false },
          { level: 3, authority: t('demand.gateway.data.approvalLevels.director'), threshold: t('demand.gateway.data.thresholds.vipEscalated'), autoApprove: false }
        ]
      }
    },
    {
      id: "innovations",
      title: t('demand.gateway.data.subServices.innovations.title'),
      description: t('demand.gateway.data.subServices.innovations.description'),
      icon: <Lightbulb className="h-5 w-5" />,
      color: "bg-amber-500",
      metrics: {
        label: t('demand.gateway.data.subServices.innovationsLabel'),
        value: demandKpis.createdThisMonth.toLocaleString(),
        status: t('demand.gateway.data.subServices.thisMonth', { num: demandKpis.createdThisMonth.toLocaleString() })
      },
      detailedMetrics: {
        slaCompliance: Math.round(demandKpis.slaCompliancePercent),
        avgProcessingDays: Number(demandKpis.avgProcessingDays.toFixed(1)),
        pendingApproval: demandKpis.pendingApproval,
        thisMonth: demandKpis.createdThisMonth,
        priorityBreakdown: {
          high: demandKpis.priorityBreakdown.high + demandKpis.priorityBreakdown.critical,
          medium: demandKpis.priorityBreakdown.medium,
          low: demandKpis.priorityBreakdown.low,
        },
        recentActivity: [
          { action: t('demand.gateway.data.activity.pocMilestoneAchieved'), time: "2 hours ago", user: "Innovation Lab", type: "milestone" },
          { action: t('demand.gateway.data.activity.budgetApproved'), time: "1 day ago", user: "Finance Dept", type: "approval" },
          { action: t('demand.gateway.data.activity.partnershipFormed'), time: "3 days ago", user: "Strategy Office", type: "partnership" }
        ],
        quickStats: [
          { label: t('demand.gateway.data.quickStats.pendingApproval'), value: demandKpis.pendingApproval.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.createdThisMonth'), value: demandKpis.createdThisMonth.toLocaleString() },
          { label: t('demand.gateway.data.quickStats.slaCompliance'), value: `${Math.round(demandKpis.slaCompliancePercent)}%` }
        ]
      },
      processFlow: {
        title: t('demand.gateway.data.process.innovationEvaluationWorkflow'),
        stages: [
          { id: 1, name: t('demand.gateway.data.stages.ideaSubmission'), description: t('demand.gateway.data.stages.ideaSubmissionDesc'), duration: "1-2 days", status: "active" },
          { id: 2, name: t('demand.gateway.data.stages.initialScreening'), description: t('demand.gateway.data.stages.initialScreeningDesc'), duration: "5 days", status: "pending" },
          { id: 3, name: t('demand.gateway.data.stages.deepDiveAnalysis'), description: t('demand.gateway.data.stages.deepDiveAnalysisDesc'), duration: "10 days", status: "pending" },
          { id: 4, name: t('demand.gateway.data.stages.innovationCommittee'), description: t('demand.gateway.data.stages.innovationCommitteeDesc'), duration: "5 days", status: "pending" },
          { id: 5, name: t('demand.gateway.data.stages.pocDevelopment'), description: t('demand.gateway.data.stages.pocDevelopmentDesc'), duration: "30 days", status: "pending" },
          { id: 6, name: t('demand.gateway.data.stages.scaleDecision'), description: t('demand.gateway.data.stages.scaleDecisionDesc'), duration: "5 days", status: "pending" }
        ],
        raci: [
          { role: t('demand.gateway.data.raci.innovator'), responsible: true, accountable: false, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.innovationManager'), responsible: true, accountable: true, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.financeAnalyst'), responsible: false, accountable: false, consulted: true, informed: true },
          { role: t('demand.gateway.data.raci.innovationCommittee'), responsible: false, accountable: true, consulted: false, informed: true }
        ],
        sla: { target: "56 business days", warning: "45 days", critical: "70 days" },
        approvalLevels: [
          { level: 1, authority: t('demand.gateway.data.approvalLevels.innovationManagerApproval'), threshold: t('demand.gateway.data.thresholds.under100kPOC'), autoApprove: true },
          { level: 2, authority: t('demand.gateway.data.raci.innovationCommittee'), threshold: t('demand.gateway.data.thresholds.range100k1m'), autoApprove: false },
          { level: 3, authority: t('demand.gateway.data.approvalLevels.executiveBoard'), threshold: t('demand.gateway.data.thresholds.over1m'), autoApprove: false }
        ]
      }
    }
  ];
}
