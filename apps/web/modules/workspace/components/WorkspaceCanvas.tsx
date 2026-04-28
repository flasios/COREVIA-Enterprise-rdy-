import { BrainCircuit, FileOutput, Inbox, ShieldCheck } from "lucide-react";
import { AgentsPanel } from "@/modules/workspace/panels/AgentsPanel";
import { DecisionReviewPanel } from "@/modules/workspace/panels/DecisionReviewPanel";
import { EmailPanel } from "@/modules/workspace/panels/EmailPanel";
import { ReportsPanel } from "@/modules/workspace/panels/ReportsPanel";
import { TasksPanel } from "@/modules/workspace/panels/TasksPanel";
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

type WorkspaceCanvasProps = {
  activeModule: WorkspaceModuleId;
  brief: WorkspaceBrief | null;
  emails: WorkspaceEmail[];
  emailConnection: WorkspaceEmailConnection | null;
  tasks: WorkspaceTask[];
  decisions: WorkspaceDecision[];
  signals: WorkspaceSignal[];
  agents: WorkspaceAgent[];
  businessDockAgents: WorkspaceAgent[];
  selectedAgent: WorkspaceAgent | null;
};

function getBriefHeading(brief: WorkspaceBrief | null, decisions: WorkspaceDecision[], emails: WorkspaceEmail[]) {
  if ((brief?.decisionsPending ?? decisions.length) > 0) {
    return "AI work hub";
  }

  if ((brief?.emailsAnalyzed ?? emails.length) > 0) {
    return "Inbox and actions";
  }

  return "Employee workspace";
}

function getBriefSummary(emailConnection: WorkspaceEmailConnection | null, brief: WorkspaceBrief | null, tasks: WorkspaceTask[]) {
  if (emailConnection?.connected) {
    return `Exchange is connected. The AI can read mailbox activity, summarize it, and turn live threads into ${tasks.length} actionable items.`;
  }

  if (emailConnection?.available) {
    return "Connect Exchange so the AI can read email, prepare summaries, and build a task list from live threads.";
  }

  return "This workspace is meant to help any employee work through email, reports, and agent-driven output from one place.";
}

function BriefPanel({ brief, emails, emailConnection, tasks, decisions, signals, agents }: Readonly<Omit<WorkspaceCanvasProps, "activeModule" | "selectedAgent" | "businessDockAgents">>) {
  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">My Work Brief</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900">{getBriefHeading(brief, decisions, emails)}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {getBriefSummary(emailConnection, brief, tasks)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <Inbox className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
          <div className="mt-4 text-sm text-slate-600">Inbox Threads</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{brief?.emailsAnalyzed ?? emails.length}</div>
          <div className="mt-1 text-sm text-slate-500">threads ready for AI triage</div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <div className="mt-4 text-sm text-slate-600">Decision Escalations</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{brief?.decisionsPending ?? decisions.length}</div>
          <div className="mt-1 text-sm text-slate-500">items waiting for escalation or approval</div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <FileOutput className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          <div className="mt-4 text-sm text-slate-600">Outputs Pending</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{brief?.reportsDue ?? 0}</div>
          <div className="mt-1 text-sm text-slate-500">documents or reports to create</div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <BrainCircuit className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <div className="mt-4 text-sm text-slate-600">Tasks Ready</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{brief?.tasksGenerated ?? tasks.length}</div>
          <div className="mt-1 text-sm text-slate-500">actions produced from AI reading and routing</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <EmailPanel emails={emails.slice(0, 4)} connection={emailConnection} compact />
        <TasksPanel tasks={tasks.slice(0, 4)} />
      </div>

      <ReportsPanel brief={brief} decisions={decisions} signals={signals} agents={agents} mode="reports" />
    </div>
  );
}

function resolveModuleContent(
  activeModule: WorkspaceModuleId,
  props: Omit<WorkspaceCanvasProps, "activeModule">,
): React.ReactNode {
  switch (activeModule) {
    case "email":
      return <EmailPanel emails={props.emails} connection={props.emailConnection} />;
    case "tasks":
      return <TasksPanel tasks={props.tasks} />;
    case "reports":
      return <ReportsPanel brief={props.brief} decisions={props.decisions} signals={props.signals} agents={props.agents} mode="reports" />;
    case "agents":
      return <AgentsPanel agents={props.businessDockAgents} selectedAgent={props.selectedAgent} />;
    case "decisions":
      return <DecisionReviewPanel decisions={props.decisions} />;
    case "knowledge":
    case "settings":
      return <ReportsPanel brief={props.brief} decisions={props.decisions} signals={props.signals} agents={props.agents} mode="reports" />;
    default:
      return <BriefPanel brief={props.brief} emails={props.emails} emailConnection={props.emailConnection} tasks={props.tasks} decisions={props.decisions} signals={props.signals} agents={props.agents} />;
  }
}

export function WorkspaceCanvas({ activeModule, brief, emails, emailConnection, tasks, decisions, signals, agents, businessDockAgents, selectedAgent }: Readonly<WorkspaceCanvasProps>) {
  return <div className="min-h-full overflow-visible p-1">{resolveModuleContent(activeModule, { brief, emails, emailConnection, tasks, decisions, signals, agents, businessDockAgents, selectedAgent })}</div>;
}