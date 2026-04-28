import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileBarChart2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runWorkspaceAgent } from "@/modules/workspace/services/workspaceApi";
import type { WorkspaceAgent, WorkspaceAgentRunResponse, WorkspaceBrief, WorkspaceDecision, WorkspaceSignal } from "@/modules/workspace/types";

type ReportsPanelProps = {
  brief: WorkspaceBrief | null;
  decisions: WorkspaceDecision[];
  signals: WorkspaceSignal[];
  agents: WorkspaceAgent[];
  mode: "reports";
};

function getStudioAgent(agents: WorkspaceAgent[]) {
  return agents.find((agent) => agent.id === "report-agent") ?? null;
}

function getDefaultRequest() {
  return "Create a professional document from the current workspace and focus on the clearest decisions, risks, and next actions.";
}

function getUnavailableWorkflowLabel() {
  return "document";
}

function getDefaultStatusMessage() {
  return "Use the live workspace context as source material for a professional document.";
}

export function ReportsPanel({ brief, decisions, signals, agents, mode }: Readonly<ReportsPanelProps>) {
  const Icon = FileBarChart2;
  const studioAgent = getStudioAgent(agents);
  const title = "Document Studio";
  const headline = "Tell the AI what document you need and let it draft a report, memo, or business case from the live workspace.";
  const [request, setRequest] = useState(getDefaultRequest());
  const runMutation = useMutation<WorkspaceAgentRunResponse, Error, { agent: string; inputs: Record<string, unknown> }>({
    mutationFn: runWorkspaceAgent,
  });
  const unavailableWorkflowLabel = getUnavailableWorkflowLabel();
  const statusMessage = studioAgent
    ? runMutation.data?.message ?? getDefaultStatusMessage()
    : `The ${unavailableWorkflowLabel} workflow is not available in this workspace yet.`;

  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{headline}</h2>
          </div>
          <div className="rounded-full bg-blue-50 p-3 text-blue-700">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Creation Brief</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">What should COREVIA AI produce?</div>
            </div>
            <div className="rounded-full bg-blue-50 p-3 text-blue-700">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <Textarea
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            className="mt-4 min-h-[14rem] border-slate-300 bg-white text-sm leading-6 text-slate-900 placeholder:text-slate-500"
            placeholder="Describe the document you need..."
          />

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{brief?.emailsAnalyzed ?? 0} emails</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{decisions.length} decisions</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{signals.length} signals</span>
          </div>

          <Button
            className="mt-4 w-full gap-2 bg-blue-700 text-white hover:bg-blue-600"
            disabled={!studioAgent?.enabled || runMutation.isPending || !request.trim()}
            onClick={() => {
              if (!studioAgent) return;
              runMutation.mutate({
                agent: studioAgent.id,
                inputs: {
                  task: request.trim(),
                  includeDecisions: true,
                  includeSignals: true,
                  outputMode: mode,
                  source: "workspace",
                },
              });
            }}
          >
            {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            Generate Document
          </Button>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {statusMessage}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live Inputs</div>
            <div className="mt-4 space-y-3">
              {decisions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No live decision inputs are available yet.
                </div>
              ) : null}
              {decisions.slice(0, 3).map((decision) => (
                <div key={decision.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{decision.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{decision.context}</div>
                </div>
              ))}
            </div>
          </div>
          {runMutation.data?.outputs?.length ? (
            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Generated Output</div>
              <div className="mt-4 space-y-3">
                {runMutation.data.outputs.map((output) => (
                  <div key={`${runMutation.data?.taskId}-${output.agentId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{output.agentId}</div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${output.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {output.success ? "SUCCESS" : "FAILED"}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{output.reasoning ?? "No reasoning returned."}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Signal Inputs</div>
              <div className="mt-4 space-y-3">
                {signals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No live signals are available yet.
                  </div>
                ) : null}
                {signals.slice(0, 3).map((signal) => (
                  <div key={signal.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {signal.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}