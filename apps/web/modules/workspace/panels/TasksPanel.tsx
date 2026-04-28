import { CheckSquare2 } from "lucide-react";
import type { WorkspaceTask } from "@/modules/workspace/types";

type TasksPanelProps = {
  tasks: WorkspaceTask[];
};

function getPriorityClass(priority: WorkspaceTask["priority"]) {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
}

export function TasksPanel({ tasks }: Readonly<TasksPanelProps>) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Task Extraction</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Task board from AI triage</h2>
        </div>
        <div className="rounded-full bg-emerald-50 p-3 text-emerald-700">
          <CheckSquare2 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No live tasks have been generated yet. Tasks will appear here when decisions or mailbox threads produce actionable items.
          </div>
        ) : null}
        {tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">{task.task}</div>
                <div className="mt-1 text-sm text-slate-500">Owner: {task.owner} · Source: {task.source}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getPriorityClass(task.priority)}`}>
                {task.priority.toUpperCase()}
              </span>
            </div>
            <div className="mt-3 text-sm text-slate-500">Due: {task.dueLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}