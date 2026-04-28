import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Clock, 
  FileText as _FileText, 
  Lightbulb, 
  Play as _Play, 
  Plus,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users as _Users,
  Zap,
  ChevronRight,
  Award,
  BarChart3 as _BarChart3,
  Shield,
  Settings,
  Building2 as _Building2
} from "lucide-react";

interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  documentIds?: string[];
  estimatedTime: string;
  isCompleted: boolean;
  tips?: string[];
}

interface Playbook {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedDuration: string;
  steps: PlaybookStep[];
  completedSteps: number;
  icon: string;
  color: string;
}

const PLAYBOOK_TEMPLATES: Playbook[] = [
  {
    id: "digital-transformation",
    title: "Digital Transformation Readiness",
    description: "Assess and prepare your organization for successful digital transformation initiatives",
    category: "Strategic",
    difficulty: "advanced",
    estimatedDuration: "2-3 weeks",
    icon: "rocket",
    color: "from-blue-500 to-indigo-600",
    completedSteps: 0,
    steps: [
      {
        id: "dt-1",
        title: "Review Digital Maturity Policy",
        description: "Understand current digital maturity standards and benchmarks",
        estimatedTime: "2 hours",
        isCompleted: false,
        tips: ["Focus on key performance indicators", "Note gaps in current capabilities"]
      },
      {
        id: "dt-2",
        title: "Analyze Strategic IT Projects",
        description: "Review ongoing and planned IT initiatives for alignment",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Map projects to strategic objectives", "Identify dependencies"]
      },
      {
        id: "dt-3",
        title: "Assess Resource Capacity",
        description: "Evaluate team capacity and skill gaps for transformation",
        estimatedTime: "3 hours",
        isCompleted: false,
        tips: ["Consider training needs", "Identify critical roles"]
      },
      {
        id: "dt-4",
        title: "Define Success Metrics",
        description: "Establish KPIs and measurement framework",
        estimatedTime: "2 hours",
        isCompleted: false,
        tips: ["Use SMART criteria", "Align with UAE Vision 2071"]
      },
      {
        id: "dt-5",
        title: "Create Roadmap",
        description: "Develop phased implementation plan with milestones",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Start with quick wins", "Plan for change management"]
      }
    ]
  },
  {
    id: "policy-compliance",
    title: "Policy Compliance Audit",
    description: "Systematic review of organizational policies for regulatory compliance",
    category: "Regulatory",
    difficulty: "intermediate",
    estimatedDuration: "1 week",
    icon: "shield",
    color: "from-emerald-500 to-teal-600",
    completedSteps: 0,
    steps: [
      {
        id: "pc-1",
        title: "Inventory Current Policies",
        description: "Catalog all active organizational policies",
        estimatedTime: "3 hours",
        isCompleted: false,
        tips: ["Check for expired policies", "Note last review dates"]
      },
      {
        id: "pc-2",
        title: "Map Regulatory Requirements",
        description: "Identify applicable regulations and standards",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Include UAE federal laws", "Consider industry standards"]
      },
      {
        id: "pc-3",
        title: "Gap Analysis",
        description: "Compare policies against regulatory requirements",
        estimatedTime: "6 hours",
        isCompleted: false,
        tips: ["Document specific gaps", "Prioritize critical areas"]
      },
      {
        id: "pc-4",
        title: "Remediation Plan",
        description: "Develop action plan to address compliance gaps",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Assign owners to each gap", "Set realistic timelines"]
      }
    ]
  },
  {
    id: "it-procurement",
    title: "IT Procurement Excellence",
    description: "Best practices for technology procurement and vendor management",
    category: "Operational",
    difficulty: "intermediate",
    estimatedDuration: "1-2 weeks",
    icon: "settings",
    color: "from-purple-500 to-pink-600",
    completedSteps: 0,
    steps: [
      {
        id: "ip-1",
        title: "Review Procurement Policy",
        description: "Understand organizational procurement guidelines",
        estimatedTime: "2 hours",
        isCompleted: false,
        tips: ["Note approval thresholds", "Review vendor criteria"]
      },
      {
        id: "ip-2",
        title: "Prepare Requirements Document",
        description: "Define technical and business requirements",
        estimatedTime: "6 hours",
        isCompleted: false,
        tips: ["Include non-functional requirements", "Consider future scalability"]
      },
      {
        id: "ip-3",
        title: "Develop RFP/Tender",
        description: "Create procurement documentation",
        estimatedTime: "8 hours",
        isCompleted: false,
        tips: ["Use standard templates", "Include evaluation criteria"]
      },
      {
        id: "ip-4",
        title: "Vendor Evaluation",
        description: "Score and compare vendor proposals",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Use weighted scoring", "Consider total cost of ownership"]
      }
    ]
  },
  {
    id: "new-initiative",
    title: "New Initiative Launch",
    description: "Step-by-step guide to launching new organizational initiatives",
    category: "Strategic",
    difficulty: "beginner",
    estimatedDuration: "3-4 days",
    icon: "zap",
    color: "from-orange-500 to-red-600",
    completedSteps: 0,
    steps: [
      {
        id: "ni-1",
        title: "Define Initiative Scope",
        description: "Clearly articulate objectives and boundaries",
        estimatedTime: "2 hours",
        isCompleted: false,
        tips: ["Use SMART goals", "Identify stakeholders"]
      },
      {
        id: "ni-2",
        title: "Stakeholder Analysis",
        description: "Map key stakeholders and their interests",
        estimatedTime: "2 hours",
        isCompleted: false,
        tips: ["Identify champions", "Plan communication strategy"]
      },
      {
        id: "ni-3",
        title: "Resource Planning",
        description: "Identify required resources and budget",
        estimatedTime: "3 hours",
        isCompleted: false,
        tips: ["Include contingency", "Consider external support"]
      },
      {
        id: "ni-4",
        title: "Launch Execution",
        description: "Execute launch plan and monitor progress",
        estimatedTime: "4 hours",
        isCompleted: false,
        tips: ["Celebrate quick wins", "Gather early feedback"]
      }
    ]
  }
];

const getIcon = (iconName: string) => {
  switch (iconName) {
    case "rocket": return <Rocket className="h-5 w-5" />;
    case "shield": return <Shield className="h-5 w-5" />;
    case "settings": return <Settings className="h-5 w-5" />;
    case "zap": return <Zap className="h-5 w-5" />;
    default: return <Target className="h-5 w-5" />;
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "beginner": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "intermediate": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "advanced": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
};

export function KnowledgePlaybooks() {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const loadSavedProgress = (): Playbook[] => {
    try {
      const saved = localStorage.getItem('corevia-playbooks-progress');
      if (saved) {
        const savedProgress = JSON.parse(saved);
        return PLAYBOOK_TEMPLATES.map(template => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const savedPlaybook = savedProgress.find((p: any) => p.id === template.id);
          if (savedPlaybook) {
            const updatedSteps = template.steps.map(step => ({
              ...step,
              isCompleted: savedPlaybook.completedSteps?.includes(step.id) || false
            }));
            return {
              ...template,
              steps: updatedSteps,
              completedSteps: updatedSteps.filter(s => s.isCompleted).length
            };
          }
          return template;
        });
      }
    } catch (e) {
      console.error('Failed to load playbook progress:', e);
    }
    return PLAYBOOK_TEMPLATES;
  };
  
  const [activePlaybook, setActivePlaybook] = useState<Playbook | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>(loadSavedProgress);
  
  const saveProgress = (updatedPlaybooks: Playbook[]) => {
    try {
      const progress = updatedPlaybooks.map(p => ({
        id: p.id,
        completedSteps: p.steps.filter(s => s.isCompleted).map(s => s.id)
      }));
      localStorage.setItem('corevia-playbooks-progress', JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save playbook progress:', e);
    }
  };

  const _handleStartPlaybook = (playbook: Playbook) => {
    setActivePlaybook(playbook);
    toast({
      title: t('knowledge.playbooks.started'),
      description: t('knowledge.playbooks.startedDesc', { title: playbook.title }),
    });
  };

  const handleToggleStep = (playbookId: string, stepId: string) => {
    setPlaybooks(prev => {
      const updated = prev.map(p => {
        if (p.id === playbookId) {
          const updatedSteps = p.steps.map(s => 
            s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s
          );
          const completedCount = updatedSteps.filter(s => s.isCompleted).length;
          return { ...p, steps: updatedSteps, completedSteps: completedCount };
        }
        return p;
      });
      saveProgress(updated);
      return updated;
    });

    if (activePlaybook?.id === playbookId) {
      setActivePlaybook(prev => {
        if (!prev) return prev;
        const updatedSteps = prev.steps.map(s => 
          s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s
        );
        const completedCount = updatedSteps.filter(s => s.isCompleted).length;
        return { ...prev, steps: updatedSteps, completedSteps: completedCount };
      });
    }
  };

  const getProgressPercentage = (playbook: Playbook) => {
    return (playbook.completedSteps / playbook.steps.length) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t('knowledge.playbooks.title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('knowledge.playbooks.subtitle')}
          </p>
        </div>
        <Button data-testid="button-create-playbook">
          <Plus className="h-4 w-4 mr-2" />
          {t('knowledge.playbooks.createCustom')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('knowledge.playbooks.available')}
          </h3>
          
          <div className="grid gap-4">
            {playbooks.map((playbook) => (
              <Card 
                key={playbook.id} 
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => setActivePlaybook(playbook)}
                data-testid={`card-playbook-${playbook.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${playbook.color} text-white`}>
                      {getIcon(playbook.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{t(`knowledge.playbooks.pb.${playbook.id}.title`)}</h4>
                        <Badge variant="secondary" className={getDifficultyColor(playbook.difficulty)}>
                          {t(`knowledge.playbooks.difficulty.${playbook.difficulty}`)}
                        </Badge>
                        <Badge variant="outline">{t(`knowledge.playbooks.pb.${playbook.id}.category`)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{t(`knowledge.playbooks.pb.${playbook.id}.description`)}</p>
                      
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {t(`knowledge.playbooks.pb.${playbook.id}.duration`)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Target className="h-4 w-4" />
                          {t('knowledge.playbooks.stepsCount', { count: playbook.steps.length })}
                        </div>
                        {playbook.completedSteps > 0 && (
                          <div className="flex items-center gap-1 text-sm text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            {t('knowledge.playbooks.completeCount', { completed: playbook.completedSteps, total: playbook.steps.length })}
                          </div>
                        )}
                      </div>
                      
                      {playbook.completedSteps > 0 && (
                        <Progress 
                          value={getProgressPercentage(playbook)} 
                          className="mt-3 h-2"
                        />
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {activePlaybook ? (
            <Card className="sticky top-4">
              <CardHeader className={`bg-gradient-to-br ${activePlaybook.color} text-white rounded-t-lg`}>
                <div className="flex items-center gap-3">
                  {getIcon(activePlaybook.icon)}
                  <div>
                    <CardTitle className="text-lg">{t(`knowledge.playbooks.pb.${activePlaybook.id}.title`)}</CardTitle>
                    <CardDescription className="text-white/80">
                      {t('knowledge.playbooks.stepsCompleted', { completed: activePlaybook.completedSteps, total: activePlaybook.steps.length })}
                    </CardDescription>
                  </div>
                </div>
                <Progress 
                  value={getProgressPercentage(activePlaybook)} 
                  className="mt-2 bg-white/20"
                />
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {activePlaybook.steps.map((step, index) => (
                      <div 
                        key={step.id}
                        className={`p-3 rounded-lg border transition-all ${
                          step.isCompleted 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                            : 'bg-muted/30 border-border'
                        }`}
                        data-testid={`step-${step.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleToggleStep(activePlaybook.id, step.id)}
                            className="mt-0.5"
                            data-testid={`button-toggle-step-${step.id}`}
                          >
                            {step.isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {t('knowledge.playbooks.stepLabel', { number: index + 1 })}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {t(`knowledge.playbooks.pb.${activePlaybook.id}.steps.${step.id}.time`)}
                              </Badge>
                            </div>
                            <h5 className={`font-medium mt-1 ${step.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                              {t(`knowledge.playbooks.pb.${activePlaybook.id}.steps.${step.id}.title`)}
                            </h5>
                            <p className="text-sm text-muted-foreground mt-1">{t(`knowledge.playbooks.pb.${activePlaybook.id}.steps.${step.id}.description`)}</p>
                            
                            {step.tips && step.tips.length > 0 && !step.isCompleted && (
                              <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                  <Lightbulb className="h-3 w-3" />
                                  {t('knowledge.playbooks.tips')}
                                </div>
                                <ul className="mt-1 space-y-1">
                                  {step.tips.map((tip, i) => (
                                    <li key={i} className="text-xs text-amber-600 dark:text-amber-500">
                                      {t(`knowledge.playbooks.pb.${activePlaybook.id}.steps.${step.id}.tips.${i}`)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {activePlaybook.completedSteps === activePlaybook.steps.length && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
                    <Award className="h-8 w-8 text-emerald-600 mx-auto" />
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mt-2">
                      {t('knowledge.playbooks.completedTitle')}
                    </h4>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                      {t('knowledge.playbooks.completedMessage')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-semibold">{t('knowledge.playbooks.selectPlaybook')}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('knowledge.playbooks.selectPlaybookDesc')}
                </p>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('knowledge.playbooks.aiRecommendations')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{t('knowledge.playbooks.basedOnDocs')}</span>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  {t('knowledge.playbooks.docRecommendation')}
                </p>
              </div>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-sm">
                <span className="text-purple-600 dark:text-purple-400 font-medium">{t('knowledge.playbooks.popularInOrg')}</span>
                <p className="text-purple-700 dark:text-purple-300 mt-1">
                  {t('knowledge.playbooks.popularDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
