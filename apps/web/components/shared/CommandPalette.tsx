import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText, Briefcase, BookOpen, Network, FileCheck,
  Cable, Shield, LayoutDashboard, List, Lightbulb, GraduationCap,
  Bot, ScrollText, Server, PlusCircle, Search, Activity,
  Users, BarChart3, Zap, ArrowRight,
  Home, Bell, Sparkles, FolderOpen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { Badge } from "@/components/ui/badge";
import { useAuthorization } from "@/hooks/useAuthorization";

/* ── Types ── */
interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  keywords?: string[];
  group: string;
  shortcut?: string;
  badge?: string;
}

function getStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/* ── Component ── */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { canAccess: canAccessPortfolio } = useAuthorization({ requiredPermissions: ["portfolio:view"] });
  const { canAccess: canAccessKnowledge } = useAuthorization({ requiredPermissions: ["knowledge:read"] });
  const { canAccess: canAccessUserManagement } = useAuthorization({ requiredPermissions: ["user:read"] });
  const { canAccess: canAccessBrain } = useAuthorization({ requiredPermissions: ["brain:view"] });
  const { canAccess: canRunBrain } = useAuthorization({ requiredPermissions: ["brain:run"] });
  const { canAccess: canAccessDlp } = useAuthorization({ requiredPermissions: ["dlp:view"] });
  const { canAccess: canAccessIntegrationHub } = useAuthorization({ requiredPermissions: ["integration:hub:view"] });

  // Fetch recent decisions for quick access
  const { data: recentDecisions } = useQuery({
    queryKey: ["/brain/decisions/recent/cmd"],
    queryFn: async () => {
      const res = await fetch("/api/corevia/decisions?limit=5");
      if (!res.ok) return [];
      return (await res.json()).decisions || [];
    },
    enabled: open && canAccessBrain,
    staleTime: 30000,
  });

  // Fetch recent demands
  const { data: recentDemands } = useQuery({
    queryKey: ["/api/demands/recent/cmd"],
    queryFn: async () => {
      const res = await fetch("/api/demands?limit=5");
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || data.demands || [];
    },
    enabled: open,
    staleTime: 30000,
  });

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Escape closes
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setLocation(href);
    },
    [setLocation]
  );

  /* ── Navigation actions ── */
  const navigationActions: CommandAction[] = useMemo(
    () => [
      {
        id: "home",
        label: "Home Dashboard",
        description: "Enterprise Intelligence Hub",
        icon: <Home className="h-4 w-4" />,
        href: "/",
        keywords: ["home", "dashboard", "main", "hub"],
        group: "Navigation",
        shortcut: "⌘H",
      },
      ...(canAccessBrain
        ? [{
            id: "brain-console",
            label: "Corevia Brain Console",
            description: "8-layer decision governance system",
            icon: <HexagonLogoFrame px={16} />,
            href: "/brain-console",
            keywords: ["brain", "corevia", "decision", "ai", "governance"],
            group: "Navigation",
            shortcut: "⌘B",
            badge: "AI",
          }]
        : []),
      {
        id: "intelligent-gateway",
        label: "Intelligent Gateway",
        description: "AI assessments & demand intelligence",
        icon: <Shield className="h-4 w-4" />,
        href: "/intelligent-gateway",
        keywords: ["gateway", "assessment", "intelligent", "analysis"],
        group: "Navigation",
      },
      {
        id: "intelligent-workspace",
        label: "Intelligent Workspace",
        description: "Enterprise Mission Control",
        icon: <Sparkles className="h-4 w-4" />,
        href: "/intelligent-workspace",
        keywords: ["workspace", "mission", "control", "decisions", "agents"],
        group: "Navigation",
        badge: "New",
      },
      {
        id: "intelligent-library",
        label: "Intelligent Library",
        description: "Assessment history & findings",
        icon: <FileText className="h-4 w-4" />,
        href: "/intelligent-library",
        keywords: ["library", "reports", "history", "findings"],
        group: "Navigation",
      },
      ...(canAccessPortfolio
        ? [{
            id: "portfolio-hub",
            label: "Portfolio Hub",
            description: "Portfolio, Project Manager & PMO Office",
            icon: <Briefcase className="h-4 w-4" />,
            href: "/portfolio-hub",
            keywords: ["portfolio", "project", "pmo", "manager"],
            group: "Navigation",
          }]
        : []),
      ...(canAccessKnowledge
        ? [{
            id: "knowledge-centre",
            label: "Knowledge Centre",
            description: "AI-powered document repository & search",
            icon: <BookOpen className="h-4 w-4" />,
            href: "/knowledge-centre",
            keywords: ["knowledge", "documents", "search", "repository"],
            group: "Navigation",
          }]
        : []),
      {
        id: "synergies",
        label: "Cross-Department Synergies",
        description: "Collaboration opportunities & savings",
        icon: <Network className="h-4 w-4" />,
        href: "/synergies",
        keywords: ["synergy", "collaboration", "department", "savings"],
        group: "Navigation",
      },
      {
        id: "tenders",
        label: "Tender Generator",
        description: "AI-powered RFP/Tender document generation",
        icon: <FileCheck className="h-4 w-4" />,
        href: "/tenders",
        keywords: ["tender", "rfp", "procurement", "document"],
        group: "Navigation",
      },
      ...(canAccessIntegrationHub
        ? [{
            id: "integration-hub",
            label: "API Integration Hub",
            description: "External system connectors",
            icon: <Cable className="h-4 w-4" />,
            href: "/integration-hub",
            keywords: ["integration", "api", "connector", "erp", "crm"],
            group: "Navigation",
          }]
        : []),
    ],
    [canAccessBrain, canAccessIntegrationHub, canAccessKnowledge, canAccessPortfolio]
  );

  /* ── Brain Console sub-pages ── */
  const brainActions: CommandAction[] = useMemo(
    () => canAccessBrain ? [
      {
        id: "brain-dashboard",
        label: "Brain Control Room",
        description: "System overview & KPIs",
        icon: <LayoutDashboard className="h-4 w-4" />,
        href: "/brain-console",
        keywords: ["control", "room", "kpi", "overview"],
        group: "Brain Console",
      },
      {
        id: "brain-decisions",
        label: "Decision Pipeline",
        description: "All decisions & lifecycle tracking",
        icon: <List className="h-4 w-4" />,
        href: "/brain-console/decisions",
        keywords: ["decisions", "pipeline", "lifecycle"],
        group: "Brain Console",
      },
      {
        id: "brain-intelligence",
        label: "Engine Hub",
        description: "3-engine routing & intelligence fabric",
        icon: <Lightbulb className="h-4 w-4" />,
        href: "/brain-console/intelligence",
        keywords: ["engine", "routing", "sovereign", "hybrid", "distillation"],
        group: "Brain Console",
      },
      {
        id: "brain-learning",
        label: "Learning Vault",
        description: "Knowledge artifacts & distillation pipelines",
        icon: <GraduationCap className="h-4 w-4" />,
        href: "/brain-console/learning",
        keywords: ["learning", "vault", "artifacts", "distillation"],
        group: "Brain Console",
      },
      {
        id: "brain-policies",
        label: "Governance Policies",
        description: "L3 friction enforcement rules",
        icon: <ScrollText className="h-4 w-4" />,
        href: "/brain-console/policies",
        keywords: ["policy", "governance", "friction", "rules"],
        group: "Brain Console",
      },
      {
        id: "brain-agents",
        label: "Autonomous Agents",
        description: "13 agentic tools for task execution",
        icon: <Bot className="h-4 w-4" />,
        href: "/brain-console/agents",
        keywords: ["agent", "autonomous", "tools", "bot"],
        group: "Brain Console",
      },
      {
        id: "brain-audit",
        label: "Audit Trail",
        description: "Immutable decision event log",
        icon: <ScrollText className="h-4 w-4" />,
        href: "/brain-console/audit-trail",
        keywords: ["audit", "trail", "log", "events"],
        group: "Brain Console",
      },
      {
        id: "brain-services",
        label: "Services Registry",
        description: "Intake plugin & service management",
        icon: <Server className="h-4 w-4" />,
        href: "/brain-console/services",
        keywords: ["services", "registry", "plugin", "intake"],
        group: "Brain Console",
      },
    ] : [],
    [canAccessBrain]
  );

  /* ── Quick actions ── */
  const quickActions: CommandAction[] = useMemo(
    () => [
      ...(canRunBrain
        ? [{
            id: "new-intake",
            label: "New Brain Intake",
            description: "Submit a new decision to the pipeline",
            icon: <PlusCircle className="h-4 w-4" />,
            href: "/brain-console/new",
            keywords: ["new", "intake", "submit", "create", "decision"],
            group: "Quick Actions",
            badge: "New",
          }]
        : []),
      ...(canAccessPortfolio
        ? [{
            id: "new-demand",
            label: "New Demand Request",
            description: "Start a new demand intake",
            icon: <PlusCircle className="h-4 w-4" />,
            href: "/intelligent-portfolio",
            keywords: ["demand", "request", "intake", "new"],
            group: "Quick Actions",
            badge: "New",
          }]
        : []),
      ...(canAccessKnowledge
        ? [{
            id: "search-knowledge",
            label: "Search Knowledge Base",
            description: "AI-powered semantic search across documents",
            icon: <Search className="h-4 w-4" />,
            href: "/knowledge-centre",
            keywords: ["search", "knowledge", "semantic", "documents"],
            group: "Quick Actions",
          }]
        : []),
      {
        id: "view-analytics",
        label: "View Analytics",
        description: "Performance reporting & dashboards",
        icon: <BarChart3 className="h-4 w-4" />,
        href: "/performance-reporting",
        keywords: ["analytics", "performance", "reporting", "charts"],
        group: "Quick Actions",
      },
      ...(canAccessUserManagement
        ? [{
            id: "manage-users",
            label: "User Management",
            description: "Manage users, roles & permissions",
            icon: <Users className="h-4 w-4" />,
            href: "/admin/users",
            keywords: ["users", "roles", "permissions", "admin"],
            group: "Quick Actions",
          }]
        : []),
      ...(canAccessDlp
        ? [{
            id: "dlp-dashboard",
            label: "DLP Dashboard",
            description: "Data Loss Prevention — PII scanning & classification",
            icon: <Shield className="h-4 w-4" />,
            href: "/admin/dlp",
            keywords: ["dlp", "data loss prevention", "pii", "security", "classification", "redact"],
            group: "Quick Actions",
          }]
        : []),
      ...(canAccessBrain
        ? [{
            id: "notifications",
            label: "View Notifications",
            description: "Check latest alerts & updates",
            icon: <Bell className="h-4 w-4" />,
            href: "/brain-console/ai-assistant",
            keywords: ["notifications", "alerts", "updates"],
            group: "Quick Actions",
          }]
        : []),
    ],
    [canAccessBrain, canAccessDlp, canAccessKnowledge, canAccessPortfolio, canAccessUserManagement, canRunBrain]
  );

  /* ── Recent decisions as dynamic actions ── */
  const recentDecisionActions: CommandAction[] = useMemo(
    () =>
      canAccessBrain ? (recentDecisions || []).slice(0, 5).map((d: Record<string, unknown>) => {
        const title = getStringValue(d.title);
        const status = getStringValue(d.status);
        const serviceId = getStringValue(d.serviceId);
        return {
          id: `decision-${d.id}`,
          label: title || `Decision #${d.id}`,
          description: `${status || "unknown"} · ${serviceId}`,
          icon: <Zap className="h-4 w-4" />,
          href: `/brain-console/decisions/${d.id}`,
          keywords: ["decision", title, status],
          group: "Recent Decisions",
        };
      }) : [],
    [canAccessBrain, recentDecisions]
  );

  /* ── Recent demands as dynamic actions ── */
  const recentDemandActions: CommandAction[] = useMemo(
    () =>
      (recentDemands || []).slice(0, 5).map((d: Record<string, unknown>) => {
        const projectName = getStringValue(d.projectName);
        const title = getStringValue(d.title);
        const status = getStringValue(d.status);
        const department = getStringValue(d.department);
        return {
          id: `demand-${d.id}`,
          label: projectName || title || `Demand #${d.id}`,
          description: `${status || "submitted"} · ${department}`,
          icon: <FolderOpen className="h-4 w-4" />,
          href: `/demand-reports/${d.id}`,
          keywords: ["demand", projectName || title, department],
          group: "Recent Demands",
        };
      }),
    [recentDemands]
  );

  const handleSelect = useCallback(
    (action: CommandAction) => {
      if (action.action) {
        action.action();
      } else if (action.href) {
        navigate(action.href);
      }
      setOpen(false);
    },
    [navigate]
  );

  const renderGroup = (
    title: string,
    actions: CommandAction[],
    icon?: React.ReactNode
  ) => {
    if (actions.length === 0) return null;
    return (
      <CommandGroup
        heading={
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            {icon}
            {title}
          </span>
        }
      >
        {actions.map((action) => (
          <CommandItem
            key={action.id}
            value={`${action.label} ${action.description || ""} ${(action.keywords || []).join(" ")}`}
            onSelect={() => handleSelect(action)}
            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
              {action.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{action.label}</span>
                {action.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold">
                    {action.badge}
                  </Badge>
                )}
              </div>
              {action.description && (
                <span className="text-xs text-muted-foreground truncate block">
                  {action.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {action.shortcut && (
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {action.shortcut}
                </kbd>
              )}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 text-muted-foreground text-sm transition-all duration-200 hover:border-border shrink-0"
        data-testid="command-palette-trigger"
      >
        <Search className="h-3.5 w-3.5" />
                <span className="text-xs">{t('nav.commandPalette.quickAccess')}</span>
        <kbd className="ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={t('nav.commandPalette.searchPlaceholder')} />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('nav.commandPalette.noResults')}</p>
              <p className="text-xs text-muted-foreground/60">
                {t('nav.commandPalette.noResultsHint')}
              </p>
            </div>
          </CommandEmpty>

          {renderGroup("Quick Actions", quickActions, <Sparkles className="h-3 w-3 text-amber-500" />)}
          <CommandSeparator />
          {renderGroup("Navigation", navigationActions, <ArrowRight className="h-3 w-3" />)}
          <CommandSeparator />
          {renderGroup("Brain Console", brainActions, <HexagonLogoFrame px={12} />)}

          {recentDecisionActions.length > 0 && (
            <>
              <CommandSeparator />
              {renderGroup("Recent Decisions", recentDecisionActions, <Activity className="h-3 w-3 text-cyan-500" />)}
            </>
          )}

          {recentDemandActions.length > 0 && (
            <>
              <CommandSeparator />
              {renderGroup("Recent Demands", recentDemandActions, <FolderOpen className="h-3 w-3 text-emerald-500" />)}
            </>
          )}
        </CommandList>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
              {t('nav.commandPalette.navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              {t('nav.commandPalette.select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border px-1 py-0.5 font-mono text-[9px]">esc</kbd>
              {t('nav.commandPalette.close')}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <HexagonLogoFrame px={12} />
            COREVIA
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
