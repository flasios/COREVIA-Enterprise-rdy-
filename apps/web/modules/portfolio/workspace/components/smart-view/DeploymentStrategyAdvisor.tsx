import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Rocket, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Loader2,
  RefreshCw,
  Shield as _Shield,
  Zap,
  Users,
  GitBranch,
  Server,
  Cloud,
  Layers,
  ArrowRight,
  Star,
  TrendingUp
} from 'lucide-react';
import { VideoLogo } from '@/components/ui/video-logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import type { DeploymentStrategy, DeploymentRecommendation, WbsTaskData } from './types';

interface DeploymentStrategyAdvisorProps {
  projectId: string;
  projectName: string;
  projectType?: string;
  tasks: WbsTaskData[];
  onRecommendationGenerated?: (recommendation: DeploymentRecommendation) => void;
}

interface DeploymentStrategyResponse {
  recommendation?: DeploymentRecommendation;
}

const DEPLOYMENT_STRATEGIES: DeploymentStrategy[] = [
  {
    id: 'big-bang',
    name: 'Big Bang Deployment',
    description: 'Complete system replacement at once - all users switch simultaneously',
    suitabilityScore: 0,
    pros: ['Simple execution', 'Single cutover event', 'No parallel systems'],
    cons: ['High risk', 'No rollback safety net', 'All-or-nothing'],
    riskLevel: 'high',
    estimatedDuration: '1-2 days',
    requiredResources: ['Full team on standby', 'Extended support hours'],
    bestFor: ['Small systems', 'Non-critical applications', 'Complete rewrites']
  },
  {
    id: 'phased',
    name: 'Phased Rollout',
    description: 'Deploy in planned phases by module, location, or user group',
    suitabilityScore: 0,
    pros: ['Controlled risk', 'Learn from each phase', 'Manageable scope'],
    cons: ['Longer timeline', 'Integration complexity', 'Parallel support'],
    riskLevel: 'medium',
    estimatedDuration: '2-8 weeks',
    requiredResources: ['Phase coordinators', 'Integration testing team'],
    bestFor: ['Large enterprises', 'Multiple locations', 'Complex integrations']
  },
  {
    id: 'parallel',
    name: 'Parallel Running',
    description: 'Old and new systems run simultaneously for validation period',
    suitabilityScore: 0,
    pros: ['Safest approach', 'Data validation', 'Easy rollback'],
    cons: ['Resource intensive', 'User confusion', 'Data sync challenges'],
    riskLevel: 'low',
    estimatedDuration: '4-12 weeks',
    requiredResources: ['Double infrastructure', 'Data reconciliation team'],
    bestFor: ['Critical systems', 'Financial applications', 'Regulatory compliance']
  },
  {
    id: 'canary',
    name: 'Canary Release',
    description: 'Deploy to small subset of users, monitor, then expand',
    suitabilityScore: 0,
    pros: ['Early detection', 'Limited blast radius', 'Quick rollback'],
    cons: ['Requires feature flags', 'Complex routing', 'Monitoring overhead'],
    riskLevel: 'low',
    estimatedDuration: '1-4 weeks',
    requiredResources: ['Feature flag system', 'A/B testing infrastructure'],
    bestFor: ['Web applications', 'SaaS products', 'Continuous delivery']
  },
  {
    id: 'blue-green',
    name: 'Blue-Green Deployment',
    description: 'Two identical production environments with instant switchover',
    suitabilityScore: 0,
    pros: ['Zero downtime', 'Instant rollback', 'Full testing in production'],
    cons: ['Double infrastructure cost', 'Database sync complexity'],
    riskLevel: 'low',
    estimatedDuration: '1-3 days',
    requiredResources: ['Duplicate environment', 'Load balancer control'],
    bestFor: ['High availability systems', 'E-commerce', 'APIs']
  },
  {
    id: 'rolling',
    name: 'Rolling Deployment',
    description: 'Gradually replace instances/servers one at a time',
    suitabilityScore: 0,
    pros: ['No downtime', 'Gradual validation', 'Resource efficient'],
    cons: ['Version mixing', 'Session management', 'Longer rollout'],
    riskLevel: 'medium',
    estimatedDuration: '2-7 days',
    requiredResources: ['Orchestration tools', 'Health monitoring'],
    bestFor: ['Microservices', 'Container environments', 'Stateless apps']
  }
];

export function DeploymentStrategyAdvisor({ 
  projectId,
  projectName,
  projectType,
  tasks,
  onRecommendationGenerated 
}: DeploymentStrategyAdvisorProps) {
  const [recommendation, setRecommendation] = useState<DeploymentRecommendation | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const isTaskLevel = tasks.length === 1;
  const currentTask = isTaskLevel ? tasks[0] : null;

  const recommendationMutation = useMutation<DeploymentStrategyResponse, Error>({
    mutationFn: async () => {
      const taskNameLower = (currentTask?.taskName || currentTask?.title || '').toLowerCase();
      const response = await apiRequest('POST', '/api/ai/deployment-strategy', {
        projectId,
        projectName,
        projectType,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        taskName: currentTask?.taskName || currentTask?.title,
        taskType: currentTask?.taskType,
        taskPriority: currentTask?.priority,
        hasIntegrations: taskNameLower.includes('integration') || taskNameLower.includes('api') || taskNameLower.includes('connect'),
        hasMigration: taskNameLower.includes('migration') || taskNameLower.includes('migrate') || taskNameLower.includes('transfer'),
        hasTraining: taskNameLower.includes('training') || taskNameLower.includes('onboard'),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.recommendation) {
        setRecommendation(data.recommendation);
        setSelectedStrategy(data.recommendation.primaryStrategy.id);
        onRecommendationGenerated?.(data.recommendation);
      }
    },
  });

  const getStrategyIcon = (id: string) => {
    switch (id) {
      case 'big-bang': return Zap;
      case 'phased': return Layers;
      case 'parallel': return GitBranch;
      case 'canary': return TrendingUp;
      case 'blue-green': return Server;
      case 'rolling': return Cloud;
      default: return Rocket;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Rocket className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              {isTaskLevel ? 'Task Deployment Strategy' : 'Deployment Strategy Advisor'}
            </h4>
            <p className="text-[10px] text-muted-foreground">
              {isTaskLevel ? 'AI recommendations for this task' : 'AI-powered best practices analysis'}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={recommendation ? 'outline' : 'default'}
          onClick={() => recommendationMutation.mutate()}
          disabled={recommendationMutation.isPending}
          className="h-8"
          data-testid="btn-get-deployment-recommendation"
        >
          {recommendationMutation.isPending ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : recommendation ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Re-analyze
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1.5" />
              Get Recommendation
            </>
          )}
        </Button>
      </div>

      {recommendationMutation.isPending && (
        <div className="p-6 bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-teal-500/5 rounded-xl border border-blue-500/20">
          <div className="flex flex-col items-center gap-4">
            <VideoLogo size="sm" />
            <div className="text-center">
              <p className="text-sm font-medium">Analyzing deployment options...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Evaluating project characteristics and best practices
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Progress value={60} className="h-1" />
            </div>
          </div>
        </div>
      )}

      {recommendation && !recommendationMutation.isPending && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-xl border border-blue-500/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold">Recommended: {recommendation.primaryStrategy.name}</h5>
                  <Badge className={getRiskColor(recommendation.primaryStrategy.riskLevel)}>
                    {recommendation.primaryStrategy.riskLevel} risk
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {recommendation.primaryStrategy.description}
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{recommendation.primaryStrategy.estimatedDuration}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{recommendation.primaryStrategy.requiredResources.length} resource types</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-card/50 rounded-xl border border-border/30">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Project Fit Analysis
            </h5>
            <p className="text-sm">{recommendation.projectFitAnalysis}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Advantages
              </h5>
              <ul className="space-y-1.5">
                {recommendation.primaryStrategy.pros.map((pro, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Considerations
              </h5>
              <ul className="space-y-1.5">
                {recommendation.primaryStrategy.cons.map((con, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {recommendation.implementationSteps.length > 0 && (
            <div className="p-4 bg-card/50 rounded-xl border border-border/30">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ArrowRight className="w-3.5 h-3.5" />
                Implementation Steps
              </h5>
              <ol className="space-y-2">
                {recommendation.implementationSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recommendation.alternativeStrategies.length > 0 && (
            <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Alternative Strategies
              </h5>
              <div className="grid grid-cols-3 gap-2">
                {recommendation.alternativeStrategies.map((strategy) => {
                  const Icon = getStrategyIcon(strategy.id);
                  return (
                    <button
                      key={strategy.id}
                      onClick={() => setSelectedStrategy(strategy.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        selectedStrategy === strategy.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-border bg-card/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium truncate">{strategy.name}</span>
                      </div>
                      <Badge variant="outline" className={`${getRiskColor(strategy.riskLevel)} text-[9px]`}>
                        {strategy.riskLevel}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Generated {new Date(recommendation.generatedAt).toLocaleString()}
          </p>
        </div>
      )}

      {!recommendation && !recommendationMutation.isPending && (
        <div className="grid grid-cols-3 gap-2">
          {DEPLOYMENT_STRATEGIES.slice(0, 6).map((strategy) => {
            const Icon = getStrategyIcon(strategy.id);
            return (
              <div
                key={strategy.id}
                className="p-3 rounded-lg border border-border/30 bg-card/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium">{strategy.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2">
                  {strategy.description}
                </p>
                <Badge variant="outline" className={`${getRiskColor(strategy.riskLevel)} text-[9px] mt-2`}>
                  {strategy.riskLevel} risk
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
