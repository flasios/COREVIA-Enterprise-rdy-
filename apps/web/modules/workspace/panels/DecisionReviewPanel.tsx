import { Scale, ShieldAlert } from "lucide-react";
import type { WorkspaceDecision } from "@/modules/workspace/types";

type DecisionReviewPanelProps = Readonly<{
  decisions: readonly WorkspaceDecision[];
}>;

function getPriorityClass(priority: WorkspaceDecision["priority"]) {
  if (priority === "critical") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (priority === "high") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export function DecisionReviewPanel({ decisions }: DecisionReviewPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Decision Review Panel</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Review current decision workload</h2>
          </div>
          <div className="rounded-full bg-amber-50 p-3 text-amber-700">
            <Scale className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {decisions.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 shadow-sm">
            No decisions are available for review yet.
          </div>
        ) : null}
        {decisions.map((decision) => (
          <article key={decision.id} className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{decision.title}</div>
                <div className="mt-1 text-sm text-slate-500">{decision.serviceId} · {decision.status}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getPriorityClass(decision.priority)}`}>
                {decision.priority.toUpperCase()}
              </span>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Context</div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{decision.context}</p>
                <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">Recommended Next Move</div>
                <p className="mt-2 text-sm leading-7 text-slate-900">{decision.recommendation}</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <div>Classification: <span className="font-medium text-slate-900">{decision.classification ?? "Unclassified"}</span></div>
                  <div className="mt-2">Risk Level: <span className="font-medium text-slate-900">{decision.riskLevel ?? "Not scored"}</span></div>
                  <div className="mt-2">Owner: <span className="font-medium text-slate-900">{decision.owner ?? "Unassigned"}</span></div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
                    <ShieldAlert className="h-4 w-4" />
                    Governance Verdict
                  </div>
                  <div className="mt-2 font-medium">{decision.policyVerdict ?? "Awaiting policy outcome"}</div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}