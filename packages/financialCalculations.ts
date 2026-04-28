/**
 * Shared Financial Calculations
 * 
 * Single source of truth for financial model calculations.
 * Used by both frontend (live preview) and backend (saved model).
 */

export interface CostLineItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  year0: number;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  year5: number;
  isRecurring: boolean;
}

export interface BenefitLineItem {
  id: string;
  category: string;
  name: string;
  description: string;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  year5: number;
  realization: string;
  confidence: string;
}

export interface YearlyCashFlow {
  year: number;
  label: string;
  costs: number;
  benefits: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  discountedCashFlow: number;
}

export interface ScenarioResult {
  name: string;
  label: string;
  npv: number;
  irr: number;
  roi: number;
  paybackMonths: number;
  probability: number;
}

export interface FinancialMetrics {
  npv: number;
  irr: number;
  roi: number;
  paybackMonths: number;
  totalCosts: number;
  totalBenefits: number;
  netValue: number;
}

export interface InvestmentDecision {
  verdict: string;
  label: string;
  summary: string;
  confidence: number;
  factors: { name: string; score: number; weight: number }[];
}

export interface FinancialModelOutput {
  costs: CostLineItem[];
  benefits: BenefitLineItem[];
  cashFlows: YearlyCashFlow[];
  metrics: FinancialMetrics;
  scenarios: ScenarioResult[];
  decision: InvestmentDecision;
}

export interface FinancialInputs {
  totalInvestment: number;
  archetype: string;
  discountRate: number; // as decimal (e.g., 0.08 for 8%)
  adoptionRate: number; // as decimal (e.g., 0.75 for 75%)
  maintenancePercent: number; // as decimal
  contingencyPercent: number; // as decimal
  domainParameters?: Record<string, number>; // Archetype-specific parameters
}

// Default domain parameter values by archetype
const DEFAULT_DOMAIN_PARAMS: Record<string, Record<string, number>> = {
  'Autonomous Vehicle Platform': {
    'Fleet Size': 100,
    'Vehicle Cost': 450000,
    'Taxi Fare Rate': 3.5,
    'Driver Cost Savings': 156000,
    'Average Trip Distance': 12,
    'Operating Cost per km': 0.85,
    'Fleet Utilization Rate': 0.72,
    'Daily Trips per Vehicle': 18,
  },
  'Healthcare Digital System': {
    'Patient Capacity': 50000,
    'Efficiency Gain Percent': 20,
    'Staff Hours Saved': 2,
    'Cost Per Staff Hour': 75,
  },
  'Healthcare Digital Transformation': {
    'Patient Throughput Increase': 15,
    'Medical Error Reduction': 40,
  },
  'Government Digital Transformation': {
    'Citizens Served': 100000,
    'Process Time Reduction': 50,
    'Transaction Volume': 10000,
  },
  'Insurance Digital Platform': {
    'Annual Claims Volume': 50000,
    'Fraud Detection Rate': 12,
    'Average Claim Value': 15000,
  },
  'Education Digital Platform': {
    'Student Enrollment': 25000,
    'Administrative Efficiency Gain': 35,
  },
  'Drone Last Mile Delivery': {
    'Fleet Size': 50,
    'Drone Unit Cost': 85000,
    'Max Capacity per Drone': 120,
    'Fleet Availability': 0.88,
    'Demand Utilization': 0.70,
    'Weather Regulation Factor': 0.80,
    'Premium Fare Rate': 45,
    'Ecommerce Fare Rate': 35,
    'Food Fare Rate': 25,
    'Premium Share': 0.20,
    'Ecommerce Share': 0.50,
    'Food Share': 0.30,
    'Energy Cost per Flight': 3.5,
    'Maintenance per Flight Hour': 8,
    'Battery Depreciation per Flight': 4.5,
    'Communication Cloud per Flight': 1.5,
    'Control Center Annual': 2400000,
    'Operations Staff Annual': 3600000,
    'Insurance Annual': 1800000,
    'Licensing Compliance Annual': 600000,
    'Average Delivery Distance': 8,
    'Cost per Delivery (Traditional)': 35,
    'Delivery Time Reduction': 65,
    'Carbon Emission Reduction': 70,
    'Y1 Fleet Active': 0.50,
    'Y2 Fleet Active': 0.75,
    'Y3 Fleet Active': 0.90,
    'Y4 Fleet Active': 0.95,
    'Y5 Fleet Active': 1.00,
    'Y1 Utilization Factor': 0.55,
    'Y2 Utilization Factor': 0.70,
    'Y3 Utilization Factor': 0.80,
    'Y4 Utilization Factor': 0.85,
    'Y5 Utilization Factor': 0.85,
  },
};

// Get domain multiplier based on parameter changes from defaults
function getDomainMultipliers(archetype: string, domainParams?: Record<string, number>): { costMultiplier: number; benefitMultiplier: number } {
  if (!domainParams || Object.keys(domainParams).length === 0) {
    return { costMultiplier: 1, benefitMultiplier: 1 };
  }
  
  const defaults = DEFAULT_DOMAIN_PARAMS[archetype] || {};
  let costMultiplier = 1;
  let benefitMultiplier = 1;
  
  if (archetype === 'Autonomous Vehicle Platform') {
    // Fleet Size affects costs directly
    const defaultFleetSize = defaults['Fleet Size'] || 100;
    const fleetSize = domainParams['Fleet Size'] ?? defaultFleetSize;
    const fleetRatio = fleetSize / defaultFleetSize;
    
    // Vehicle Cost affects initial capital costs
    const defaultVehicleCost = defaults['Vehicle Cost'] || 450000;
    const vehicleCost = domainParams['Vehicle Cost'] ?? defaultVehicleCost;
    const vehicleCostRatio = vehicleCost / defaultVehicleCost;
    
    // Combine for cost multiplier
    costMultiplier = fleetRatio * vehicleCostRatio;
    
    // Taxi Fare Rate affects revenue
    const defaultFareRate = defaults['Taxi Fare Rate'] || 3.5;
    const fareRate = domainParams['Taxi Fare Rate'] ?? defaultFareRate;
    const fareRatio = fareRate / defaultFareRate;
    
    // Daily Trips affects revenue
    const defaultTrips = defaults['Daily Trips per Vehicle'] || 18;
    const dailyTrips = domainParams['Daily Trips per Vehicle'] ?? defaultTrips;
    const tripsRatio = dailyTrips / defaultTrips;
    
    // Fleet utilization affects revenue
    const defaultUtil = defaults['Fleet Utilization Rate'] || 0.72;
    const utilization = domainParams['Fleet Utilization Rate'] ?? defaultUtil;
    const utilRatio = utilization / defaultUtil;
    
    // Driver cost savings affect benefits
    const defaultDriverSavings = defaults['Driver Cost Savings'] || 156000;
    const driverSavings = domainParams['Driver Cost Savings'] ?? defaultDriverSavings;
    const savingsRatio = driverSavings / defaultDriverSavings;
    
    // Combine for benefit multiplier
    benefitMultiplier = fleetRatio * fareRatio * tripsRatio * utilRatio * (0.5 + 0.5 * savingsRatio);
  } else if (archetype === 'Healthcare Digital System') {
    const defaultCapacity = defaults['Patient Capacity'] || 50000;
    const capacity = domainParams['Patient Capacity'] ?? defaultCapacity;
    
    const defaultEfficiency = defaults['Efficiency Gain Percent'] || 20;
    const efficiency = domainParams['Efficiency Gain Percent'] ?? defaultEfficiency;

    const defaultStaffHours = defaults['Staff Hours Saved'] || 2;
    const staffHours = domainParams['Staff Hours Saved'] ?? defaultStaffHours;

    const defaultCostPerHour = defaults['Cost Per Staff Hour'] || 75;
    const costPerHour = domainParams['Cost Per Staff Hour'] ?? defaultCostPerHour;
    
    costMultiplier = capacity / defaultCapacity;
    benefitMultiplier = (capacity / defaultCapacity) * (efficiency / defaultEfficiency)
      * (staffHours / defaultStaffHours) * (costPerHour / defaultCostPerHour);
  } else if (archetype === 'Government Digital Transformation') {
    const defaultCitizens = defaults['Citizens Served'] || 100000;
    const citizens = domainParams['Citizens Served'] ?? defaultCitizens;

    const defaultTimeReduction = defaults['Process Time Reduction'] || 50;
    const timeReduction = domainParams['Process Time Reduction'] ?? defaultTimeReduction;

    const defaultVolume = defaults['Transaction Volume'] || 10000;
    const transactionVolume = domainParams['Transaction Volume'] ?? defaultVolume;

    costMultiplier = citizens / defaultCitizens;
    benefitMultiplier = (citizens / defaultCitizens) * (timeReduction / defaultTimeReduction) * (transactionVolume / defaultVolume);
  } else if (archetype === 'Healthcare Digital Transformation') {
    const defaultThroughput = defaults['Patient Throughput Increase'] || 15;
    const throughput = domainParams['Patient Throughput Increase'] ?? defaultThroughput;

    const defaultErrorReduction = defaults['Medical Error Reduction'] || 40;
    const errorReduction = domainParams['Medical Error Reduction'] ?? defaultErrorReduction;

    benefitMultiplier = (throughput / defaultThroughput) * (errorReduction / defaultErrorReduction);
  } else if (archetype === 'Insurance Digital Platform') {
    const defaultVolume = defaults['Annual Claims Volume'] || 50000;
    const volume = domainParams['Annual Claims Volume'] ?? defaultVolume;

    const defaultFraud = defaults['Fraud Detection Rate'] || 12;
    const fraudRate = domainParams['Fraud Detection Rate'] ?? defaultFraud;

    const defaultClaimValue = defaults['Average Claim Value'] || 15000;
    const claimValue = domainParams['Average Claim Value'] ?? defaultClaimValue;

    benefitMultiplier = (volume / defaultVolume) * (fraudRate / defaultFraud) * (claimValue / defaultClaimValue);
  } else if (archetype === 'Education Digital Platform') {
    const defaultEnrollment = defaults['Student Enrollment'] || 25000;
    const enrollment = domainParams['Student Enrollment'] ?? defaultEnrollment;

    const defaultEfficiency = defaults['Administrative Efficiency Gain'] || 35;
    const efficiency = domainParams['Administrative Efficiency Gain'] ?? defaultEfficiency;

    benefitMultiplier = (enrollment / defaultEnrollment) * (efficiency / defaultEfficiency);
  } else if (archetype === 'Drone Last Mile Delivery') {
    // For Drone Last Mile Delivery, benefits are calculated DIRECTLY from domain parameters
    // in getArchetypeBenefits() using the utilization model and revenue segmentation.
    // Therefore, benefitMultiplier = 1 to avoid double-counting.
    
    // Cost multiplier still applies for scaling implementation costs
    const defaultFleetSize = defaults['Fleet Size'] || 50;
    const fleetSize = domainParams['Fleet Size'] ?? defaultFleetSize;
    const fleetRatio = Math.max(0.01, fleetSize / defaultFleetSize);
    
    const defaultDroneCost = defaults['Drone Unit Cost'] || 85000;
    const droneCost = domainParams['Drone Unit Cost'] ?? defaultDroneCost;
    const droneRatio = Math.max(0.01, droneCost / defaultDroneCost);
    
    costMultiplier = fleetRatio * droneRatio;
    benefitMultiplier = 1; // Benefits calculated directly from driver model - no multiplier
  }
  
  return { costMultiplier, benefitMultiplier };
}

const ARCHETYPE_KEYWORDS: [string, string[]][] = [
  ['Drone Last Mile Delivery', ['drone', 'last mile', 'delivery', 'uav', 'autonomous delivery', 'parcel', 'package', 'logistics', 'final mile', 'doorstep', 'e-commerce delivery', 'unmanned aerial']],
  ['Autonomous Vehicle Platform', ['autonomous', 'self-driving', 'driverless', 'robo-taxi', 'av platform', 'mobility rollout', 'taxi']],
  ['Digital Service Platform', ['performance management system', 'performance management platform', 'performance nexus', 'kpi management', 'okr platform', 'balanced scorecard', 'performance dashboard']],
  ['Healthcare Digital System', ['healthcare', 'medical', 'hospital', 'patient', 'clinical', 'health system']],
  ['AI/ML Platform', ['ai platform', 'machine learning', 'artificial intelligence', 'ml platform']],
  ['Blockchain Platform', ['blockchain', 'distributed ledger', 'smart contract']],
  ['Cybersecurity Infrastructure', ['cybersecurity', 'security operations', 'soc']],
];

const FINANCIAL_ARCHETYPE_ALIASES: Record<string, string> = {
  'AI/ML Platform': 'Government Digital Transformation',
  'Blockchain Platform': 'Government Digital Transformation',
  'Cybersecurity Infrastructure': 'Government Digital Transformation',
};

export function detectArchetype(projectName: string): string {
  const nameLower = projectName.toLowerCase();
  for (const [archetype, keywords] of ARCHETYPE_KEYWORDS) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) return FINANCIAL_ARCHETYPE_ALIASES[archetype] || archetype;
    }
  }
  return 'Government Digital Transformation';
}

export function getArchetypeCosts(archetype: string, totalInvestment: number, maintenancePercent: number, contingencyPercent: number): CostLineItem[] {
  // IMPORTANT: totalInvestment is the user's TOTAL BUDGET (all-in capital envelope)
  // We derive the base capital by backing out contingency, then allocate within budget
  // This ensures total Year 0 costs equal the stated investment
  
  // Calculate how much goes to contingency vs base implementation
  // If contingency is 35%, then base = investment / 1.35, contingency = investment - base
  const contingencyDivisor = 1 + contingencyPercent;
  const baseCapital = totalInvestment / contingencyDivisor;
  const contingencyAmount = totalInvestment - baseCapital;
  
  // Maintenance is calculated as a percentage of base capital per year
  // maintenancePercent is already in decimal (e.g., 0.25 for 25%)
  const annualMaintenance = baseCapital * maintenancePercent;
  
  if (archetype === 'Autonomous Vehicle Platform') {
    // Year 0 = baseCapital (100% allocated) + contingencyAmount = totalInvestment
    // Percentages must sum to 100% of baseCapital
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'AV Fleet Acquisition', description: 'Autonomous vehicle fleet purchase', year0: baseCapital * 0.48, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Charging & Depot Infrastructure', description: 'Charging stations, maintenance depots', year0: baseCapital * 0.22, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'AI/Sensor Systems', description: 'LiDAR, cameras, AI compute units', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Integration', name: 'Systems Integration & Testing', description: 'Integration, validation, safety testing', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Program Enablement', description: 'Training, certification, change management', year0: baseCapital * 0.05, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Fleet Operations', description: 'Energy, maintenance, remote monitoring', year0: 0, year1: annualMaintenance, year2: annualMaintenance * 1.03, year3: annualMaintenance * 1.06, year4: annualMaintenance * 1.09, year5: annualMaintenance * 1.12, isRecurring: true },
    ];
  }
  
  if (archetype === 'Healthcare Digital System') {
    // Percentages sum to 100% of baseCapital
    return [
      { id: 'c1', category: 'implementation', subcategory: 'Platform', name: 'EHR/Clinical Platform', description: 'Electronic health records system', year0: baseCapital * 0.35, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Integration', name: 'Device & Data Integration', description: 'IoT and device connectivity', year0: baseCapital * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Compliance', name: 'Compliance & Cybersecurity', description: 'HIPAA, data security certification', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Workflow', name: 'Clinical Workflow Digitisation', description: 'Process automation and optimization', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Training', name: 'Change Management & Training', description: 'Staff training and adoption support', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Clinical Support', description: 'Annual support and updates', year0: 0, year1: annualMaintenance, year2: annualMaintenance, year3: annualMaintenance, year4: annualMaintenance, year5: annualMaintenance, isRecurring: true },
    ];
  }
  
  if (archetype === 'Drone Last Mile Delivery') {
    // Driver-based cost model: variable costs per delivery + fixed annual costs
    // Variable cost per flight: energy + maintenance + battery depreciation + cloud
    const dp = DEFAULT_DOMAIN_PARAMS['Drone Last Mile Delivery'] || {};
    const fleetSize = dp['Fleet Size'] || 50;
    const maxCap = dp['Max Capacity per Drone'] || 120;
    const availability = dp['Fleet Availability'] || 0.88;
    const weatherFactor = dp['Weather Regulation Factor'] || 0.80;

    // Variable cost components per delivery
    const energyCost = dp['Energy Cost per Flight'] || 3.5;
    const maintPerFlight = dp['Maintenance per Flight Hour'] || 8;
    const batteryDepreciation = dp['Battery Depreciation per Flight'] || 4.5;
    const cloudCost = dp['Communication Cloud per Flight'] || 1.5;
    const variableCostPerDelivery = energyCost + maintPerFlight + batteryDepreciation + cloudCost; // ~17.5 AED

    // Fixed annual costs
    const controlCenter = dp['Control Center Annual'] || 2400000;
    const opsStaff = dp['Operations Staff Annual'] || 3600000;
    const insurance = dp['Insurance Annual'] || 1800000;
    const licensing = dp['Licensing Compliance Annual'] || 600000;
    const totalFixedAnnual = controlCenter + opsStaff + insurance + licensing;

    // Per-year delivery volumes with ramp-up (fleet active × utilization × availability × weather)
    const rampActive = [dp['Y1 Fleet Active'] || 0.50, dp['Y2 Fleet Active'] || 0.75, dp['Y3 Fleet Active'] || 0.90, dp['Y4 Fleet Active'] || 0.95, dp['Y5 Fleet Active'] || 1.0];
    const rampUtil = [dp['Y1 Utilization Factor'] || 0.55, dp['Y2 Utilization Factor'] || 0.70, dp['Y3 Utilization Factor'] || 0.80, dp['Y4 Utilization Factor'] || 0.85, dp['Y5 Utilization Factor'] || 0.85];

    const yearlyDeliveries = rampActive.map((active, i) => {
      const effectiveFleet = fleetSize * active;
      const dailyPerDrone = maxCap * rampUtil[i]! * availability * weatherFactor;
      return Math.round(effectiveFleet * dailyPerDrone * 365);
    });

    // Variable costs per year
    const yearlyVariableCosts = yearlyDeliveries.map(d => d * variableCostPerDelivery);

    // Fixed costs ramp with fleet active percentage (partial ops costs when fleet is small)
    const yearlyFixedCosts = rampActive.map((active, i) => {
      const fixedScale = Math.max(0.6, active); // min 60% of fixed costs even at low fleet
      return totalFixedAnnual * fixedScale * (1 + i * 0.03); // 3% annual escalation
    });

    const _yearlyTotalOpex = yearlyVariableCosts.map((v, i) => v + yearlyFixedCosts[i]!);

    return [
      { id: 'c1', category: 'implementation', subcategory: 'Fleet', name: 'Drone Fleet Acquisition', description: `${fleetSize} delivery drones at AED ${(dp['Drone Unit Cost'] || 85000).toLocaleString()} each`, year0: baseCapital * 0.40, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Landing Stations & Depots', description: 'Drone landing pads, charging stations, maintenance facilities', year0: baseCapital * 0.20, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c3', category: 'implementation', subcategory: 'Technology', name: 'Flight Management System', description: 'AI navigation, collision avoidance, traffic management', year0: baseCapital * 0.18, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c4', category: 'implementation', subcategory: 'Compliance', name: 'GCAA Certification & Safety', description: 'Regulatory approval, safety testing, airspace permits', year0: baseCapital * 0.12, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Program Enablement', description: 'Operator training, customer adoption, change management', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
      { id: 'c7', category: 'operational', subcategory: 'Variable', name: 'Variable Delivery Costs', description: `Energy (${energyCost}) + maintenance (${maintPerFlight}) + battery (${batteryDepreciation}) + cloud (${cloudCost}) per flight`, year0: 0, year1: yearlyVariableCosts[0]!, year2: yearlyVariableCosts[1]!, year3: yearlyVariableCosts[2]!, year4: yearlyVariableCosts[3]!, year5: yearlyVariableCosts[4]!, isRecurring: true },
      { id: 'c8', category: 'operational', subcategory: 'Fixed', name: 'Control Center & Monitoring', description: 'Remote operations center, flight monitoring systems', year0: 0, year1: controlCenter * Math.max(0.6, rampActive[0]!), year2: controlCenter * Math.max(0.6, rampActive[1]!) * 1.03, year3: controlCenter * Math.max(0.6, rampActive[2]!) * 1.06, year4: controlCenter * Math.max(0.6, rampActive[3]!) * 1.09, year5: controlCenter * Math.max(0.6, rampActive[4]!) * 1.12, isRecurring: true },
      { id: 'c9', category: 'operational', subcategory: 'Fixed', name: 'Operations Staff', description: 'Drone operators, safety monitors, logistics coordinators', year0: 0, year1: opsStaff * Math.max(0.6, rampActive[0]!), year2: opsStaff * Math.max(0.6, rampActive[1]!) * 1.03, year3: opsStaff * Math.max(0.6, rampActive[2]!) * 1.06, year4: opsStaff * Math.max(0.6, rampActive[3]!) * 1.09, year5: opsStaff * Math.max(0.6, rampActive[4]!) * 1.12, isRecurring: true },
      { id: 'c10', category: 'operational', subcategory: 'Fixed', name: 'Insurance & Liability', description: 'Fleet insurance, third-party liability, cargo coverage', year0: 0, year1: insurance * Math.max(0.6, rampActive[0]!), year2: insurance * Math.max(0.6, rampActive[1]!) * 1.05, year3: insurance * Math.max(0.6, rampActive[2]!) * 1.10, year4: insurance * Math.max(0.6, rampActive[3]!) * 1.15, year5: insurance * Math.max(0.6, rampActive[4]!) * 1.20, isRecurring: true },
      { id: 'c11', category: 'operational', subcategory: 'Fixed', name: 'Licensing & Compliance', description: 'Airspace fees, GCAA renewals, regulatory compliance', year0: 0, year1: licensing * Math.max(0.6, rampActive[0]!), year2: licensing * Math.max(0.6, rampActive[1]!) * 1.03, year3: licensing * Math.max(0.6, rampActive[2]!) * 1.06, year4: licensing * Math.max(0.6, rampActive[3]!) * 1.09, year5: licensing * Math.max(0.6, rampActive[4]!) * 1.12, isRecurring: true },
    ];
  }
  
  // Default Government Transformation - percentages sum to 100% of baseCapital
  return [
    { id: 'c1', category: 'implementation', subcategory: 'Software', name: 'Core Software & Development', description: 'Core platform development', year0: baseCapital * 0.35, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c2', category: 'implementation', subcategory: 'Infrastructure', name: 'Infrastructure Setup', description: 'Hardware and cloud setup', year0: baseCapital * 0.25, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c3', category: 'implementation', subcategory: 'Integration', name: 'Enterprise Integration', description: 'Integration with existing systems', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c4', category: 'implementation', subcategory: 'PM', name: 'PMO & Governance', description: 'Project management office', year0: baseCapital * 0.10, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c5', category: 'implementation', subcategory: 'Enablement', name: 'Change Management & Training', description: 'Talent enablement and adoption', year0: baseCapital * 0.15, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c6', category: 'implementation', subcategory: 'Contingency', name: 'Project Contingency', description: 'Risk buffer for unforeseen costs', year0: contingencyAmount, year1: 0, year2: 0, year3: 0, year4: 0, year5: 0, isRecurring: false },
    { id: 'c7', category: 'operational', subcategory: 'Operations', name: 'Annual Operations', description: 'Hosting and support', year0: 0, year1: annualMaintenance, year2: annualMaintenance * 1.03, year3: annualMaintenance * 1.06, year4: annualMaintenance * 1.09, year5: annualMaintenance * 1.12, isRecurring: true },
  ];
}

export function getArchetypeBenefits(archetype: string, totalInvestment: number, adoptionRate: number, domainParams?: Record<string, number>): BenefitLineItem[] {
  // Adoption rate affects how quickly benefits are realized
  const adoptionFactor = adoptionRate / 0.75; // Normalize against 75% baseline
  
  if (archetype === 'Autonomous Vehicle Platform') {
    const annualRevenue = totalInvestment * 0.25 * adoptionFactor;
    return [
      { id: 'b1', category: 'revenue', name: 'Ride Fare Revenue', description: 'Per-trip passenger revenue', year1: annualRevenue * 0.3, year2: annualRevenue * 0.6, year3: annualRevenue * 0.85, year4: annualRevenue, year5: annualRevenue * 1.1, realization: 'gradual', confidence: 'medium' },
      { id: 'b2', category: 'cost_savings', name: 'Driver Cost Elimination', description: 'No driver wages or benefits', year1: totalInvestment * 0.08 * adoptionFactor, year2: totalInvestment * 0.12 * adoptionFactor, year3: totalInvestment * 0.15 * adoptionFactor, year4: totalInvestment * 0.18 * adoptionFactor, year5: totalInvestment * 0.20 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b3', category: 'strategic', name: 'UAE Mobility Leadership', description: 'Global smart city positioning', year1: totalInvestment * 0.02 * adoptionFactor, year2: totalInvestment * 0.04 * adoptionFactor, year3: totalInvestment * 0.06 * adoptionFactor, year4: totalInvestment * 0.08 * adoptionFactor, year5: totalInvestment * 0.10 * adoptionFactor, realization: 'delayed', confidence: 'medium' },
    ];
  }
  
  if (archetype === 'Healthcare Digital System') {
    return [
      { id: 'b1', category: 'productivity', name: 'Clinical Efficiency', description: 'Reduced documentation time', year1: totalInvestment * 0.10 * adoptionFactor, year2: totalInvestment * 0.15 * adoptionFactor, year3: totalInvestment * 0.20 * adoptionFactor, year4: totalInvestment * 0.22 * adoptionFactor, year5: totalInvestment * 0.25 * adoptionFactor, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'strategic', name: 'Patient Outcome Improvement', description: 'Reduced readmissions, better care', year1: totalInvestment * 0.05 * adoptionFactor, year2: totalInvestment * 0.10 * adoptionFactor, year3: totalInvestment * 0.15 * adoptionFactor, year4: totalInvestment * 0.18 * adoptionFactor, year5: totalInvestment * 0.20 * adoptionFactor, realization: 'delayed', confidence: 'medium' },
      { id: 'b3', category: 'risk_reduction', name: 'Regulatory Compliance', description: 'Audit efficiency, reduced penalties', year1: totalInvestment * 0.03 * adoptionFactor, year2: totalInvestment * 0.05 * adoptionFactor, year3: totalInvestment * 0.06 * adoptionFactor, year4: totalInvestment * 0.07 * adoptionFactor, year5: totalInvestment * 0.08 * adoptionFactor, realization: 'immediate', confidence: 'high' },
    ];
  }
  
  if (archetype === 'Drone Last Mile Delivery') {
    // ── Driver-Based Revenue Model ──
    // Deliveries/day = Max Capacity × Utilization × Availability × Weather Factor
    // Revenue = Deliveries × Weighted Average Fare (segmented by Premium/Ecommerce/Food)
    const defaults = DEFAULT_DOMAIN_PARAMS['Drone Last Mile Delivery'] || {};
    const fleetSize = domainParams?.['Fleet Size'] ?? defaults['Fleet Size'] ?? 50;
    const maxCap = domainParams?.['Max Capacity per Drone'] ?? defaults['Max Capacity per Drone'] ?? 120;
    const fleetAvailability = domainParams?.['Fleet Availability'] ?? defaults['Fleet Availability'] ?? 0.88;
    const weatherFactor = domainParams?.['Weather Regulation Factor'] ?? defaults['Weather Regulation Factor'] ?? 0.80;
    const traditionalCost = domainParams?.['Cost per Delivery (Traditional)'] ?? defaults['Cost per Delivery (Traditional)'] ?? 35;
    const carbonReduction = domainParams?.['Carbon Emission Reduction'] ?? defaults['Carbon Emission Reduction'] ?? 70;

    // Revenue segmentation (weighted average fare)
    const premiumFare = domainParams?.['Premium Fare Rate'] ?? defaults['Premium Fare Rate'] ?? 45;
    const ecomFare = domainParams?.['Ecommerce Fare Rate'] ?? defaults['Ecommerce Fare Rate'] ?? 35;
    const foodFare = domainParams?.['Food Fare Rate'] ?? defaults['Food Fare Rate'] ?? 25;
    const premiumShare = domainParams?.['Premium Share'] ?? defaults['Premium Share'] ?? 0.20;
    const ecomShare = domainParams?.['Ecommerce Share'] ?? defaults['Ecommerce Share'] ?? 0.50;
    const foodShare = domainParams?.['Food Share'] ?? defaults['Food Share'] ?? 0.30;
    const weightedAverageFare = premiumFare * premiumShare + ecomFare * ecomShare + foodFare * foodShare; // ~34 AED

    // Variable cost per delivery (same as cost model)
    const energyCost = domainParams?.['Energy Cost per Flight'] ?? defaults['Energy Cost per Flight'] ?? 3.5;
    const maintPerFlight = domainParams?.['Maintenance per Flight Hour'] ?? defaults['Maintenance per Flight Hour'] ?? 8;
    const batteryDep = domainParams?.['Battery Depreciation per Flight'] ?? defaults['Battery Depreciation per Flight'] ?? 4.5;
    const cloudCost = domainParams?.['Communication Cloud per Flight'] ?? defaults['Communication Cloud per Flight'] ?? 1.5;
    const variableCostPerDelivery = energyCost + maintPerFlight + batteryDep + cloudCost; // ~17.5 AED

    // Contribution margin per delivery = weighted fare - variable cost → ~16.5 AED
    const contributionPerDelivery = Math.max(weightedAverageFare - variableCostPerDelivery, weightedAverageFare * 0.15);

    // Ramp-up: fleet active % and utilization % per year
    const rampActive = [
      domainParams?.['Y1 Fleet Active'] ?? defaults['Y1 Fleet Active'] ?? 0.50,
      domainParams?.['Y2 Fleet Active'] ?? defaults['Y2 Fleet Active'] ?? 0.75,
      domainParams?.['Y3 Fleet Active'] ?? defaults['Y3 Fleet Active'] ?? 0.90,
      domainParams?.['Y4 Fleet Active'] ?? defaults['Y4 Fleet Active'] ?? 0.95,
      domainParams?.['Y5 Fleet Active'] ?? defaults['Y5 Fleet Active'] ?? 1.00,
    ];
    const rampUtil = [
      domainParams?.['Y1 Utilization Factor'] ?? defaults['Y1 Utilization Factor'] ?? 0.55,
      domainParams?.['Y2 Utilization Factor'] ?? defaults['Y2 Utilization Factor'] ?? 0.70,
      domainParams?.['Y3 Utilization Factor'] ?? defaults['Y3 Utilization Factor'] ?? 0.80,
      domainParams?.['Y4 Utilization Factor'] ?? defaults['Y4 Utilization Factor'] ?? 0.85,
      domainParams?.['Y5 Utilization Factor'] ?? defaults['Y5 Utilization Factor'] ?? 0.85,
    ];

    // Delivery volumes per year: fleet × active% × maxCap × utilization × availability × weather × 365
    const yearlyDeliveries = rampActive.map((active, i) => {
      const effectiveFleet = fleetSize * active;
      const dailyPerDrone = maxCap * rampUtil[i]! * fleetAvailability * weatherFactor;
      return Math.round(effectiveFleet * dailyPerDrone * 365);
    });

    // Net contribution per year
    const yearlyContribution = yearlyDeliveries.map(d => d * contributionPerDelivery);

    // Cost savings: traditional cost - weighted average fare (logistics avoidance)
    const costSavingsPerDelivery = Math.max(0, traditionalCost - variableCostPerDelivery);
    const yearlyCostSavings = yearlyDeliveries.map(d => d * costSavingsPerDelivery);

    // Carbon value: AED 50/ton CO2, ~2kg per traditional delivery
    const carbonValuePerDelivery = (carbonReduction / 100) * 0.002 * 50;
    const yearlyCarbonValue = yearlyDeliveries.map(d => d * carbonValuePerDelivery);

    // Speed-enabled uplift (5-15% of contribution, growing with maturity)
    const speedUpliftPct = [0.05, 0.08, 0.12, 0.15, 0.15];
    const yearlySpeedUplift = yearlyContribution.map((c, i) => c * speedUpliftPct[i]!);

    return [
      { id: 'b1', category: 'revenue', name: 'Net Delivery Contribution', description: `${fleetSize} drones × ~${Math.round(maxCap * 0.70 * fleetAvailability * weatherFactor)} deliveries/day at AED ${weightedAverageFare.toFixed(0)} weighted avg fare, AED ${contributionPerDelivery.toFixed(0)} contribution margin`, year1: yearlyContribution[0]!, year2: yearlyContribution[1]!, year3: yearlyContribution[2]!, year4: yearlyContribution[3]!, year5: yearlyContribution[4]!, realization: 'gradual', confidence: 'high' },
      { id: 'b2', category: 'cost_savings', name: 'Logistics Cost Avoidance', description: `AED ${costSavingsPerDelivery.toFixed(0)} saved per delivery vs AED ${traditionalCost} traditional cost`, year1: yearlyCostSavings[0]!, year2: yearlyCostSavings[1]!, year3: yearlyCostSavings[2]!, year4: yearlyCostSavings[3]!, year5: yearlyCostSavings[4]!, realization: 'gradual', confidence: 'high' },
      { id: 'b3', category: 'strategic', name: 'Carbon & Resilience Value', description: `${carbonReduction}% lower emissions, AED ${carbonValuePerDelivery.toFixed(2)}/delivery carbon credit`, year1: yearlyCarbonValue[0]!, year2: yearlyCarbonValue[1]!, year3: yearlyCarbonValue[2]!, year4: yearlyCarbonValue[3]!, year5: yearlyCarbonValue[4]!, realization: 'immediate', confidence: 'medium' },
      { id: 'b4', category: 'productivity', name: 'Speed-Enabled Capacity Uplift', description: 'Additional throughput from faster delivery cycles (5-15% of base contribution)', year1: yearlySpeedUplift[0]!, year2: yearlySpeedUplift[1]!, year3: yearlySpeedUplift[2]!, year4: yearlySpeedUplift[3]!, year5: yearlySpeedUplift[4]!, realization: 'delayed', confidence: 'medium' },
    ];
  }
  
  // Default Government Transformation
  const annualBenefit = totalInvestment * 0.20 * adoptionFactor;
  return [
    { id: 'b1', category: 'productivity', name: 'Operational Productivity Gains', description: 'Time savings from automation', year1: annualBenefit * 0.2, year2: annualBenefit * 0.5, year3: annualBenefit * 0.8, year4: annualBenefit, year5: annualBenefit, realization: 'gradual', confidence: 'medium' },
    { id: 'b2', category: 'cost_savings', name: 'Operating Cost Avoidance', description: 'Reduced operational costs', year1: annualBenefit * 0.15, year2: annualBenefit * 0.4, year3: annualBenefit * 0.7, year4: annualBenefit * 0.9, year5: annualBenefit, realization: 'gradual', confidence: 'high' },
    { id: 'b3', category: 'risk_reduction', name: 'Control and Compliance Risk Reduction', description: 'Reduced errors and compliance risk', year1: annualBenefit * 0.1, year2: annualBenefit * 0.3, year3: annualBenefit * 0.5, year4: annualBenefit * 0.7, year5: annualBenefit * 0.8, realization: 'delayed', confidence: 'medium' },
  ];
}

export function buildCashFlows(costs: CostLineItem[], benefits: BenefitLineItem[], discountRate: number): YearlyCashFlow[] {
  const cashFlows: YearlyCashFlow[] = [];
  let cumulativeCashFlow = 0;
  const rate = discountRate;

  for (let year = 0; year <= 5; year++) {
    const yearKey = `year${year}` as keyof CostLineItem;
    const yearCosts = costs.reduce((sum, c) => sum + (Number(c[yearKey]) || 0), 0);
    const yearBenefits = year === 0 ? 0 : benefits.reduce((sum, b) => {
      const bKey = `year${year}` as keyof BenefitLineItem;
      return sum + (Number(b[bKey]) || 0);
    }, 0);

    const netCashFlow = yearBenefits - yearCosts;
    cumulativeCashFlow += netCashFlow;
    const discountedCashFlow = netCashFlow / Math.pow(1 + rate, year);

    cashFlows.push({
      year,
      label: year === 0 ? 'Initial' : `Year ${year}`,
      costs: yearCosts,
      benefits: yearBenefits,
      netCashFlow,
      cumulativeCashFlow,
      discountedCashFlow,
    });
  }

  return cashFlows;
}

export function calculateNPV(cashFlows: YearlyCashFlow[]): number {
  return cashFlows.reduce((npv, cf) => npv + cf.discountedCashFlow, 0);
}

export function calculateIRR(cashFlows: YearlyCashFlow[]): number {
  const cf = cashFlows.map(c => c.netCashFlow);
  if (cf.every(v => v >= 0) || cf.every(v => v <= 0)) return 0;

  let low = -0.99, high = 10, irr = 0;
  for (let i = 0; i < 1000; i++) {
    irr = (low + high) / 2;
    const npv = cf.reduce((sum, v, y) => sum + v / Math.pow(1 + irr, y), 0);
    if (Math.abs(npv) < 0.0001) break;
    if (npv > 0) low = irr; else high = irr;
  }
  return irr * 100;
}

export function calculatePaybackMonths(cashFlows: YearlyCashFlow[]): number {
  for (let i = 1; i < cashFlows.length; i++) {
    if (cashFlows[i]!.cumulativeCashFlow >= 0 && cashFlows[i - 1]!.cumulativeCashFlow < 0) {
      const prev = Math.abs(cashFlows[i - 1]!.cumulativeCashFlow);
      const net = cashFlows[i]!.netCashFlow;
      if (net > 0) return ((i - 1) + prev / net) * 12;
      return i * 12;
    }
  }
  if ((cashFlows[0]?.cumulativeCashFlow ?? -1) >= 0) return 0;
  return Infinity;
}

export function calculateROI(totalBenefits: number, totalCosts: number): number {
  if (totalCosts === 0) return 0;
  return ((totalBenefits - totalCosts) / totalCosts) * 100;
}

export function computeScenarios(costs: CostLineItem[], benefits: BenefitLineItem[], discountRate: number): ScenarioResult[] {
  const multipliers = [
    { name: 'pessimistic', label: 'Pessimistic', costMult: 1.25, benefitMult: 0.70, probability: 0.2 },
    { name: 'base', label: 'Base Case', costMult: 1.0, benefitMult: 1.0, probability: 0.6 },
    { name: 'optimistic', label: 'Optimistic', costMult: 0.90, benefitMult: 1.20, probability: 0.2 },
  ];

  return multipliers.map(m => {
    const scaledCosts = costs.map(c => ({
      ...c,
      year0: c.year0 * m.costMult,
      year1: c.year1 * m.costMult,
      year2: c.year2 * m.costMult,
      year3: c.year3 * m.costMult,
      year4: c.year4 * m.costMult,
      year5: c.year5 * m.costMult,
    }));
    const scaledBenefits = benefits.map(b => ({
      ...b,
      year1: b.year1 * m.benefitMult,
      year2: b.year2 * m.benefitMult,
      year3: b.year3 * m.benefitMult,
      year4: b.year4 * m.benefitMult,
      year5: b.year5 * m.benefitMult,
    }));
    const cf = buildCashFlows(scaledCosts, scaledBenefits, discountRate);
    const npv = calculateNPV(cf);
    const irr = calculateIRR(cf);
    const totalCosts = cf.reduce((s, c) => s + c.costs, 0);
    const totalBenefits = cf.reduce((s, c) => s + c.benefits, 0);
    const roi = calculateROI(totalBenefits, totalCosts);
    const paybackMonths = calculatePaybackMonths(cf);

    return {
      name: m.name,
      label: m.label,
      npv,
      irr,
      roi,
      paybackMonths,
      probability: m.probability,
    };
  });
}

function formatAED(value: number): string {
  if (Math.abs(value) >= 1e9) return `AED ${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `AED ${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `AED ${(value / 1e3).toFixed(0)}K`;
  return `AED ${value.toFixed(0)}`;
}

export function computeInvestmentDecision(
  npv: number,
  irr: number,
  roi: number,
  paybackMonths: number,
  totalInvestment: number
): InvestmentDecision {
  const factors: { name: string; score: number; weight: number }[] = [];

  // NPV Score (0-100)
  let npvScore = 0;
  if (npv > totalInvestment * 0.5) npvScore = 100;
  else if (npv > totalInvestment * 0.2) npvScore = 80;
  else if (npv > 0) npvScore = 60;
  else if (npv > -totalInvestment * 0.1) npvScore = 40;
  else npvScore = 20;
  factors.push({ name: 'NPV', score: npvScore, weight: 0.35 });

  // IRR Score
  let irrScore = 0;
  if (irr >= 25) irrScore = 100;
  else if (irr >= 15) irrScore = 80;
  else if (irr >= 8) irrScore = 60;
  else if (irr >= 0) irrScore = 40;
  else irrScore = 20;
  factors.push({ name: 'IRR', score: irrScore, weight: 0.25 });

  // ROI Score
  let roiScore = 0;
  if (roi >= 100) roiScore = 100;
  else if (roi >= 50) roiScore = 80;
  else if (roi >= 20) roiScore = 60;
  else if (roi >= 0) roiScore = 40;
  else roiScore = 20;
  factors.push({ name: 'ROI', score: roiScore, weight: 0.25 });

  // Payback Score
  let paybackScore = 0;
  if (paybackMonths <= 24) paybackScore = 100;
  else if (paybackMonths <= 36) paybackScore = 80;
  else if (paybackMonths <= 48) paybackScore = 60;
  else if (paybackMonths <= 60) paybackScore = 40;
  else paybackScore = 20;
  factors.push({ name: 'Payback', score: paybackScore, weight: 0.15 });

  const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  let verdict: string;
  let label: string;
  let summary: string;

  if (weightedScore >= 85) {
    verdict = 'STRONG_INVEST';
    label = 'Strongly Recommended';
    summary = `Excellent investment opportunity with NPV of ${formatAED(npv)} and ${irr.toFixed(1)}% IRR. Strong financial fundamentals support immediate approval.`;
  } else if (weightedScore >= 70) {
    verdict = 'INVEST';
    label = 'Recommended';
    summary = `Solid investment with positive returns. NPV: ${formatAED(npv)}, ROI: ${roi.toFixed(0)}%. Proceed with standard governance approval.`;
  } else if (weightedScore >= 55) {
    verdict = 'CONDITIONAL';
    label = 'Conditional Approval';
    summary = `Moderate risk-reward profile. Consider risk mitigation strategies and staged implementation. Payback in ${Math.round(paybackMonths)} months.`;
  } else if (weightedScore >= 40) {
    verdict = 'CAUTION';
    label = 'Requires Review';
    summary = `Below-target returns. Recommend reassessing scope, timeline, or exploring alternatives before proceeding.`;
  } else if (roi >= 0 || npv >= 0) {
    verdict = 'CONDITIONAL';
    label = 'Conditional Approval';
    summary = `Financial score is weak, but the model is not an outright negative-return case. Treat as stage-gated: validate benefits, scope, and payback before full approval. NPV: ${formatAED(npv)}, ROI: ${roi.toFixed(0)}%.`;
  } else {
    verdict = 'DO_NOT_INVEST';
    label = 'Not Recommended';
    summary = `Investment does not meet financial thresholds. NPV is ${npv < 0 ? 'negative' : 'marginal'}. Consider alternative solutions.`;
  }

  return {
    verdict,
    label,
    summary,
    confidence: Math.round(weightedScore),
    factors,
  };
}

/**
 * Compute full financial model from inputs
 * This is the single source of truth - used by both frontend preview and backend save
 */
export function computeFinancialModel(inputs: FinancialInputs): FinancialModelOutput {
  const { totalInvestment, archetype, discountRate, adoptionRate, maintenancePercent, contingencyPercent, domainParameters } = inputs;
  
  // Get domain parameter multipliers
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { costMultiplier, benefitMultiplier } = getDomainMultipliers(archetype, domainParameters);
  
  // Get base costs and benefits
  let costs = getArchetypeCosts(archetype, totalInvestment, maintenancePercent, contingencyPercent);
  let benefits = getArchetypeBenefits(archetype, totalInvestment, adoptionRate, domainParameters);
  
  // Apply domain parameter multipliers to BENEFITS ONLY
  // Costs are already derived from totalInvestment which is the user's stated budget
  // Domain parameters should only affect expected benefits (revenue, savings)
  // Applying costMultiplier would double-count and inflate costs beyond the investment
  if (benefitMultiplier !== 1) {
    benefits = benefits.map(b => ({
      ...b,
      year1: b.year1 * benefitMultiplier,
      year2: b.year2 * benefitMultiplier,
      year3: b.year3 * benefitMultiplier,
      year4: b.year4 * benefitMultiplier,
      year5: b.year5 * benefitMultiplier,
    }));
  }
  
  const cashFlows = buildCashFlows(costs, benefits, discountRate);
  
  const npv = calculateNPV(cashFlows);
  const irr = calculateIRR(cashFlows);
  const totalCosts = cashFlows.reduce((s, c) => s + c.costs, 0);
  const totalBenefits = cashFlows.reduce((s, c) => s + c.benefits, 0);
  const roi = calculateROI(totalBenefits, totalCosts);
  const paybackMonths = calculatePaybackMonths(cashFlows);
  
  const metrics: FinancialMetrics = {
    npv,
    irr,
    roi,
    paybackMonths,
    totalCosts,
    totalBenefits,
    netValue: totalBenefits - totalCosts,
  };
  
  const scenarios = computeScenarios(costs, benefits, discountRate);
  const decision = computeInvestmentDecision(npv, irr, roi, paybackMonths, totalInvestment);
  
  return {
    costs,
    benefits,
    cashFlows,
    metrics,
    scenarios,
    decision,
  };
}
