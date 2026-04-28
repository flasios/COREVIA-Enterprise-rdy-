import { Brain, CheckSquare, FileBarChart2, FileText, Mail, Settings, Sparkles, Workflow } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { WorkspaceModuleId } from "@/modules/workspace/types";

type WorkspaceNavProps = {
  activeModule: WorkspaceModuleId;
  onSelect: (module: WorkspaceModuleId) => void;
};

const navItems: Array<{ id: WorkspaceModuleId; label: string; icon: typeof Mail }> = [
  { id: "brief", label: "Work Hub", icon: Sparkles },
  { id: "email", label: "Inbox Copilot", icon: Mail },
  { id: "tasks", label: "Task Board", icon: CheckSquare },
  { id: "reports", label: "Document Studio", icon: FileBarChart2 },
  { id: "agents", label: "Agent Desk", icon: Workflow },
  { id: "knowledge", label: "Knowledge Base", icon: Brain },
  { id: "decisions", label: "Decision Queue", icon: FileText },
  { id: "settings", label: "Workspace Setup", icon: Settings },
];

export function WorkspaceNav({ activeModule, onSelect }: Readonly<WorkspaceNavProps>) {
  return (
    <aside className="relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] px-3 py-4 text-[hsl(var(--brain-console-ink))] shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.26)_0%,transparent_70%)]" />
      <div className="absolute left-0 bottom-0 h-36 w-36 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.2)_0%,transparent_70%)]" />

      <div className="relative mb-4 px-3">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[hsl(var(--brain-slate))]">Workspace Navigation</div>
        <div className="mt-2 text-base font-semibold text-foreground">Modules</div>
      </div>
      <div className="relative space-y-1.5 overflow-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                activeModule === item.id
                  ? "border-white/70 bg-white/78 text-foreground shadow-[0_12px_34px_rgba(15,23,42,0.12)] backdrop-blur"
                  : "border-transparent bg-white/28 text-[hsl(var(--brain-console-ink))] hover:border-white/45 hover:bg-white/48",
              )}
            >
              <span className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                activeModule === item.id
                  ? "bg-[linear-gradient(135deg,hsl(var(--brain-indigo))_0%,hsl(var(--brain-teal))_100%)] text-white"
                  : "bg-white/70 text-[hsl(var(--brain-indigo))]",
              )}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium tracking-[0.01em]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}