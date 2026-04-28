/**
 * COREVIA Integration Hub — Admin UI Page
 * ==========================================
 * Full connector management dashboard with:
 *  - Connector catalog with templates
 *  - Create/configure connectors
 *  - Health monitoring
 *  - Test connections
 *  - Execution logs
 *  - Statistics
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription as _CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plug,
  Plus,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TestTube2,
  Trash2,
  Settings,
  Database,
  Ticket,
  Users,
  Cloud,
  ShieldCheck,
  GitBranch,
  MessageSquare,
  BarChart3,
  UserCog,
  Cable,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntegrationApiResponse<T> {
  success?: boolean;
  data: T;
  message?: string;
}

interface IntegrationOverview {
  totalConnectors: number;
  activeConnectors: number;
  errorConnectors: number;
}

interface IntegrationTemplate {
  id: string;
  category: string;
  name: string;
  description?: string;
  endpointCount?: number;
  authType?: string;
  requiredFields?: string[];
  documentationUrl?: string;
  baseUrl?: string;
}

interface IntegrationConnectorHealth {
  circuitState?: string;
  latencyMs?: number;
}

interface IntegrationConnector {
  id: string;
  category: string;
  name: string;
  status: string;
  description?: string;
  protocol?: string;
  enabled: boolean;
  health?: IntegrationConnectorHealth;
}

interface IntegrationCategory {
  id: string;
  name: string;
}

interface TestConnectionResult {
  success?: boolean;
  message?: string;
  data?: {
    success?: boolean;
    message?: string;
  };
}

// ─── API Functions ──────────────────────────────────────────────────────────

const api = {
  getOverview: (): Promise<IntegrationApiResponse<IntegrationOverview>> =>
    fetch("/api/integration-hub/overview").then(r => r.json()),
  getTemplates: (): Promise<IntegrationApiResponse<IntegrationTemplate[]>> =>
    fetch("/api/integration-hub/templates").then(r => r.json()),
  getCategories: (): Promise<IntegrationApiResponse<IntegrationCategory[]>> =>
    fetch("/api/integration-hub/categories").then(r => r.json()),
  getConnectors: (category?: string) => {
    const params = category ? `?category=${category}` : "";
    return fetch(`/api/integration-hub/connectors${params}`).then(r => r.json()) as Promise<IntegrationApiResponse<IntegrationConnector[]>>;
  },
  getConnector: (id: string) => fetch(`/api/integration-hub/connectors/${id}`).then(r => r.json()),
  createFromTemplate: (data: {
    templateId: string;
    name: string;
    baseUrl?: string;
    auth?: Record<string, string>;
  }) => fetch("/api/integration-hub/connectors/from-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(r => r.json()) as Promise<IntegrationApiResponse<IntegrationConnector>>,
  toggleConnector: (id: string, enabled: boolean) => fetch(`/api/integration-hub/connectors/${id}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }).then(r => r.json()),
  testConnection: (id: string) => fetch(`/api/integration-hub/connectors/${id}/test`, { method: "POST" }).then(r => r.json()) as Promise<TestConnectionResult>,
  deleteConnector: (id: string) => fetch(`/api/integration-hub/connectors/${id}`, { method: "DELETE" }).then(r => r.json()),
  getConnectorStats: (id: string) => fetch(`/api/integration-hub/connectors/${id}/stats`).then(r => r.json()),
  getConnectorLogs: (id: string) => fetch(`/api/integration-hub/connectors/${id}/logs?limit=20`).then(r => r.json()),
  resetCircuit: (id: string) => fetch(`/api/integration-hub/connectors/${id}/reset-circuit`, { method: "POST" }).then(r => r.json()),
  getHealth: () => fetch("/api/integration-hub/health").then(r => r.json()),
  updateConnector: (id: string, data: unknown) => fetch(`/api/integration-hub/connectors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(r => r.json()),
};

// ─── Category Icons ─────────────────────────────────────────────────────────

const categoryIcons: Record<string, ReactNode> = {
  erp: <Database className="h-4 w-4" />,
  itsm: <Ticket className="h-4 w-4" />,
  crm: <Users className="h-4 w-4" />,
  hr: <UserCog className="h-4 w-4" />,
  cloud: <Cloud className="h-4 w-4" />,
  government: <ShieldCheck className="h-4 w-4" />,
  devops: <GitBranch className="h-4 w-4" />,
  communication: <MessageSquare className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  custom: <Plug className="h-4 w-4" />,
};

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: ReactNode }> = {
    active: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
    inactive: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    error: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    degraded: { variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
    configuring: { variant: "outline", icon: <Settings className="h-3 w-3 animate-spin" /> },
  };
  const cfg = variants[status] ?? { variant: "secondary" as const, icon: <Clock className="h-3 w-3" /> };
  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs">
      {cfg.icon} {status}
    </Badge>
  );
}

// ─── Template Card ──────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect }: { template: IntegrationTemplate; onSelect: () => void }) {
  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {categoryIcons[template.category] || <Plug className="h-4 w-4" />}
            <CardTitle className="text-sm">{template.name}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">{template.category.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{template.endpointCount} endpoints</span>
          <Badge variant="secondary" className="text-xs">{template.authType}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Connector Dialog ────────────────────────────────────────────────

function CreateConnectorDialog({ template, onClose }: { template: IntegrationTemplate; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(template.name);
  const [baseUrl, setBaseUrl] = useState("");
  const [authFields, setAuthFields] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: {
      templateId: string;
      name: string;
      baseUrl?: string;
      auth?: Record<string, string>;
    }) => api.createFromTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
      toast({ title: t('integration.connectorCreated'), description: t('integration.connectorCreatedDesc', { name }) });
      onClose();
    },
    onError: (err: unknown) => {
      const description = err instanceof Error ? err.message : t('integration.failedToCreateConnector');
      toast({ title: t('app.error'), description, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      templateId: template.id,
      name,
      baseUrl: baseUrl || undefined,
      auth: Object.keys(authFields).length > 0 ? authFields : undefined,
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {categoryIcons[template.category]} Configure {template.name}
        </DialogTitle>
        <DialogDescription>
          {t('integration.connectorConfigDesc')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div>
          <Label htmlFor="connectorName">{t('integration.connectorName')}</Label>
          <Input id="connectorName" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="baseUrl">{t('integration.baseUrl')}</Label>
          <Input id="baseUrl" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={template.baseUrl || "https://..."} />
        </div>

        {template.requiredFields?.map((field: string) => {
          if (field === "baseUrl") return null;
          const isSecret = ["password", "apiKey", "bearerToken", "clientSecret"].includes(field);
          return (
            <div key={field}>
              <Label htmlFor={field}>{field.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}</Label>
              <Input
                id={field}
                type={isSecret ? "password" : "text"}
                value={authFields[field] || ""}
                onChange={e => setAuthFields(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder={isSecret ? "••••••••" : `Enter ${field}`}
              />
            </div>
          );
        })}

        {template.documentationUrl && (
          <p className="text-xs text-muted-foreground">
            📖 <a href={template.documentationUrl} target="_blank" rel="noreferrer" className="underline">API Documentation</a>
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>{t('app.cancel')}</Button>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {t('integration.createConnector')}
        </Button>
      </div>
    </DialogContent>
  );
}

// ─── Connector Row ──────────────────────────────────────────────────────────

function ConnectorRow({ connector, onRefresh }: { connector: IntegrationConnector; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const latencyMs = connector.health?.latencyMs ?? 0;

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.toggleConnector(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConnector(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
      toast({ title: t('integration.connectorDeleted') });
    },
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await api.testConnection(connector.id);
      toast({
        title: result.data?.success ? t('integration.connectionSuccessful') : t('integration.connectionFailed'),
        description: result.data?.message,
        variant: result.data?.success ? "default" : "destructive",
      });
      onRefresh();
    } catch {
      toast({ title: t('integration.testFailed'), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleResetCircuit = async () => {
    await api.resetCircuit(connector.id);
    toast({ title: t('integration.circuitBreakerReset') });
    onRefresh();
  };

  return (
    <Card className="mb-3">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {categoryIcons[connector.category] || <Plug className="h-5 w-5" />}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{connector.name}</h4>
                <StatusBadge status={connector.status} />
                {connector.health?.circuitState === "open" && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <Zap className="h-3 w-3" /> Circuit Open
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{connector.description?.slice(0, 80)}...</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{connector.category}</Badge>
                <Badge variant="outline" className="text-xs">{connector.protocol}</Badge>
                {latencyMs > 0 && (
                  <span className="text-xs text-muted-foreground">{latencyMs}ms</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              onCheckedChange={enabled => toggleMutation.mutate({ id: connector.id, enabled })}
            />
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
              {testing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <TestTube2 className="h-3 w-3" />}
            </Button>
            {connector.health?.circuitState === "open" && (
              <Button variant="outline" size="sm" onClick={handleResetCircuit}>
                <Zap className="h-3 w-3" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(connector.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function IntegrationHubPage() {
  const { t } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState<IntegrationTemplate | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const overviewQuery = useQuery<IntegrationApiResponse<IntegrationOverview>>({ queryKey: ["integration-hub", "overview"], queryFn: api.getOverview, refetchInterval: 30000 });
  const templatesQuery = useQuery<IntegrationApiResponse<IntegrationTemplate[]>>({ queryKey: ["integration-hub", "templates"], queryFn: api.getTemplates });
  const categoriesQuery = useQuery<IntegrationApiResponse<IntegrationCategory[]>>({ queryKey: ["integration-hub", "categories"], queryFn: api.getCategories });
  const connectorsQuery = useQuery<IntegrationApiResponse<IntegrationConnector[]>>({ queryKey: ["integration-hub", "connectors"], queryFn: () => api.getConnectors(), refetchInterval: 15000 });

  const overview = overviewQuery.data?.data;
  const templates = templatesQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];
  const connectors = connectorsQuery.data?.data || [];

  const filteredTemplates = templates.filter((t) => {
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredConnectors = connectors.filter((c) => {
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cable className="h-6 w-6" /> {t('integration.apiIntegrationHub')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('integration.apiIntegrationHubDesc')}
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["integration-hub"] })}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('app.refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('integration.totalConnectors')}</p>
                <p className="text-2xl font-bold">{overview?.totalConnectors || 0}</p>
              </div>
              <Plug className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('integration.active')}</p>
                <p className="text-2xl font-bold text-green-600">{overview?.activeConnectors || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('integration.errors')}</p>
                <p className="text-2xl font-bold text-red-600">{overview?.errorConnectors || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('integration.templatesAvailable')}</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
              <ArrowUpDown className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('integration.searchConnectors')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('integration.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('integration.allCategories')}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  {categoryIcons[cat.id]} {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connectors">
        <TabsList>
          <TabsTrigger value="connectors" className="gap-1">
            <Activity className="h-4 w-4" /> {t('integration.myConnectors')} ({connectors.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1">
            <Plus className="h-4 w-4" /> {t('integration.connectorCatalog')} ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* My Connectors */}
        <TabsContent value="connectors" className="mt-4">
          {filteredConnectors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Cable className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('integration.noConnectorsConfigured')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('integration.noConnectorsConfiguredDesc')}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredConnectors.map((connector) => (
              <ConnectorRow
                key={connector.id}
                connector={connector}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["integration-hub"] })}
              />
            ))
          )}
        </TabsContent>

        {/* Catalog */}
        <TabsContent value="catalog" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Dialog key={template.id} open={selectedTemplate?.id === template.id} onOpenChange={open => { if (!open) setSelectedTemplate(null); }}>
                <DialogTrigger asChild>
                  <div>
                    <TemplateCard template={template} onSelect={() => setSelectedTemplate(template)} />
                  </div>
                </DialogTrigger>
                {selectedTemplate?.id === template.id && (
                  <CreateConnectorDialog template={template} onClose={() => setSelectedTemplate(null)} />
                )}
              </Dialog>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
