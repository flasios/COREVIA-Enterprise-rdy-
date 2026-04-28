import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Mail, PlugZap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { connectWorkspaceExchange } from "@/modules/workspace/services/workspaceApi";
import type { WorkspaceEmail, WorkspaceEmailConnection } from "@/modules/workspace/types";

type EmailPanelProps = {
  emails: WorkspaceEmail[];
  connection?: WorkspaceEmailConnection | null;
  compact?: boolean;
};

function getPriorityClass(priority: WorkspaceEmail["priority"]) {
  switch (priority) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
}

function getConnectionBadgeClass(connected: boolean, configured: boolean): string {
  if (connected) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (configured) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getConnectionLabel(connected: boolean, configured: boolean): string {
  if (connected) return "Exchange connected";
  if (configured) return "Exchange available";
  return "Exchange not configured";
}

function formatReceivedAt(receivedAt?: string | null) {
  if (!receivedAt) {
    return null;
  }

  const parsed = new Date(receivedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function ConnectionStatusMessage({ connected, configured, cardsEmpty }: Readonly<{ connected: boolean; configured: boolean; cardsEmpty: boolean }>) {
  if (!configured) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Microsoft Graph tenant credentials are not configured yet, so the workspace is showing fallback briefing mail instead of your real Exchange inbox.
      </p>
    );
  }
  if (!connected) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Connect your Exchange Online mailbox so the AI can read live emails, summarize them, suggest next actions, and send you back to Outlook when needed.
      </p>
    );
  }
  if (cardsEmpty) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Exchange is connected, but no inbox messages are available for the workspace right now.
      </p>
    );
  }
  return null;
}

function EmailCard({ email, compact }: Readonly<{ email: WorkspaceEmail; compact: boolean }>) {
  const receivedAt = formatReceivedAt(email.receivedAt);

  return (
    <article className={`rounded-[16px] border border-slate-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{email.subject}</div>
            <div className="text-sm text-slate-500">{email.sender}{receivedAt ? ` \u2022 ${receivedAt}` : ""}</div>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getPriorityClass(email.priority)}`}>
          {email.priority.toUpperCase()}
        </span>
      </div>
      <p className={`text-sm text-slate-600 ${compact ? "mt-3 leading-6" : "mt-4 leading-7"}`}>{email.summary}</p>
      <div className={`rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700 ${compact ? "mt-3 p-3" : "mt-4 p-4"}`}>
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Suggested Output</div>
        <div className="mt-2 font-medium">{email.suggestedAction}</div>
      </div>

      {email.webLink ? (
        <div className="mt-3 flex justify-end">
          <a
            href={email.webLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 transition hover:text-blue-600"
          >
            Open in Outlook
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}
    </article>
  );
}

export function EmailPanel({ emails, connection, compact = false }: Readonly<EmailPanelProps>) {
  const { toast } = useToast();
  const connectMutation = useMutation({
    mutationFn: connectWorkspaceExchange,
    onSuccess: (result) => {
      globalThis.location.assign(result.authorizationUrl);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to start Exchange connection.";
      toast({
        title: "Exchange connection failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const connected = Boolean(connection?.connected);
  const configured = Boolean(connection?.available);
  const cards = compact ? emails.slice(0, 4) : emails;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className={`rounded-[16px] border border-slate-200 bg-white shadow-sm ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Email Intelligence</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Inbox Copilot</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full border px-2.5 py-1 ${getConnectionBadgeClass(connected, configured)}`}>
                {getConnectionLabel(connected, configured)}
              </span>
              {connection?.connectionLabel ? <span>{connection.connectionLabel}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!connected && configured ? (
              <Button
                type="button"
                size="sm"
                className="gap-2 bg-blue-700 text-white hover:bg-blue-600"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                <PlugZap className="h-4 w-4" />
                {connectMutation.isPending ? "Connecting..." : "Connect Exchange"}
              </Button>
            ) : null}
            <div className="rounded-full bg-blue-50 p-3 text-blue-700">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>

        <ConnectionStatusMessage connected={connected} configured={configured} cardsEmpty={cards.length === 0} />
        </div>

        {cards.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 shadow-sm">
            {configured
              ? "No email threads are available yet. Connect Exchange or wait for live messages to be indexed into the workspace."
              : "Email intelligence stays empty until a live mailbox connection is configured."}
          </div>
        ) : null}

        <div className={`grid gap-3 ${compact ? "xl:grid-cols-1" : "xl:grid-cols-2"}`}>
          {cards.map((email) => (
            <EmailCard key={email.id} email={email} compact={compact} />
          ))}
        </div>
      </div>
    );
  }