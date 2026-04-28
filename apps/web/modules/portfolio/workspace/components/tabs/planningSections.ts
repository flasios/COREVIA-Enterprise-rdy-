import { BarChart3, CheckSquare, GitBranch, Layers, Package, ShieldAlert, Users } from 'lucide-react';

export const PLANNING_SECTIONS = [
  { id: 'wbs', label: 'Work Breakdown', icon: Layers, description: 'Task structure' },
  { id: 'cost', label: 'Cost', icon: BarChart3, description: 'Budget breakdown' },
  { id: 'risk-register', label: 'Risk Register', icon: ShieldAlert, description: 'Approved + AI-synthesized risks' },
  { id: 'deliverables', label: 'Deliverables', icon: Package, description: 'Expected outputs' },
  { id: 'resources', label: 'Resources', icon: Users, description: 'Team allocation' },
  { id: 'dependencies', label: 'Dependencies', icon: GitBranch, description: 'Task links' },
  { id: 'planning-gate', label: 'Planning Gate', icon: CheckSquare, description: 'G1 readiness checklist' },
];
