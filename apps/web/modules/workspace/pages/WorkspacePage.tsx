import { useState } from "react";
import { WorkspaceLayout } from "@/modules/workspace/components/WorkspaceLayout";
import { useDecisionFeed } from "@/modules/workspace/hooks/useDecisionFeed";
import { useWorkspaceAgents } from "@/modules/workspace/hooks/useWorkspaceAgents";
import { useWorkspaceBrief } from "@/modules/workspace/hooks/useWorkspaceBrief";
import { useWorkspaceEmailConnection } from "@/modules/workspace/hooks/useWorkspaceEmailConnection";
import { useWorkspaceEmails } from "@/modules/workspace/hooks/useWorkspaceEmails";
import { useWorkspaceSignals } from "@/modules/workspace/hooks/useWorkspaceSignals";
import { useWorkspaceTasks } from "@/modules/workspace/hooks/useWorkspaceTasks";
import type { WorkspaceModuleId } from "@/modules/workspace/types";

export default function WorkspacePage() {
  const [activeModule, setActiveModule] = useState<WorkspaceModuleId>("brief");
  const briefQuery = useWorkspaceBrief();
  const signalsQuery = useWorkspaceSignals();
  const decisionsQuery = useDecisionFeed();
  const emailsQuery = useWorkspaceEmails();
  const emailConnectionQuery = useWorkspaceEmailConnection();
  const tasksQuery = useWorkspaceTasks();
  const agentsQuery = useWorkspaceAgents();

  return (
    <WorkspaceLayout
      activeModule={activeModule}
      onSelectModule={setActiveModule}
      brief={briefQuery.data ?? null}
      emails={emailsQuery.data ?? []}
      emailConnection={emailConnectionQuery.data ?? null}
      tasks={tasksQuery.data ?? []}
      decisions={decisionsQuery.data ?? []}
      signals={signalsQuery.data ?? []}
      agents={agentsQuery.data ?? []}
    />
  );
}