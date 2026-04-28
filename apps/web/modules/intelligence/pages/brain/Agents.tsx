import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Plus,
  Play,
  History,
  Settings2,
  Shield,
  TrendingUp,
  Clock,
  Activity,
  Trash2,
  Zap,
  BarChart3,
  Search,
  Brain,
  FileCheck,
  Target,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import { fetchAgents, toggleAgent, registerAgent, removeAgent, executeAgent, fetchAgentHistory, fetchControlPlane, setAgentThrottle } from "@/api/brain";
import { queryClient } from "@/lib/queryClient";
import type { Agent } from "@shared/contracts/brain";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  governance: Shield,
  risk: AlertTriangle,
  strategy: Target,
  quality: FileCheck,
  intelligence: Brain,
  analysis: BarChart3,
  planning: Activity,
  execution: Zap,
  financial: Landmark,
  custom: Settings2,
  general: Bot,
};

const CATEGORY_COLORS: Record<string, string> = {
  governance: "bg-blue-500/10 text-blue-600",
  risk: "bg-amber-500/10 text-amber-600",
  strategy: "bg-purple-500/10 text-purple-600",
  quality: "bg-emerald-500/10 text-emerald-600",
  intelligence: "bg-cyan-500/10 text-cyan-600",
  analysis: "bg-indigo-500/10 text-indigo-600",
  planning: "bg-orange-500/10 text-orange-600",
  execution: "bg-orange-500/10 text-orange-600",
  financial: "bg-green-500/10 text-green-600",
  custom: "bg-pink-500/10 text-pink-600",
  general: "bg-gray-500/10 text-gray-600",
};

export function Agents() {
  const [activeTab, setActiveTab] = useState("registry");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [testTask, setTestTask] = useState("");
  const [testParams, setTestParams] = useState("{}");
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [executionThrottle, setExecutionThrottle] = useState(100);
  const [newAgent, setNewAgent] = useState({
    id: "",
    name: "",
    description: "",
    capabilities: "",
    requiredClassification: "internal",
    category: "custom",
  });
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const { data: controlPlaneData } = useQuery({
    queryKey: ["control-plane"],
    queryFn: fetchControlPlane,
  });

  useEffect(() => {
    const remoteThrottle = controlPlaneData?.state?.agentThrottle;
    if (remoteThrottle != null && remoteThrottle !== executionThrottle) {
      setExecutionThrottle(remoteThrottle);
    }
  }, [controlPlaneData, executionThrottle]);

  const { data: historyData } = useQuery({
    queryKey: ["agents", "history", selectedAgent?.id],
    queryFn: () => fetchAgentHistory(selectedAgent?.id),
    enabled: activeTab === "history",
  });

  const toggleMutation = useMutation({
    mutationFn: ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
      toggleAgent(agentId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: t('brain.agents.agentUpdated') });
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowRegisterDialog(false);
      setNewAgent({ id: "", name: "", description: "", capabilities: "", requiredClassification: "internal", category: "custom" });
      toast({ title: t('brain.agents.registeredSuccess') });
    },
    onError: (err: unknown) => {
      toast({
        title: t('brain.agents.registrationFailed'),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({ title: t('brain.agents.agentRemoved') });
    },
    onError: (err: unknown) => {
      toast({
        title: t('brain.agents.cannotRemove'),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: ({ agentId, task, parameters }: { agentId: string; task: string; parameters?: Record<string, unknown> }) =>
      executeAgent(agentId, task, parameters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents", "history"] });
    },
  });

  const throttleMutation = useMutation({
    mutationFn: (value: number) => setAgentThrottle(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["control-plane"] });
    },
  });

  const agents: Agent[] = data?.agents || [];
  const stats = data?.stats;

  const categories = Array.from(new Set(agents.map((a) => a.config?.category || "general")));

  const filteredAgents = agents.filter((a) => {
    const cat = a.config?.category || "general";
    const matchesCat = categoryFilter === "all" || cat === categoryFilter;
    const matchesSearch = !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleRegister = () => {
    const caps = newAgent.capabilities.split(",").map(c => c.trim()).filter(Boolean);
    if (!newAgent.id || !newAgent.name || !newAgent.description || caps.length === 0) {
      toast({ title: t('brain.agents.allFieldsRequired'), variant: "destructive" });
      return;
    }
    registerMutation.mutate({
      id: newAgent.id,
      name: newAgent.name,
      description: newAgent.description,
      capabilities: caps,
      requiredClassification: newAgent.requiredClassification,
      category: newAgent.category,
    });
  };

  const handleTestExecute = () => {
    if (executionThrottle <= 0) {
      toast({ title: t('brain.agents.executionPaused'), description: t('brain.agents.increaseThrottle'), variant: "destructive" });
      return;
    }
    if (!selectedAgent || !testTask) return;
    let params: Record<string, unknown> | undefined;
    try {
      params = testParams ? JSON.parse(testParams) : undefined;
    } catch {
      toast({ title: t('brain.agents.invalidJson'), variant: "destructive" });
      return;
    }
    executeMutation.mutate({ agentId: selectedAgent.id, task: testTask, parameters: params });
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-6">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.2)_0%,transparent_70%)]" />
        <div className="absolute left-0 bottom-0 h-36 w-36 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.2)_0%,transparent_70%)]" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-overline text-muted-foreground">{t('brain.agents.executionMesh')}</p>
            <h1 className="text-2xl font-bold">{t('brain.agents.title')}</h1>
            <p className="text-muted-foreground">{t('brain.agents.description')}</p>
          </div>
        <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('brain.agents.registerAgent')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('brain.agents.registerNewAgent')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('brain.agents.agentId')}</label>
                <Input
                  placeholder={t('brain.agents.agentIdPlaceholder')}
                  value={newAgent.id}
                  onChange={e => setNewAgent(p => ({ ...p, id: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('brain.agents.name')}</label>
                <Input
                  placeholder={t('brain.agents.namePlaceholder')}
                  value={newAgent.name}
                  onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('brain.agents.descriptionLabel')}</label>
                <Textarea
                  placeholder={t('brain.agents.descriptionPlaceholder')}
                  value={newAgent.description}
                  onChange={e => setNewAgent(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('brain.agents.capabilities')}</label>
                <Input
                  placeholder={t('brain.agents.capabilitiesPlaceholder')}
                  value={newAgent.capabilities}
                  onChange={e => setNewAgent(p => ({ ...p, capabilities: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('brain.agents.classification')}</label>
                  <Select value={newAgent.requiredClassification} onValueChange={v => setNewAgent(p => ({ ...p, requiredClassification: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t('brain.agents.public')}</SelectItem>
                      <SelectItem value="internal">{t('brain.agents.internal')}</SelectItem>
                      <SelectItem value="confidential">{t('brain.agents.confidential')}</SelectItem>
                      <SelectItem value="sovereign">{t('brain.agents.sovereign')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('brain.agents.category')}</label>
                  <Select value={newAgent.category} onValueChange={v => setNewAgent(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t('brain.agents.custom')}</SelectItem>
                      <SelectItem value="governance">{t('brain.agents.governance')}</SelectItem>
                      <SelectItem value="risk">{t('brain.agents.risk')}</SelectItem>
                      <SelectItem value="strategy">{t('brain.agents.strategy')}</SelectItem>
                      <SelectItem value="financial">{t('brain.agents.financial')}</SelectItem>
                      <SelectItem value="intelligence">{t('brain.agents.intelligence')}</SelectItem>
                      <SelectItem value="quality">{t('brain.agents.quality')}</SelectItem>
                      <SelectItem value="execution">{t('brain.agents.execution')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t('app.cancel')}</Button>
              </DialogClose>
              <Button onClick={handleRegister} disabled={registerMutation.isPending}>
                {registerMutation.isPending ? t('brain.agents.registering') : t('brain.agents.register')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </section>

      <Card className="executive-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">{t('brain.agents.executionThrottle')}</p>
              <p className="text-lg font-semibold">{executionThrottle}% {t('brain.agents.capacity')}</p>
              <p className="text-xs text-muted-foreground">{t('brain.agents.throttleHint')}</p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={executionThrottle}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setExecutionThrottle(value);
                  throttleMutation.mutate(value);
                }}
                className="w-40 accent-emerald-500"
                aria-label="Execution throttle"
              />
              <Badge className={executionThrottle === 0 ? "bg-rose-500/10 text-rose-700 border-rose-500/30" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"}>
                {executionThrottle === 0 ? t('brain.agents.paused') : t('brain.agents.active')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalAgents}</p>
                    <p className="text-xs text-muted-foreground">{t('brain.agents.totalAgents')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.activeAgents}</p>
                    <p className="text-xs text-muted-foreground">{t('brain.agents.activeAgents')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalExecutions}</p>
                    <p className="text-xs text-muted-foreground">{t('brain.agents.runtimeExecutions')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{Object.keys(stats.categories).length}</p>
                    <p className="text-xs text-muted-foreground">{t('brain.agents.categories')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">{t('brain.agents.statsHint')}</p>
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="registry">
            <Bot className="h-4 w-4 mr-1.5" />
            {t('brain.agents.registry')}
          </TabsTrigger>
          <TabsTrigger value="test">
            <Play className="h-4 w-4 mr-1.5" />
            {t('brain.agents.testLab')}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1.5" />
            {t('brain.agents.history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('brain.agents.searchPlaceholder')}
                className="pl-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('brain.agents.allCategories')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('brain.agents.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((agent) => {
                const config = (agent.config || {}) as Partial<NonNullable<Agent["config"]>>;
                const category = config.category || "general";
                const CategoryIcon = CATEGORY_ICONS[category] || Bot;
                const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;

                return (
                  <Card key={agent.id} className={config.enabled ? "" : "opacity-60"}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          {config.isBuiltIn && (
                            <Badge variant="outline" className="text-xs">{t('brain.agents.builtIn')}</Badge>
                          )}
                          <Switch
                            checked={config.enabled !== false}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ agentId: agent.id, enabled: checked })
                            }
                          />
                        </div>
                      </div>
                      <CardTitle className="text-base mt-3">{agent.name}</CardTitle>
                      <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.slice(0, 4).map((cap: string) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replaceAll('_', ' ')}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 4 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.capabilities.length - 4}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {agent.requiredClassification || "internal"}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {config.successRate ?? 100}% {t('brain.agents.success')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {config.executionCount ?? 0} {t('brain.agents.runs')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setActiveTab("test");
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {t('brain.agents.test')}
                        </Button>
                        {!config.isBuiltIn && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => removeMutation.mutate(agent.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('brain.agents.testLabTitle')}</CardTitle>
              <CardDescription>{t('brain.agents.testLabDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('brain.agents.agent')}</label>
                  <Select
                    value={selectedAgent?.id || ""}
                    onValueChange={v => setSelectedAgent(agents.find(a => a.id === v) || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('brain.agents.selectAgent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter((a) => a.config?.enabled !== false).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('brain.agents.taskDescription')}</label>
                  <Input
                    placeholder={t('brain.agents.taskPlaceholder')}
                    value={testTask}
                    onChange={e => setTestTask(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t('brain.agents.parametersJson')}</label>
                <Textarea
                  className="font-mono text-sm"
                  rows={3}
                  placeholder='{"budget": 5000000, "timeline": "12_months"}'
                  value={testParams}
                  onChange={e => setTestParams(e.target.value)}
                />
              </div>
              <Button
                onClick={handleTestExecute}
                disabled={!selectedAgent || !testTask || executeMutation.isPending || executionThrottle === 0}
              >
                {executeMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    {t('brain.agents.executing')}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {t('brain.agents.executeTest')}
                  </>
                )}
              </Button>

              {executeMutation.data && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {executeMutation.data.success ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <CardTitle className="text-base">
                        {executeMutation.data.success ? t('brain.agents.executionSuccessful') : t('brain.agents.executionFailed')}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t('brain.agents.confidence')}</p>
                        <p className="text-lg font-bold">{Math.round((executeMutation.data.confidence || 0) * 100)}%</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t('brain.agents.time')}</p>
                        <p className="text-lg font-bold">{executeMutation.data.executionTimeMs}ms</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t('brain.agents.status')}</p>
                        <p className="text-lg font-bold">{executeMutation.data.success ? t('brain.agents.pass') : t('brain.agents.fail')}</p>
                      </div>
                    </div>
                    {executeMutation.data.reasoning && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t('brain.agents.reasoning')}</p>
                        <p className="text-sm text-muted-foreground">{executeMutation.data.reasoning}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('brain.agents.result')}</p>
                      <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-64">
                        {JSON.stringify(executeMutation.data.result, null, 2)}
                      </pre>
                    </div>
                    {executeMutation.data.errors && executeMutation.data.errors.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">{t('brain.agents.errors')}</p>
                        {executeMutation.data.errors.map((err) => (
                          <p key={err} className="text-sm text-destructive">{err}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={selectedAgent?.id || "all"}
              onValueChange={v => setSelectedAgent(v === "all" ? null : (agents.find(a => a.id === v) || null))}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder={t('brain.agents.allAgents')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('brain.agents.allAgents')}</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('brain.agents.executionHistory')}</CardTitle>
              <CardDescription>{t('brain.agents.executionHistoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {historyData?.history?.length ? (
                <div className="space-y-2">
                  {historyData.history.map((entry) => (
                    <div key={`${entry.agentId}-${entry.executionTimeMs}-${entry.task ?? ''}`} className="flex items-center gap-3 p-3 rounded-md border">
                      {entry.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{entry.agentId}</span>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(entry.confidence * 100)}%
                          </Badge>
                        </div>
                        {entry.task && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.task}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{entry.executionTimeMs}ms</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t('brain.agents.noHistory')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('brain.agents.noHistoryHint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
