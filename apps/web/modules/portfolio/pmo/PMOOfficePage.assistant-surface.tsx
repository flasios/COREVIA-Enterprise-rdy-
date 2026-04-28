import { HexagonLogoFrame } from "@/components/shared/misc";
import { MessageSquare, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import CoveriaAdvisor from "@/modules/advisor";
import PMOOfficeSideSurface from "./PMOOfficePage.side-surface";

type ExecutiveFeedItem = {
  tone: 'rose' | 'amber' | 'emerald' | 'sky' | 'violet';
  icon: LucideIcon;
  kicker: string;
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
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

type PMOOfficeAssistantSurfaceProps = {
  activeTab: string;
  navigationItems: PMONavigationItem[];
  onTabChange: (tabId: string) => void;
  pmoChatOpen: boolean;
  onToggleChat: () => void;
  currentUserName: string;
  currentUserInitial: string;
  voiceEnabled: boolean;
  isSpeaking: boolean;
  onToggleVoice: () => void;
  onlineUsers: OnlineUser[];
  executiveFeed: ExecutiveFeedItem[];
};

export default function PMOOfficeAssistantSurface({
  activeTab,
  navigationItems = [],
  onTabChange,
  pmoChatOpen,
  onToggleChat,
  currentUserName,
  currentUserInitial: _currentUserInitial,
  voiceEnabled: _voiceEnabled,
  isSpeaking: _isSpeaking,
  onToggleVoice: _onToggleVoice,
  onlineUsers,
  executiveFeed,
}: PMOOfficeAssistantSurfaceProps) {
  const { t } = useTranslation();

  return (
    <aside className="relative flex min-w-[360px] w-[360px] flex-col border-r border-slate-200/40 bg-white/60 backdrop-blur-xl dark:border-slate-700/30 dark:bg-slate-900/60">
      <div className="mx-4 mt-1 shrink-0">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-700/50" />
      </div>

      <div className="shrink-0 px-5 pb-2 pt-3">
        <div className="text-center">
          <p className="mb-2 text-[8px] font-medium uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
            {t("pmo.office.humanCenteredIntelligence")}
          </p>

          <button
            onClick={onToggleChat}
            className="group relative mx-auto mb-1 flex cursor-pointer items-center justify-center focus:outline-none"
            style={{ width: 140, height: 140 }}
          >
            <div
              className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{ width: 140, height: 140 }}
            >
              <div className="cv-orbit-ring absolute inset-0 pointer-events-none" style={{ animation: "cvOrbit 12s linear infinite" }}>
                <div className="absolute h-3 w-3 rounded-full shadow-lg" style={{ top: 0, left: "50%", marginLeft: -6, background: "linear-gradient(135deg, #06b6d4, #22d3ee)", boxShadow: "0 0 8px 2px rgba(6,182,212,0.5)" }} />
                <div className="absolute h-2.5 w-2.5 rounded-full shadow-lg" style={{ top: "50%", right: 0, marginTop: -5, background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", boxShadow: "0 0 8px 2px rgba(139,92,246,0.5)" }} />
                <div className="absolute h-2 w-2 rounded-full shadow-lg" style={{ bottom: 0, left: "50%", marginLeft: -4, background: "linear-gradient(135deg, #f59e0b, #fbbf24)", boxShadow: "0 0 8px 2px rgba(245,158,11,0.5)" }} />
                <div className="absolute h-2.5 w-2.5 rounded-full shadow-lg" style={{ top: "50%", left: 0, marginTop: -5, background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 0 8px 2px rgba(16,185,129,0.5)" }} />
              </div>
              <div className="absolute pointer-events-none" style={{ inset: 8, animation: "cvOrbitReverse 9s linear infinite" }}>
                <div className="absolute h-[7px] w-[7px] rounded-full" style={{ top: "12%", right: "5%", background: "linear-gradient(135deg, #ec4899, #f472b6)", boxShadow: "0 0 6px 1px rgba(236,72,153,0.5)" }} />
                <div className="absolute h-[6px] w-[6px] rounded-full" style={{ bottom: "12%", left: "5%", background: "linear-gradient(135deg, #3b82f6, #60a5fa)", boxShadow: "0 0 6px 1px rgba(59,130,246,0.5)" }} />
                <div className="absolute h-[5px] w-[5px] rounded-full" style={{ top: "5%", left: "20%", background: "linear-gradient(135deg, #14b8a6, #5eead4)", boxShadow: "0 0 5px 1px rgba(20,184,166,0.4)" }} />
              </div>
              <HexagonLogoFrame px={96} animated />
              {executiveFeed.length > 0 && !pmoChatOpen && (
                <div className="absolute pointer-events-none" style={{ inset: -2, animation: "cvNotifOrbit 4s linear infinite" }}>
                  <div className="absolute flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-500 px-1.5 shadow-[0_4px_16px_rgba(244,63,94,0.45)] ring-2 ring-white dark:ring-slate-900" style={{ top: 0, left: "50%", marginLeft: -11 }}>
                    <div className="flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5 text-white" />
                      <span className="text-[9px] font-bold text-white">{executiveFeed.length > 9 ? "9+" : executiveFeed.length}</span>
                    </div>
                  </div>
                </div>
              )}
              {pmoChatOpen && (
                <div className="absolute pointer-events-none" style={{ inset: -2, animation: "cvNotifOrbit 5s linear infinite" }}>
                  <div className="absolute flex h-[20px] w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg ring-2 ring-white dark:ring-slate-900" style={{ top: 0, left: "50%", marginLeft: -10 }}>
                    <MessageSquare className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
              )}
            </div>
            <style>{`
              @keyframes cvOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes cvOrbitReverse {
                from { transform: rotate(360deg); }
                to { transform: rotate(0deg); }
              }
              @keyframes cvNotifOrbit {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </button>

          <h2 className="mt-3 text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-200">COREVIA</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Hello, <span className="font-medium text-slate-700 dark:text-slate-300">{currentUserName}</span>
          </p>
          <p className="mt-0.5 text-[9px] tracking-wide text-slate-400 dark:text-slate-500">
            {pmoChatOpen ? t("pmo.office.askMeAnything") : t("pmo.office.pmoOfficeIntelligence")}
          </p>
        </div>
      </div>

      <div className="mx-5 shrink-0">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-700/50" />
      </div>

      {pmoChatOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CoveriaAdvisor
            context="pmo-office"
            mode="embedded"
            compact
            title="PMO Intelligence"
            subtitle="COREVIA Strategic Advisor"
            className="h-full"
            chips={[t("pmo.office.chipPortfolioStatus"), t("pmo.office.chipPendingApprovals"), t("pmo.office.chipAtRiskProjects"), t("pmo.office.chipTeamCapacity")]}
          />
        </div>
      ) : (
        <Suspense fallback={null}>
          <PMOOfficeSideSurface
            activeTab={activeTab}
            navigationItems={navigationItems}
            onTabChange={onTabChange}
            executiveFeed={executiveFeed}
            onlineUsers={onlineUsers}
            onOpenChat={onToggleChat}
          />
        </Suspense>
      )}
    </aside>
  );
}
