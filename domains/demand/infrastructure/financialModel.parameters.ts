import { getArchetypeConfig } from '@shared/constants/archetypes';
import type { FinancialInputs } from './financialModel.types';

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// Default domain parameters for each archetype
export const DEFAULT_DOMAIN_PARAMS: Record<string, Record<string, number>> = {
  'Autonomous Vehicle Platform': {
    'Fleet Size': 100,
    'Vehicle Cost': 450000,
    'Taxi Fare Rate': 3.5,
    'Average Trip Distance': 12,
    'Daily Trips per Vehicle': 25,
    'Fleet Utilization Rate': 0.75,
    'Operating Cost per km': 0.85,
    'Driver Cost Savings': 0,
  },
  'Healthcare Digital System': {
    'Patient Capacity': 50000,
    'Efficiency Gain Percent': 20,
    'Cost per Patient': 500,
    'Staff Reduction Percent': 15,
  },
  'Healthcare Digital Transformation': {
    'Patient Throughput Increase': 15,
    'Cost per Outpatient Visit': 350,
    'Bed Occupancy Target': 85,
    'Medical Error Reduction': 40,
    'Staff Time Savings': 2.5,
  },
  'Government Digital Transformation': {
    'Citizen Users': 100000,
    'Transaction Volume': 500000,
    'Processing Time Reduction': 50,
    'Staff Efficiency Gain': 25,
  },
  'Disaster Recovery & Business Continuity Platform': {
    'Critical Services Protected': 24,
    'Annual Service Value at Risk': 18_000_000,
    'Expected Downtime Reduction': 75,
    'Current RTO': 24,
    'Target RTO': 4,
    'Current RPO': 12,
    'Target RPO': 1,
    'Annual DR Exercise Cost': 450_000,
    'Secondary Site Annual Run Cost': 1_200_000,
    'Cyber Resilience Uplift': 20,
  },
  'Insurance Digital Platform': {
    'Claims Processing Cost': 500,
    'Digital Claims Cost': 50,
    'Annual Claims Volume': 50000,
    'Fraud Detection Rate': 12,
    'Average Claim Value': 15000,
    'Policy Renewal Rate': 85,
    'Processing Time Reduction': 60,
  },
  'Education Digital Platform': {
    'Student Enrollment': 25000,
    'Cost per Student': 500,
    'Administrative Efficiency Gain': 35,
    'Teacher Productivity Gain': 20,
  },
  'Drone Last Mile Delivery': {
    'Fleet Size': 80,
    'Pilot Fleet Size': 12,
    'Drone Unit Cost': 85000,
    'Max Capacity per Drone': 180,
    'Fleet Availability': 0.86,
    'Demand Utilization': 0.68,
    'Weather Regulation Factor': 0.82,
    'Premium Fare Rate': 44,
    'Pharma Fare Rate': 52,
    'B2B Contract Fare Rate': 28,
    'Premium Share': 0.10,
    'Pharma Share': 0.15,
    'B2B Share': 0.75,
    'Enterprise Contract Share': 0.70,
    'Platform Fee per Delivery': 2.5,
    'Platform Integration Fees Annual': 400000,
    'Pilot Partner Delivery Share': 0.65,
    'Pilot Partner Ops Offset': 0.30,
    'Learning Curve Annual Improvement': 0.06,
    'Automation Target': 0.45,
    'Idle Time Reduction': 0.10,
    'Energy Cost per Flight': 4,
    'Maintenance per Flight Hour': 9,
    'Battery Depreciation per Flight': 5.5,
    'Communication Cloud per Flight': 2,
    'Ground Handling per Delivery': 5,
    'Customer Service per Delivery': 2.5,
    'Control Center Annual': 1800000,
    'Operations Staff Annual': 2800000,
    'Insurance Annual': 1200000,
    'Licensing Compliance Annual': 600000,
    'Average Delivery Distance': 8,
    'Cost per Delivery (Traditional)': 32,
    'Delivery Time Reduction': 65,
    'Carbon Emission Reduction': 70,
    'Pilot Operating Days': 260,
    'Pilot Revenue Realization': 0.45,
    'Pilot Deliveries per Drone': 32,
    'Scale Deliveries per Drone': 120,
    'Y1 Fleet Active': 0.50,
    'Y2 Fleet Active': 0.75,
    'Y3 Fleet Active': 0.90,
    'Y4 Fleet Active': 0.95,
    'Y5 Fleet Active': 1.00,
    'Y1 Utilization Factor': 0.45,
    'Y2 Utilization Factor': 0.65,
    'Y3 Utilization Factor': 0.78,
    'Y4 Utilization Factor': 0.88,
    'Y5 Utilization Factor': 0.92,
  },
  'Drone First Mile Delivery': {
    'Fleet Size': 30,
    'Drone Unit Cost': 150000,
    'Daily Pickups per Drone': 18,
    'Average Pickup Distance': 15,
    'Cost per Traditional Pickup': 55,
    'Cost per Drone Pickup': 22,
    'Collection Time Reduction': 50,
    'Supply Chain Efficiency': 30,
  },
};

export const ARCHETYPE_BASE_INVESTMENT: Record<string, number> = {
  'Government Digital Transformation': 6_500_000,
  'Disaster Recovery & Business Continuity Platform': 11_000_000,
  'Autonomous Vehicle Platform': 45_000_000,
  'Healthcare Digital System': 12_000_000,
  'Healthcare Digital Transformation': 18_000_000,
  'Insurance Digital Platform': 9_000_000,
  'Education Digital Platform': 7_500_000,
  'Drone Last Mile Delivery': 12_000_000,
  'Drone First Mile Delivery': 18_000_000,
};

export function getDefaultFinancialAssumptions(archetype: string): Pick<FinancialInputs, 'discountRate' | 'adoptionRate' | 'maintenancePercent' | 'contingencyPercent'> {
  const config = getArchetypeConfig(archetype);

  return {
    discountRate: config.assumptions.discountRate * 100,
    adoptionRate: config.assumptions.adoptionRate,
    maintenancePercent: config.assumptions.maintenancePercent,
    contingencyPercent: config.assumptions.contingencyPercent,
  };
}

/**
 * Realistic upper bounds for domain parameters.
 * Prevents AI hallucination (e.g. setting Fleet Size to budget amount)
 * from producing absurd financial projections.
 */
export const DOMAIN_PARAM_MAX: Record<string, Record<string, number>> = {
  // AV bounds are intentionally conservative to prevent AI- or persistence-driven
  // hallucinations like "10,000 vehicles" from overwhelming the regulated-launch model.
  // AV upper bounds reflect early-phase commercialisation reality: fleet caps, realistic trip throughput
  // under operating-zone and trust-curve constraints, realistic operating cost per km (incl. redundant
  // safety, high-premium insurance, sensor recalibration, downtime), and gross driver cost avoided.
  'Autonomous Vehicle Platform': { 'Fleet Size': 500, 'Vehicle Cost': 750_000, 'Taxi Fare Rate': 10, 'Average Trip Distance': 40, 'Daily Trips per Vehicle': 40, 'Fleet Utilization Rate': 0.80, 'Operating Cost per km': 5, 'Driver Cost Savings': 250_000 },
  'Healthcare Digital System': { 'Patient Capacity': 5_000_000, 'Efficiency Gain Percent': 80, 'Staff Hours Saved': 8, 'Cost Per Staff Hour': 500 },
  'Healthcare Digital Transformation': { 'Patient Throughput Increase': 80, 'Medical Error Reduction': 95 },
  'Insurance Digital Platform': { 'Annual Claims Volume': 5_000_000, 'Fraud Detection Rate': 50, 'Average Claim Value': 500_000 },
  'Education Digital Platform': { 'Student Enrollment': 2_000_000, 'Administrative Efficiency Gain': 80 },
  'Government Digital Transformation': { 'Citizen Users': 10_000_000, 'Process Time Reduction': 95, 'Transaction Volume': 50_000_000, 'Processing Time Reduction': 95, 'Staff Efficiency Gain': 80, 'GPU / ML Compute Annual': 8_000_000, 'LLM Inference Cost Annual': 5_000_000, 'MLOps Platform Annual': 3_000_000, 'Data Labeling & Curation Annual': 3_000_000, 'Model Retraining Cycles per Year': 12, 'AI Responsible-Use & Governance Annual': 3_000_000, 'AI Automation Rate': 90 },
  'Disaster Recovery & Business Continuity Platform': { 'Critical Services Protected': 500, 'Annual Service Value at Risk': 500_000_000, 'Expected Downtime Reduction': 95, 'Current RTO': 168, 'Target RTO': 24, 'Current RPO': 72, 'Target RPO': 24, 'Annual DR Exercise Cost': 8_000_000, 'Secondary Site Annual Run Cost': 25_000_000, 'Cyber Resilience Uplift': 80 },
  'Drone Last Mile Delivery': { 'Fleet Size': 180, 'Pilot Fleet Size': 20, 'Drone Unit Cost': 250_000, 'Max Capacity per Drone': 220, 'Fleet Availability': 0.95, 'Demand Utilization': 0.9, 'Weather Regulation Factor': 0.9, 'Premium Fare Rate': 80, 'Pharma Fare Rate': 95, 'B2B Contract Fare Rate': 45, 'Premium Share': 1, 'Pharma Share': 1, 'B2B Share': 1, 'Enterprise Contract Share': 0.9, 'Platform Fee per Delivery': 8, 'Platform Integration Fees Annual': 1_500_000, 'Pilot Partner Delivery Share': 0.85, 'Pilot Partner Ops Offset': 0.45, 'Learning Curve Annual Improvement': 0.12, 'Automation Target': 0.65, 'Idle Time Reduction': 0.2, 'Energy Cost per Flight': 8, 'Maintenance per Flight Hour': 15, 'Battery Depreciation per Flight': 9, 'Communication Cloud per Flight': 4, 'Ground Handling per Delivery': 7, 'Customer Service per Delivery': 4, 'Control Center Annual': 4_000_000, 'Operations Staff Annual': 5_500_000, 'Insurance Annual': 2_500_000, 'Licensing Compliance Annual': 1_200_000, 'Average Delivery Distance': 20, 'Cost per Delivery (Traditional)': 60, 'Delivery Time Reduction': 95, 'Carbon Emission Reduction': 100, 'Pilot Operating Days': 320, 'Pilot Revenue Realization': 0.75, 'Pilot Deliveries per Drone': 50, 'Scale Deliveries per Drone': 140 },
  'Drone First Mile Delivery': { 'Fleet Size': 3000, 'Drone Unit Cost': 1_000_000, 'Daily Pickups per Drone': 60, 'Average Pickup Distance': 100, 'Cost per Traditional Pickup': 300, 'Cost per Drone Pickup': 150, 'Collection Time Reduction': 95, 'Supply Chain Efficiency': 95 },
};

export function sanitizeDomainParameters(archetype: string, params: Record<string, number>): Record<string, number> {
  const maxBounds = DOMAIN_PARAM_MAX[archetype];
  if (!maxBounds) return params;
  const result = { ...params };
  for (const [key, value] of Object.entries(result)) {
    const max = maxBounds[key];
    if (max !== undefined && value > max) {
      result[key] = max;
    }
  }

  if (archetype === 'Drone Last Mile Delivery') {
    const defaults = DEFAULT_DOMAIN_PARAMS[archetype] || {};
    const clampParam = (key: string, min: number, max: number) => {
      const raw = Number(result[key] ?? defaults[key]);
      result[key] = clampNumber(raw, min, max);
    };

    clampParam('Fleet Size', 50, 120);
    clampParam('Pilot Fleet Size', 10, 20);
    clampParam('Max Capacity per Drone', 140, 220);
    clampParam('Fleet Availability', 0.78, 0.9);
    clampParam('Demand Utilization', 0.5, 0.78);
    clampParam('Weather Regulation Factor', 0.72, 0.88);
    clampParam('Premium Fare Rate', 35, 60);
    clampParam('Pharma Fare Rate', 42, 75);
    clampParam('B2B Contract Fare Rate', 22, 40);
    clampParam('Enterprise Contract Share', 0.55, 0.85);
    clampParam('Platform Fee per Delivery', 1.5, 5);
    clampParam('Platform Integration Fees Annual', 200000, 1000000);
    clampParam('Pilot Partner Delivery Share', 0.45, 0.8);
    clampParam('Pilot Partner Ops Offset', 0.15, 0.4);
    clampParam('Learning Curve Annual Improvement', 0.03, 0.1);
    clampParam('Automation Target', 0.25, 0.6);
    clampParam('Idle Time Reduction', 0.03, 0.15);
    clampParam('Energy Cost per Flight', 3, 8);
    clampParam('Maintenance per Flight Hour', 6, 14);
    clampParam('Battery Depreciation per Flight', 4, 8);
    clampParam('Communication Cloud per Flight', 1, 4);
    clampParam('Ground Handling per Delivery', 3.5, 7);
    clampParam('Customer Service per Delivery', 1.5, 4);
    clampParam('Control Center Annual', 1200000, 3500000);
    clampParam('Operations Staff Annual', 1800000, 4500000);
    clampParam('Insurance Annual', 800000, 2200000);
    clampParam('Licensing Compliance Annual', 350000, 1200000);
    clampParam('Average Delivery Distance', 4, 15);
    clampParam('Cost per Delivery (Traditional)', 20, 60);
    clampParam('Delivery Time Reduction', 30, 85);
    clampParam('Carbon Emission Reduction', 30, 90);
    clampParam('Pilot Operating Days', 180, 320);
    clampParam('Pilot Revenue Realization', 0.35, 0.75);
    clampParam('Pilot Deliveries per Drone', 20, 45);
    clampParam('Scale Deliveries per Drone', 90, 140);
  }

  return result;
}

export function getDefaultDomainParameters(archetype: string): Record<string, number> {
  const config = getArchetypeConfig(archetype);
  const configuredParams = (config.assumptions.domainAssumptions || []).reduce<Record<string, number>>((acc, assumption) => {
    if (typeof assumption.value === 'number' && Number.isFinite(assumption.value)) {
      acc[assumption.name] = assumption.value;
    }
    return acc;
  }, {});

  return {
    ...(DEFAULT_DOMAIN_PARAMS[archetype] || {}),
    ...configuredParams,
  };
}
