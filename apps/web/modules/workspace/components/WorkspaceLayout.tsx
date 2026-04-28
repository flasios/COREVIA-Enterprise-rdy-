import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import CoveriaAdvisor from "@/modules/advisor";
import { WorkspaceCanvas } from "@/modules/workspace/components/WorkspaceCanvas";
import { WorkflowNavigatorModal } from "@/modules/workspace/panels/WorkflowBuilderPanel";
import type {
  WorkspaceAgent,
  WorkspaceBrief,
  WorkspaceDecision,
  WorkspaceEmail,
  WorkspaceEmailConnection,
  WorkspaceModuleId,
  WorkspaceSignal,
  WorkspaceTask,
} from "@/modules/workspace/types";

type WorkspaceLayoutProps = {
  activeModule: WorkspaceModuleId;
  onSelectModule: (module: WorkspaceModuleId) => void;
  brief: WorkspaceBrief | null;
  emails: WorkspaceEmail[];
  emailConnection: WorkspaceEmailConnection | null;
  tasks: WorkspaceTask[];
  decisions: WorkspaceDecision[];
  signals: WorkspaceSignal[];
  agents: WorkspaceAgent[];
};

type MainTab = "overview" | "agents" | "tasks" | "decisions";

const mainTabs: Array<{ id: MainTab; label: string; code: string; meta: string }> = [
  { id: "overview", label: "Overview", code: "OPS-01", meta: "Operational brief" },
  { id: "agents", label: "Business Dock", code: "OPS-02", meta: "Service routing" },
  { id: "tasks", label: "Tasks", code: "OPS-03", meta: "Execution control" },
  { id: "decisions", label: "Decisions", code: "OPS-04", meta: "Approval routing" },
];

const _tabDescriptions: Record<MainTab, string> = {
  overview: "Signals, mail, and current work in one place.",
  agents: "Launch AI services and delivery workflows.",
  tasks: "Track routed work and execution readiness.",
  decisions: "Review escalations and governance actions.",
};

function mapTabToModule(tab: MainTab): WorkspaceModuleId {
  switch (tab) {
    case "tasks": return "tasks";
    case "agents": return "agents";
    case "decisions": return "decisions";
    default: return "brief";
  }
}

export function WorkspaceLayout({ activeModule, onSelectModule, brief, emails, emailConnection, tasks, decisions, signals, agents }: Readonly<WorkspaceLayoutProps>) {
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<WorkspaceAgent | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);

  const businessDockAgents = agents;

  useEffect(() => {
    const firstAgent = businessDockAgents[0];
    if (!selectedAgent && firstAgent) {
      setSelectedAgent(firstAgent);
    }
  }, [businessDockAgents, selectedAgent]);

  const tabCounts = useMemo<Record<MainTab, number>>(() => ({
    overview: (brief?.policyAlerts ?? 0) + (signals.length > 0 ? 1 : 0),
    agents: businessDockAgents.length,
    tasks: tasks.length || brief?.tasksGenerated || 0,
    decisions: decisions.length || brief?.decisionsPending || 0,
  }), [brief?.decisionsPending, brief?.policyAlerts, brief?.tasksGenerated, businessDockAgents.length, decisions.length, signals.length, tasks.length]);

  const activeTabLabel = mainTabs.find((tab) => tab.id === activeTab)?.label ?? "Overview";

  function handleTabChange(tab: MainTab) {
    setActiveTab(tab);
    onSelectModule(mapTabToModule(tab));
  }

  function handleBusinessDockTabClick() {
    handleTabChange("agents");
    if (businessDockAgents.length > 0) {
      setNavigatorOpen(true);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef2f6] px-5 py-5 text-foreground" data-testid="page-intelligent-workspace">
      <div className="relative z-10 flex h-[calc(100vh-2.5rem)] w-full gap-5 overflow-hidden">
        {/* Left — Intelligence panel (collapsible) */}
        <div className={cn("relative shrink-0 transition-all duration-300 ease-in-out", panelOpen ? "w-[320px]" : "w-0")}>
          {panelOpen && (
            <div className="home-intel-panel h-[calc(100vh-2.5rem)] w-[320px] overflow-hidden rounded-[20px]">
              <CoveriaAdvisor
                context="workspace"
                mode="embedded"
                compact
                title="Workspace Intelligence"
                subtitle="Unified Strategic Advisor"
              />
            </div>
          )}
          {/* Collapse / expand toggle — slim edge tab */}
          <button
            type="button"
            onClick={() => setPanelOpen(!panelOpen)}
            className={cn(
              "absolute top-1/2 z-10 flex items-center justify-center rounded-r-lg transition-all duration-200",
              panelOpen
                ? "-right-4 h-16 w-4 -translate-y-1/2 border-y border-r border-white/50 hover:w-5"
                : "left-0 h-16 w-5 -translate-y-1/2 border-y border-r border-white/50 hover:w-6",
            )}
            style={{ background: "linear-gradient(180deg, hsl(var(--brain-console-ice)), hsl(var(--brain-surface)))" }}
            title={panelOpen ? "Collapse intelligence panel" : "Expand intelligence panel"}
          >
            {panelOpen ? (
              <ChevronLeft className="h-3.5 w-3.5 text-[hsl(var(--brain-slate))]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--brain-console-teal))]" />
            )}
          </button>
        </div>

        {/* Right — Content area with horizontal tabs */}
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="workspace-ops-rail">
              <div className="workspace-ops-rail__summary">
                <div className="workspace-ops-rail__eyebrow">INTELLIGENT WORKSPACE</div>
                <div className="workspace-ops-rail__headline">
                  <div className="workspace-ops-rail__titleBlock">
                    <div className="workspace-ops-rail__titleRow">
                      <div className="workspace-ops-rail__title">Governed Operations Console</div>
                      <span className="workspace-ops-rail__chip">{activeTabLabel}</span>
                      {activeTab === "agents" && selectedAgent ? (
                        <span className="workspace-ops-rail__chip is-muted">
                          {selectedAgent.label.replace(" Workflow", "")}
                        </span>
                      ) : null}
                    </div>
                    <div className="workspace-ops-rail__subtitle">
                      Operational surface for governed delivery, AI routing, and controlled decision execution.
                    </div>

                    <div className="workspace-ops-rail__track" aria-label="Workspace sections">
                      {mainTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const isBusinessDock = tab.id === "agents";
                        const count = tabCounts[tab.id];
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={isBusinessDock ? handleBusinessDockTabClick : () => handleTabChange(tab.id)}
                            className={cn("workspace-ops-tab", isActive && "is-active")}
                          >
                            <span className="workspace-ops-tab__accent" />
                            <span className="workspace-ops-tab__body">
                              <span className="workspace-ops-tab__index">{tab.code}</span>
                              <span className="workspace-ops-tab__label">{tab.label}</span>
                              <span className="workspace-ops-tab__meta">{tab.meta}</span>
                            </span>
                            <span className="workspace-ops-tab__right">
                              {count > 0 ? <span className="workspace-ops-tab__count">{count}</span> : null}
                              {isBusinessDock ? <ChevronDown className="h-3 w-3" /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </div>

            <WorkflowNavigatorModal
              isOpen={navigatorOpen}
              onClose={() => setNavigatorOpen(false)}
              agents={businessDockAgents}
              selectedId={selectedAgent?.id}
              onSelect={(agent) => {
                setSelectedAgent(agent);
                setTimeout(() => setNavigatorOpen(false), 100);
              }}
            />

            {/* Tab content */}
            <div className="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-[16px] border border-slate-300/80 bg-transparent p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <WorkspaceCanvas
                activeModule={activeModule}
                brief={brief}
                emails={emails}
                emailConnection={emailConnection}
                tasks={tasks}
                decisions={decisions}
                signals={signals}
                agents={agents}
                businessDockAgents={businessDockAgents}
                selectedAgent={selectedAgent}
              />
            </div>
        </div>
      </div>
    </div>
  );
}