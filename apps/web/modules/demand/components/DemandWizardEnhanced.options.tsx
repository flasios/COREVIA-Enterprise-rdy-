import i18next from 'i18next';
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import {
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  Cloud,
  Database,
  DollarSign,
  FileText,
  Globe,
  MapPin,
  Network,
  Rocket,
  Settings,
  Shield,
  Star,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
  CheckCircle,
} from "lucide-react";

// Enhanced dropdown options for industry types
export function getIndustryTypeOptions() {
  return [
  {
    value: "government",
    label: i18next.t('demand.wizard.orgTypes.government.label'),
    description: i18next.t('demand.wizard.orgTypes.government.description'),
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "semi-government",
    label: i18next.t('demand.wizard.orgTypes.semiGovernment.label'),
    description: i18next.t('demand.wizard.orgTypes.semiGovernment.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "public-private-partnership",
    label: i18next.t('demand.wizard.orgTypes.publicPrivatePartnership.label'),
    description: i18next.t('demand.wizard.orgTypes.publicPrivatePartnership.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "private-sector",
    label: i18next.t('demand.wizard.orgTypes.privateSector.label'),
    description: i18next.t('demand.wizard.orgTypes.privateSector.description'),
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: "non-profit",
    label: i18next.t('demand.wizard.orgTypes.nonProfit.label'),
    description: i18next.t('demand.wizard.orgTypes.nonProfit.description'),
    icon: <Target className="h-4 w-4" />,
  },
];
}

export function getBudgetRanges() {
  return [
  {
    value: "under-100k",
    label: i18next.t('demand.wizard.budgetRanges.under100k.label'),
    description: i18next.t('demand.wizard.budgetRanges.under100k.description'),
    color: "from-green-400 to-emerald-500",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: "100k-500k",
    label: i18next.t('demand.wizard.budgetRanges.100k500k.label'),
    description: i18next.t('demand.wizard.budgetRanges.100k500k.description'),
    color: "from-blue-400 to-cyan-500",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: "500k-1m",
    label: i18next.t('demand.wizard.budgetRanges.500k1m.label'),
    description: i18next.t('demand.wizard.budgetRanges.500k1m.description'),
    color: "from-purple-400 to-violet-500",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: "1m-5m",
    label: i18next.t('demand.wizard.budgetRanges.1m5m.label'),
    description: i18next.t('demand.wizard.budgetRanges.1m5m.description'),
    color: "from-amber-400 to-orange-500",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "5m-15m",
    label: i18next.t('demand.wizard.budgetRanges.5m15m.label'),
    description: i18next.t('demand.wizard.budgetRanges.5m15m.description'),
    color: "from-red-400 to-pink-500",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "over-15m",
    label: i18next.t('demand.wizard.budgetRanges.over15m.label'),
    description: i18next.t('demand.wizard.budgetRanges.over15m.description'),
    color: "from-indigo-400 to-blue-500",
    icon: <Rocket className="h-4 w-4" />,
  },
  {
    value: "tbd",
    label: i18next.t('demand.wizard.budgetRanges.tbd.label'),
    description: i18next.t('demand.wizard.budgetRanges.tbd.description'),
    color: "from-gray-400 to-slate-500",
    icon: <AlertCircle className="h-4 w-4" />,
  },
];
}

export function getTimeframeOptions() {
  return [
  {
    value: "immediate",
    label: i18next.t('demand.wizard.timelines.immediate.label'),
    description: i18next.t('demand.wizard.timelines.immediate.description'),
    icon: <Zap className="h-4 w-4" />,
    color: "from-red-400 to-orange-500",
  },
  {
    value: "short",
    label: i18next.t('demand.wizard.timelines.short.label'),
    description: i18next.t('demand.wizard.timelines.short.description'),
    icon: <Clock className="h-4 w-4" />,
    color: "from-orange-400 to-yellow-500",
  },
  {
    value: "medium",
    label: i18next.t('demand.wizard.timelines.medium.label'),
    description: i18next.t('demand.wizard.timelines.medium.description'),
    icon: <Calendar className="h-4 w-4" />,
    color: "from-blue-400 to-cyan-500",
  },
  {
    value: "long",
    label: i18next.t('demand.wizard.timelines.long.label'),
    description: i18next.t('demand.wizard.timelines.long.description'),
    icon: <TrendingUp className="h-4 w-4" />,
    color: "from-purple-400 to-violet-500",
  },
  {
    value: "strategic",
    label: i18next.t('demand.wizard.timelines.strategic.label'),
    description: i18next.t('demand.wizard.timelines.strategic.description'),
    icon: <Rocket className="h-4 w-4" />,
    color: "from-emerald-400 to-green-500",
  },
];
}

export function getCapacityLevels() {
  return [
  {
    value: "limited",
    label: i18next.t('demand.wizard.readiness.limited.label'),
    description: i18next.t('demand.wizard.readiness.limited.description'),
    subtext: i18next.t('demand.wizard.readiness.limited.subtext'),
    icon: <AlertCircle className="h-4 w-4" />,
    color: "from-red-400 to-red-500",
  },
  {
    value: "basic",
    label: i18next.t('demand.wizard.readiness.basic.label'),
    description: i18next.t('demand.wizard.readiness.basic.description'),
    subtext: i18next.t('demand.wizard.readiness.basic.subtext'),
    icon: <Clock className="h-4 w-4" />,
    color: "from-yellow-400 to-amber-500",
  },
  {
    value: "moderate",
    label: i18next.t('demand.wizard.readiness.moderate.label'),
    description: i18next.t('demand.wizard.readiness.moderate.description'),
    subtext: i18next.t('demand.wizard.readiness.moderate.subtext'),
    icon: <Users className="h-4 w-4" />,
    color: "from-orange-400 to-orange-500",
  },
  {
    value: "strong",
    label: i18next.t('demand.wizard.readiness.strong.label'),
    description: i18next.t('demand.wizard.readiness.strong.description'),
    subtext: i18next.t('demand.wizard.readiness.strong.subtext'),
    icon: <CheckCircle className="h-4 w-4" />,
    color: "from-green-400 to-emerald-500",
  },
  {
    value: "excellent",
    label: i18next.t('demand.wizard.readiness.excellent.label'),
    description: i18next.t('demand.wizard.readiness.excellent.description'),
    subtext: i18next.t('demand.wizard.readiness.excellent.subtext'),
    icon: <Star className="h-4 w-4" />,
    color: "from-emerald-400 to-green-500",
  },
];
}

export function getSystemTypes() {
  return [
  {
    value: "erp",
    label: i18next.t('demand.wizard.systemTypes.erp.label'),
    description: i18next.t('demand.wizard.systemTypes.erp.description'),
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "crm",
    label: i18next.t('demand.wizard.systemTypes.crm.label'),
    description: i18next.t('demand.wizard.systemTypes.crm.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "financial",
    label: i18next.t('demand.wizard.systemTypes.financial.label'),
    description: i18next.t('demand.wizard.systemTypes.financial.description'),
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: "hr",
    label: i18next.t('demand.wizard.systemTypes.hr.label'),
    description: i18next.t('demand.wizard.systemTypes.hr.description'),
    icon: <UserCheck className="h-4 w-4" />,
  },
  {
    value: "gis",
    label: i18next.t('demand.wizard.systemTypes.gis.label'),
    description: i18next.t('demand.wizard.systemTypes.gis.description'),
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    value: "iot",
    label: i18next.t('demand.wizard.systemTypes.iot.label'),
    description: i18next.t('demand.wizard.systemTypes.iot.description'),
    icon: <Network className="h-4 w-4" />,
  },
  {
    value: "ai-ml",
    label: i18next.t('demand.wizard.systemTypes.aiMl.label'),
    description: i18next.t('demand.wizard.systemTypes.aiMl.description'),
    icon: <HexagonLogoFrame px={16} />,
  },
  {
    value: "cloud",
    label: i18next.t('demand.wizard.systemTypes.cloud.label'),
    description: i18next.t('demand.wizard.systemTypes.cloud.description'),
    icon: <Cloud className="h-4 w-4" />,
  },
  {
    value: "database",
    label: i18next.t('demand.wizard.systemTypes.database.label'),
    description: i18next.t('demand.wizard.systemTypes.database.description'),
    icon: <Database className="h-4 w-4" />,
  },
  {
    value: "legacy",
    label: i18next.t('demand.wizard.systemTypes.legacy.label'),
    description: i18next.t('demand.wizard.systemTypes.legacy.description'),
    icon: <FileText className="h-4 w-4" />,
  },
  {
    value: "not-applicable",
    label: i18next.t('demand.wizard.systemTypes.notApplicable.label'),
    description: i18next.t('demand.wizard.systemTypes.notApplicable.description'),
    icon: <AlertCircle className="h-4 w-4" />,
  },
];
}

export function getIntegrationTypes() {
  return [
  {
    value: "api",
    label: i18next.t('demand.wizard.integrationTypes.api.label'),
    description: i18next.t('demand.wizard.integrationTypes.api.description'),
    icon: <Network className="h-4 w-4" />,
  },
  {
    value: "real-time",
    label: i18next.t('demand.wizard.integrationTypes.realTime.label'),
    description: i18next.t('demand.wizard.integrationTypes.realTime.description'),
    icon: <Zap className="h-4 w-4" />,
  },
  {
    value: "batch",
    label: i18next.t('demand.wizard.integrationTypes.batch.label'),
    description: i18next.t('demand.wizard.integrationTypes.batch.description'),
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "webhooks",
    label: i18next.t('demand.wizard.integrationTypes.webhooks.label'),
    description: i18next.t('demand.wizard.integrationTypes.webhooks.description'),
    icon: <AlertCircle className="h-4 w-4" />,
  },
  {
    value: "middleware",
    label: i18next.t('demand.wizard.integrationTypes.middleware.label'),
    description: i18next.t('demand.wizard.integrationTypes.middleware.description'),
    icon: <Settings className="h-4 w-4" />,
  },
  {
    value: "mobile",
    label: i18next.t('demand.wizard.integrationTypes.mobile.label'),
    description: i18next.t('demand.wizard.integrationTypes.mobile.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "web",
    label: i18next.t('demand.wizard.integrationTypes.web.label'),
    description: i18next.t('demand.wizard.integrationTypes.web.description'),
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: "file",
    label: i18next.t('demand.wizard.integrationTypes.file.label'),
    description: i18next.t('demand.wizard.integrationTypes.file.description'),
    icon: <FileText className="h-4 w-4" />,
  },
  {
    value: "not-applicable",
    label: i18next.t('demand.wizard.integrationTypes.notApplicable.label'),
    description: i18next.t('demand.wizard.integrationTypes.notApplicable.description'),
    icon: <AlertCircle className="h-4 w-4" />,
  },
];
}

export function getComplianceStandards() {
  return [
  {
    value: "uae-data-protection",
    label: i18next.t('demand.wizard.compliance.uaeDataProtection.label'),
    description: i18next.t('demand.wizard.compliance.uaeDataProtection.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "iso-27001",
    label: i18next.t('demand.wizard.compliance.iso27001.label'),
    description: i18next.t('demand.wizard.compliance.iso27001.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "dubai-smart-city",
    label: i18next.t('demand.wizard.compliance.dubaiSmartCity.label'),
    description: i18next.t('demand.wizard.compliance.dubaiSmartCity.description'),
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "gdpr",
    label: i18next.t('demand.wizard.compliance.gdpr.label'),
    description: i18next.t('demand.wizard.compliance.gdpr.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "environmental",
    label: i18next.t('demand.wizard.compliance.environmental.label'),
    description: i18next.t('demand.wizard.compliance.environmental.description'),
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: "accessibility",
    label: i18next.t('demand.wizard.compliance.accessibility.label'),
    description: i18next.t('demand.wizard.compliance.accessibility.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "cybersecurity",
    label: i18next.t('demand.wizard.compliance.cybersecurity.label'),
    description: i18next.t('demand.wizard.compliance.cybersecurity.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "government",
    label: i18next.t('demand.wizard.compliance.government.label'),
    description: i18next.t('demand.wizard.compliance.government.description'),
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    value: "not-applicable",
    label: i18next.t('demand.wizard.compliance.notApplicable.label'),
    description: i18next.t('demand.wizard.compliance.notApplicable.description'),
    icon: <AlertCircle className="h-4 w-4" />,
  },
];
}

export function getRiskCategories() {
  return [
  {
    value: "technical",
    label: i18next.t('demand.wizard.riskFactors.technical.label'),
    description: i18next.t('demand.wizard.riskFactors.technical.description'),
    icon: <Settings className="h-4 w-4" />,
  },
  {
    value: "budget",
    label: i18next.t('demand.wizard.riskFactors.budget.label'),
    description: i18next.t('demand.wizard.riskFactors.budget.description'),
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: "timeline",
    label: i18next.t('demand.wizard.riskFactors.timeline.label'),
    description: i18next.t('demand.wizard.riskFactors.timeline.description'),
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "stakeholder",
    label: i18next.t('demand.wizard.riskFactors.stakeholder.label'),
    description: i18next.t('demand.wizard.riskFactors.stakeholder.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "regulatory",
    label: i18next.t('demand.wizard.riskFactors.regulatory.label'),
    description: i18next.t('demand.wizard.riskFactors.regulatory.description'),
    icon: <FileText className="h-4 w-4" />,
  },
  {
    value: "security",
    label: i18next.t('demand.wizard.riskFactors.security.label'),
    description: i18next.t('demand.wizard.riskFactors.security.description'),
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: "integration",
    label: i18next.t('demand.wizard.riskFactors.integration.label'),
    description: i18next.t('demand.wizard.riskFactors.integration.description'),
    icon: <Network className="h-4 w-4" />,
  },
  {
    value: "adoption",
    label: i18next.t('demand.wizard.riskFactors.adoption.label'),
    description: i18next.t('demand.wizard.riskFactors.adoption.description'),
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    value: "vendor",
    label: i18next.t('demand.wizard.riskFactors.vendor.label'),
    description: i18next.t('demand.wizard.riskFactors.vendor.description'),
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: "not-applicable",
    label: i18next.t('demand.wizard.riskFactors.notApplicable.label'),
    description: i18next.t('demand.wizard.riskFactors.notApplicable.description'),
    icon: <AlertCircle className="h-4 w-4" />,
  },
];
}

export function getSteps() {
  return [
  {
    id: 1,
    title: i18next.t('demand.wizard.steps.orgContact.title'),
    description: i18next.t('demand.wizard.steps.orgContact.description'),
    icon: <Building2 className="h-5 w-5" />,
    color: "from-blue-500 to-cyan-500",
    fields: [
      "organizationName",
      "industryType",
      "requestorName",
      "requestorEmail",
      "department",
      "urgency",
    ],
  },
  {
    id: 2,
    title: i18next.t('demand.wizard.steps.visionRequirements.title'),
    description: i18next.t('demand.wizard.steps.visionRequirements.description'),
    icon: <Target className="h-5 w-5" />,
    color: "from-emerald-500 to-teal-500",
    fields: [
      "businessObjective",
      "currentChallenges",
      "expectedOutcomes",
      "successCriteria",
      "constraints",
    ],
  },
  {
    id: 3,
    title: i18next.t('demand.wizard.steps.resourcesPlanning.title'),
    description: i18next.t('demand.wizard.steps.resourcesPlanning.description'),
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-amber-500 to-orange-500",
    fields: ["currentCapacity", "budgetRange", "timeframe", "stakeholders"],
  },
  {
    id: 4,
    title: i18next.t('demand.wizard.steps.techIntegration.title'),
    description: i18next.t('demand.wizard.steps.techIntegration.description'),
    icon: <Settings className="h-5 w-5" />,
    color: "from-violet-500 to-purple-500",
    fields: [
      "existingSystems",
      "integrationRequirements",
      "complianceRequirements",
      "riskFactors",
    ],
  },
];
}

export type StepDef = ReturnType<typeof getSteps>[number];
