import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpenCheck, BotMessageSquare, Circle, LayoutDashboard, MessageSquare, ShieldCheck, Users2, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type ExecutiveFeedItem = {
  tone: 'rose' | 'amber' | 'emerald' | 'sky' | 'violet';
  icon: LucideIcon;
  kicker: string;
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  source: string;
  feedKey?: string;
};

type PMONavigationItem = {
  id: string;
  label: string;
  hint: string;
  count?: number;
};

type OnlineUser = {
  userId: string | number;
  displayName?: string;
  status?: string;
};

type PMOOfficeSideSurfaceProps = {
  activeTab: string;
  navigationItems: PMONavigationItem[];
  onTabChange: (tabId: string) => void;
  executiveFeed: ExecutiveFeedItem[];
  onlineUsers: OnlineUser[];
  onOpenChat: () => void;
};

export default function PMOOfficeSideSurface({
  activeTab,
  navigationItems,
  onTabChange,
  executiveFeed,
  onlineUsers,
  onOpenChat,
}: PMOOfficeSideSurfaceProps) {
  const { t } = useTranslation();

  const getNavIcon = (tabId: string) => {
    if (tabId === "overview") return LayoutDashboard;
    if (tabId === "approvals") return ShieldCheck;
    if (tabId === "governance") return ShieldCheck;
    if (tabId === "standards") return BookOpenCheck;
    if (tabId === "capacity") return Users2;
    return LayoutDashboard;
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col px-5 py-3">
        <div className="mb-4 shrink-0">
          <div className="mb-2 flex items-center gap-2">
            <LayoutDashboard className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t("pmo.office.commandDeck")}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-white/75 p-1 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/55">
            <div className="flex flex-wrap gap-1">
              {navigationItems.map((item) => {
                const Icon = getNavIcon(item.id);
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`group relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 ${
                      isActive
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    }`}
                    data-testid={`pmo-side-tab-${item.id}`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                    <span className="text-[11px] font-medium leading-none">{item.label}</span>
                    {typeof item.count === "number" && item.count > 0 && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold leading-none ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mb-4 shrink-0">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-slate-700/40" />
        </div>

        <div className="mb-3 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t("pmo.office.executiveAlerts")}
            </span>
          </div>
          {executiveFeed.length > 0 && (
            <span className="rounded-md border border-rose-200/60 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              {executiveFeed.length} live
            </span>
          )}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.15) transparent" }}
        >
          {executiveFeed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/60 bg-slate-100 dark:border-slate-700/40 dark:bg-slate-800/60">
                <Zap className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("pmo.office.noExecutiveAlerts")}</p>
              <p className="mt-0.5 text-[9px] text-slate-300 dark:text-slate-600">{t("pmo.office.portfolioClean")}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {executiveFeed.map((item, idx) => {
                const itemKey = item.feedKey ?? `${item.source}:${item.kicker}:${idx}`;

                const toneClass =
                  item.tone === 'rose'
                    ? 'border-rose-200/70 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10'
                    : item.tone === 'amber'
                      ? 'border-amber-200/70 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10'
                      : item.tone === 'emerald'
                        ? 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                        : item.tone === 'sky'
                          ? 'border-sky-200/70 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10'
                          : 'border-violet-200/70 bg-violet-50/80 dark:border-violet-500/20 dark:bg-violet-500/10';
                const actionClass =
                  item.tone === 'rose'
                    ? 'border-rose-200/80 bg-rose-100/90 text-rose-700 hover:bg-rose-200/80 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25'
                    : item.tone === 'amber'
                      ? 'border-amber-200/80 bg-amber-100/90 text-amber-700 hover:bg-amber-200/80 dark:border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25'
                      : item.tone === 'emerald'
                        ? 'border-emerald-200/80 bg-emerald-100/90 text-emerald-700 hover:bg-emerald-200/80 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:bg-emerald-500/25'
                        : item.tone === 'sky'
                          ? 'border-sky-200/80 bg-sky-100/90 text-sky-700 hover:bg-sky-200/80 dark:border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25'
                          : 'border-violet-200/80 bg-violet-100/90 text-violet-700 hover:bg-violet-200/80 dark:border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25';


                return (
                  <div key={itemKey} className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
                    <div className="flex items-start gap-1.5">
                      <item.icon className="mt-0.5 h-3 w-3 shrink-0 text-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{item.kicker}</p>
                          <span className="rounded-full border border-white/70 bg-white/70 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 dark:border-white/10 dark:bg-white/5">
                            {item.source}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-tight text-foreground">{item.title}</p>
                        {item.description ? (
                          <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-slate-500 dark:text-slate-400">{item.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      {item.secondaryLabel && item.onSecondary && (
                        <button
                          onClick={item.onSecondary}
                          className="rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                          {item.secondaryLabel}
                        </button>
                      )}
                      <button
                        onClick={item.onAction}
                        className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors ${actionClass}`}
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <div className="mx-5 shrink-0">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent dark:via-slate-700/40" />
      </div>

      <div className="shrink-0 px-5 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t("pmo.office.teamOnline")}
            </span>
          </div>
          <span className="rounded-md border border-emerald-200/60 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
            {onlineUsers.length}
          </span>
        </div>

        <div
          style={{ maxHeight: "160px", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.15) transparent" }}
        >
          {onlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/60 bg-slate-100 dark:border-slate-700/40 dark:bg-slate-800/60">
                <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("pmo.office.noTeamOnline")}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {onlineUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-200 hover:bg-white/70 dark:hover:bg-slate-800/40"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-7 w-7 shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-[10px] font-medium text-white">
                        {(user.displayName || "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                        user.status === "online"
                          ? "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"
                          : user.status === "away"
                            ? "bg-amber-400"
                            : user.status === "busy"
                              ? "bg-rose-400"
                              : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-300">
                      {user.displayName || `User ${user.userId}`}
                    </p>
                    <p className="text-[9px] capitalize leading-tight text-slate-400 dark:text-slate-500">
                      {user.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto shrink-0 px-5 py-3">
        <div className="mb-3 h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent dark:via-slate-700/30" />
        <button
          onClick={() => globalThis.window?.location.assign('/ai-assistant')}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 py-1.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-cyan-600 dark:border-slate-700/50 dark:bg-slate-800/30 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-cyan-400"
        >
          <BotMessageSquare className="h-3 w-3" />
          Open AI Tasks
        </button>
        <button
          onClick={onOpenChat}
          className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] text-slate-400 transition-colors hover:bg-slate-50/50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-slate-800/30 dark:hover:text-cyan-400"
        >
          <MessageSquare className="h-3 w-3" />
          {t("pmo.office.chatWithCorevia")}
        </button>
      </div>
    </>
  );
}