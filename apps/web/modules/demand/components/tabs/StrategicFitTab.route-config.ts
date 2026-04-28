import {
  Building2,
  Users,
  Code,
  GitBranch,
} from "lucide-react";

export const ROUTE_TYPES = [
  {
    type: 'vendor_management',
    route: 'VENDOR_MANAGEMENT',
    label: 'Vendor Management (RFP)',
    icon: Building2,
    color: 'blue',
    description: 'External procurement through formal RFP process',
    whenToUse: 'Large-scale projects requiring specialized external expertise, budgets >1M AED'
  },
  {
    type: 'pmo_office',
    route: 'PMO_OFFICE',
    label: 'PMO Office',
    icon: Users,
    color: 'purple',
    description: 'Centralized program management office coordination',
    whenToUse: 'Multi-department strategic initiatives, organization-wide transformation'
  },
  {
    type: 'it_development',
    route: 'IT_DEVELOPMENT',
    label: 'IT Development Team',
    icon: Code,
    color: 'green',
    description: 'In-house development by internal IT resources',
    whenToUse: 'Custom internal solutions, existing team capabilities, <500K AED'
  },
  {
    type: 'hybrid',
    route: 'HYBRID',
    label: 'Hybrid Approach',
    icon: GitBranch,
    color: 'orange',
    description: 'Combined approach leveraging multiple routes',
    whenToUse: 'Complex projects requiring diverse expertise and phased delivery'
  }
] as const;