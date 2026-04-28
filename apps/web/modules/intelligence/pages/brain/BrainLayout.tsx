import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, List, Lightbulb, GraduationCap,
  PlusCircle, Server, Bot, ScrollText, ChevronRight as _ChevronRight, Home as _Home,
  Zap, Activity, ChevronDown, Network, Shield,
  Sparkles, ArrowLeft, BellRing, SlidersHorizontal,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BRAIN_BASE = "/brain-console";

interface NavItem {
  label: string;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  countKey?: string;
  description?: string;
}

interface NavSection {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  accentClass: string;
  dotClass: string;
  barClass: string;
  items: NavItem[];
}

function buildNavSections(t: (key: string) => string): NavSection[] {
  return [
  {
    id: "command",
    title: t('brain.sections.commandCenter'),
    icon: Zap,
    accentClass: "text-cyan-400",
    dotClass: "bg-cyan-400",
    barClass: "bg-cyan-400",
    items: [
      { label: t('brain.nav.controlRoom'), href: BRAIN_BASE, icon: LayoutDashboard, description: t('brain.nav.controlRoomDesc') },
      { label: t('brain.nav.decisions'), href: `${BRAIN_BASE}/decisions`, icon: List, countKey: "total", description: t('brain.nav.decisionsDesc') },
      { label: t('brain.nav.notifications'), href: `${BRAIN_BASE}/ai-assistant`, icon: BellRing, description: t('brain.nav.notificationsDesc') },
    ],
  },
  {
    id: "intelligence",
    title: t('brain.sections.intelligenceFabric'),
    icon: Sparkles,
    accentClass: "text-blue-400",
    dotClass: "bg-blue-400",
    barClass: "bg-blue-400",
    items: [
      { label: t('brain.nav.engineHub'), href: `${BRAIN_BASE}/intelligence`, icon: Lightbulb, description: t('brain.nav.engineHubDesc') },
      { label: t('brain.nav.learningVault'), href: `${BRAIN_BASE}/learning`, icon: GraduationCap, description: t('brain.nav.learningVaultDesc') },
      { label: "Advisor Control", href: `${BRAIN_BASE}/advisor`, icon: SlidersHorizontal, description: "Govern AI advisor surfaces, access and engine config" },
    ],
  },
  {
    id: "governance",
    title: t('brain.sections.governanceLayer'),
    icon: Shield,
    accentClass: "text-violet-400",
    dotClass: "bg-violet-400",
    barClass: "bg-violet-400",
    items: [
      { label: t('brain.nav.policies'), href: `${BRAIN_BASE}/policies`, icon: ScrollText, description: t('brain.nav.policiesDesc') },
      { label: t('brain.nav.auditTrail'), href: `${BRAIN_BASE}/audit-trail`, icon: ScrollText, description: t('brain.nav.auditTrailDesc') },
      { label: t('brain.nav.agents'), href: `${BRAIN_BASE}/agents`, icon: Bot, description: t('brain.nav.agentsDesc') },
    ],
  },
  {
    id: "infrastructure",
    title: t('brain.sections.infrastructure'),
    icon: Network,
    accentClass: "text-emerald-400",
    dotClass: "bg-emerald-400",
    barClass: "bg-emerald-400",
    items: [
      { label: t('brain.nav.services'), href: `${BRAIN_BASE}/services`, icon: Server, description: t('brain.nav.servicesDesc') },
    ],
  },
];
}

async function fetchSidebarStats() {
  const res = await fetch("/api/corevia/stats/pipeline");
  if (!res.ok) return null;
  const data = await res.json();
  return data.stats;
}

export function BrainLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { data: stats } = useQuery({
    queryKey: ["/brain/sidebar-stats"],
    queryFn: fetchSidebarStats,
    refetchInterval: 12000,
  });

  const navSections = useMemo(() => buildNavSections(t), [t]);

  const counts: Record<string, number> = useMemo(() => {
    if (!stats) return { total: 0, processing: 0, pending: 0 };
    return {
      total: stats.total || 0,
      processing: stats.processing || 0,
      pending: stats.pending || 0,
    };
  }, [stats]);

  function isActive(href: string) {
    if (href === BRAIN_BASE) return location === BRAIN_BASE || location === `${BRAIN_BASE}/`;
    return location.startsWith(href);
  }

  const isNewDecisionActive = location === `${BRAIN_BASE}/new`;

  return (
    <div className="flex h-screen overflow-hidden brain-console bg-slate-100 dark:bg-slate-900 p-3">
      {/* Sidebar — COREVIA brand gradient: cyan→blue→violet */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col relative overflow-hidden rounded-2xl shadow-xl"
        style={{
          background: "linear-gradient(180deg, #0891b2 0%, #2563eb 45%, #7c3aed 100%)",
        }}
      >
        {/* Subtle shimmer overlays for depth */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white/[0.12] to-transparent" />
          <div className="absolute top-1/4 -left-10 w-44 h-44 rounded-full bg-cyan-300/[0.10] blur-3xl" />
          <div className="absolute bottom-1/3 -right-10 w-44 h-44 rounded-full bg-violet-300/[0.10] blur-3xl" />
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/[0.12] to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Home breadcrumb */}
          <Link href="/">
            <span className="flex items-center gap-1.5 px-5 pt-4 pb-1 text-[11px] font-medium text-white/60 hover:text-white transition-colors cursor-pointer">
              <ArrowLeft className="h-3 w-3" />
              {t('nav.backToPlatform')}
            </span>
          </Link>

          {/* Brand header */}
          <div className="px-5 pt-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <HexagonLogoFrame size="sm" animated />
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-blue-600 z-20" title={t('brain.systemOnline')} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-white drop-shadow-sm">
                  {t('brain.title')}
                </h2>
                <p className="text-[10px] text-white/70 font-medium tracking-wide">{t('brain.subtitle')}</p>
              </div>
            </div>
          </div>

          {/* New Decision CTA */}
          <div className="px-3 pb-3">
            <Link href={`${BRAIN_BASE}/new`}>
              <span className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${
                isNewDecisionActive
                  ? "text-white shadow-lg shadow-cyan-500/20"
                  : "text-white/90 hover:text-white hover:shadow-lg hover:shadow-white/10 border border-white/[0.15] hover:border-white/30"
              }`}
                style={isNewDecisionActive
                  ? { background: "rgba(255,255,255,0.25)" }
                  : { background: "rgba(255,255,255,0.08)" }}
              >
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${
                  isNewDecisionActive ? "bg-white/20" : "bg-white/[0.06] group-hover:bg-white/20"
                }`}>
                  <PlusCircle className="h-3.5 w-3.5" />
                </div>
                {t('brain.newDecision')}
                <Sparkles className="h-3 w-3 ml-auto opacity-60" />
              </span>
            </Link>
          </div>

          {/* Gradient divider */}
          <div className="mx-5 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.4), rgba(255,255,255,0.3), transparent)" }} />

          {/* Navigation sections */}
          <ScrollArea className="flex-1 px-3 py-3">
            <TooltipProvider delayDuration={400}>
              <nav className="space-y-4">
                {navSections.map((section) => (
                  <SidebarSection
                    key={section.id}
                    section={section}
                    counts={counts}
                    isActive={isActive}
                  />
                ))}
              </nav>
            </TooltipProvider>
          </ScrollArea>

          {/* Live metrics footer */}
          <div className="mx-3 mb-3">
            <div className="rounded-xl p-3 border border-white/[0.15]"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Activity className="h-3 w-3 text-white/80" />
                <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">{t('app.pipelineLive')}</span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-[9px] text-emerald-300 font-medium">{t('app.online').toUpperCase()}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <MetricPill label={t('app.active')} value={counts.processing || 0} color="cyan" />
                <MetricPill label={t('app.queued')} value={counts.pending || 0} color="blue" />
                <MetricPill label={t('app.total')} value={counts.total || 0} color="violet" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-white dark:bg-slate-950 rounded-2xl ml-3 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ── Section component with collapsible group ── */
function SidebarSection({
  section,
  counts,
  isActive,
}: {
  section: NavSection;
  counts: Record<string, number>;
  isActive: (href: string) => boolean;
}) {
  const hasActiveChild = section.items.some((item) => isActive(item.href));
  const [open, setOpen] = useState(true);
  const SectionIcon = section.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] text-white/50 hover:text-white/80 transition-colors group"
      >
        <SectionIcon className={`h-3 w-3 text-white/70 transition-colors`} />
        <span className="flex-1 text-left">{section.title}</span>
        {hasActiveChild && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5 ml-1">
          {section.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const count = item.countKey ? counts[item.countKey] : null;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <span
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer group relative ${
                        active
                          ? "text-white"
                          : "text-white/70 hover:text-white"
                      }`}
                      style={active ? { background: "rgba(255,255,255,0.18)" } : { }}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white" />
                      )}
                      <Icon className={`h-4 w-4 flex-shrink-0 ${
                        active ? "text-white" : "text-white/50 group-hover:text-white/80"
                      }`} />
                      <span className="flex-1">{item.label}</span>
                      {count != null && count > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-mono font-bold text-white"
                          style={{ background: "rgba(255,255,255,0.2)" }}>
                          {count}
                        </span>
                      )}
                    </span>
                  </Link>
                </TooltipTrigger>
                {item.description && (
                  <TooltipContent side="right" className="text-xs">
                    {item.description}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Metric pill for footer ── */
function MetricPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: "text-white",
    blue: "text-white",
    violet: "text-white",
  };
  return (
    <div className="text-center rounded-lg py-1.5 px-1" style={{ background: "rgba(255,255,255,0.12)" }}>
      <p className={`text-sm font-bold font-mono leading-none ${colorMap[color] || "text-white"}`}>{value}</p>
      <p className="text-[9px] text-white/60 mt-0.5 font-medium">{label}</p>
    </div>
  );
}
