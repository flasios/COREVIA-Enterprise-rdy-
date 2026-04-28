/**
 * COREVIA Intelligent Assistant Advisor
 *
 * The single, canonical AI advisor component for the entire platform.
 * Replace all usages of IntelligencePanel / SmartPanel AI chat with this.
 *
 * Props:
 *   context   — maps to a backend surface id (pmo-office, demand_submissions, etc.)
 *   mode      — 'sidebar' | 'floating' | 'embedded' | 'fullscreen'
 *   title     — optional panel title override
 *   onClose   — optional close handler (required for floating/fullscreen)
 */

import {
  useState, useRef, useEffect, useCallback, memo,
} from "react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import {
  Send, X, Volume2, VolumeX, Minimize2, Maximize2,
  Circle, Sparkles, ChevronDown, RotateCcw, Bot,
  AlertTriangle, Database, Zap, CheckCircle2,
  ChevronRight, History, ThumbsUp, ThumbsDown, Link2,
  BarChart3, ListChecks, ShieldAlert, Milestone,
    Download, FileText,
  } from "lucide-react";
import { HexagonLogoFrame } from "@/components/shared/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCoveria } from "@/contexts/CoveriaContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

export type AdvisorContext =
  | "general"
  | "pmo-office"
  | "demand_submissions"
  | "workspace"
  | "performance"
  | "ea";

export type AdvisorMode = "sidebar" | "floating" | "embedded" | "fullscreen";

interface ChatMessage {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Tool citations — data sources the AI queried to produce this answer */
  citations?: Array<{ tool: string; summary: string }>;
  /** Action confirmation — a write action the AI performed */
  actionConfirmed?: string;
  /** Smart follow-up suggestions from the AI */
  followUps?: string[];
  /** User feedback rating */
  feedback?: 'up' | 'down';
  /** Generated file attachments (e.g. PDF/Excel exports) */
  fileAttachments?: Array<{ url: string; filename: string; format: string }>;
}

interface ToolActivity {
  name: string;
  status: 'running' | 'done';
  summary?: string;
}

interface SurfaceConfig {
  id: string;
  enabled: boolean;
  streamingEnabled: boolean;
  allowedRoles: string[];
}

interface AdvisorConfigData {
  globalEnabled: boolean;
  model: string;
  surfaces: SurfaceConfig[];
}

export interface CoveriaAdvisorProps {
  context?: AdvisorContext;
  mode?: AdvisorMode;
  title?: string;
  subtitle?: string;
  /** Quick-action chips shown above the input */
  chips?: string[];
  onClose?: () => void;
  className?: string;
  /** If true, renders only the chat panel without the animated logo header */
  compact?: boolean;
  /** Live entity ID for context grounding (e.g., projectId, demandId) */
  entityId?: string;
}

// ── Context → surface id map ─────────────────────────────────────────────────

const CONTEXT_TO_SURFACE: Record<AdvisorContext, string> = {
  "pmo-office": "pmo",
  "demand_submissions": "demand",
  "general": "home",
  "workspace": "workspace",
  "performance": "performance",
  "ea": "ea",
};

// ── Streaming fetch (enhanced with tool events + conv_id) ────────────────────

interface StreamCallbacks {
  onToken: (t: string) => void;
  onConvId?: (id: string) => void;
  onToolStart?: (name: string) => void;
  onToolDone?: (name: string, summary?: string) => void;
  onAction?: (name: string) => void;
  onFollowUps?: (items: string[]) => void;
  onFileReady?: (url: string, filename: string, format: string) => void;
}

async function streamChat(
  message: string,
  history: Array<{ role: string; content: string }>,
  isFirstMessage: boolean,
  context: string,
  callbacks: StreamCallbacks,
  entityId?: string,
  conversationId?: string,
): Promise<string> {
  let fullText = "";
  try {
    const response = await fetch("/api/ai-assistant/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, isFirstMessage, conversationHistory: history, context, entityId, conversationId }),
    });

    if (!response.ok || !response.body) {
      return "I'm having trouble connecting right now. Please try again in a moment.";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break;
        try {
          const parsed = JSON.parse(raw) as { t?: string; type?: string; id?: string; name?: string; summary?: string; items?: string[]; url?: string; filename?: string; format?: string };
          if (parsed.t) {
            fullText += parsed.t;
            callbacks.onToken(parsed.t);
          } else if (parsed.type === 'conv_id' && parsed.id) {
            callbacks.onConvId?.(parsed.id);
          } else if (parsed.type === 'tool_start' && parsed.name) {
            callbacks.onToolStart?.(parsed.name);
          } else if (parsed.type === 'tool_done' && parsed.name) {
            callbacks.onToolDone?.(parsed.name, parsed.summary);
          } else if (parsed.type === 'action' && parsed.name) {
            callbacks.onAction?.(parsed.name);
          } else if (parsed.type === 'follow_ups' && Array.isArray(parsed.items)) {
            callbacks.onFollowUps?.(parsed.items);
          } else if (parsed.type === 'file_ready' && typeof parsed.url === 'string') {
            callbacks.onFileReady?.(parsed.url, typeof parsed.filename === 'string' ? parsed.filename : 'download', typeof parsed.format === 'string' ? parsed.format : 'file');
          }
        } catch { /* skip malformed */ }
      }
    }
  } catch {
    return "Connection lost. Please check your network and try again.";
  }
  return fullText || "I didn't receive a response. Please try again.";
}

// ── Greeting per context ─────────────────────────────────────────────────────

function getGreeting(context: AdvisorContext, name: string): string {
  const firstName = name.split(" ")[0] || "there";
  switch (context) {
    case "pmo-office":
      return `Hello ${firstName}! I'm your PMO Intelligence Advisor. I can surface portfolio health, flag at-risk projects, and walk you through approvals. What would you like to check first?`;
    case "demand_submissions":
      return `Hello ${firstName}! I'm here to help strengthen your demand submissions — I can review scope, flag missing details, and suggest better wording. Share a demand and we'll get started.`;
    case "performance":
      return `Hello ${firstName}! I'm your Performance Analytics Advisor. Ask me about KPIs, department scores, UAE Vision 2071 alignment, or any metric you'd like to explore.`;
    case "workspace":
      return `Hello ${firstName}! I'm your Workspace Advisor. I can help with tasks, milestones, risks, and team insights across your active projects.`;
    case "ea":
      return `Hello ${firstName}! I'm your Enterprise Architecture Advisor. Ask me about architecture conformance, capability gaps, integration patterns, or domain structure.`;
    default:
      return `Hello ${firstName}! I'm COREVIA, your Strategic Intelligence Advisor. I have full system awareness — portfolios, demands, business cases, and more. How can I help?`;
  }
}

// ── Default chips per context ────────────────────────────────────────────────

const DEFAULT_CHIPS: Record<AdvisorContext, string[]> = {
  "pmo-office": ["Portfolio Status", "Pending Approvals", "At-Risk Projects", "Team Capacity"],
  "demand_submissions": ["Review this demand", "What's missing?", "Improve the objective", "Check compliance"],
  "performance": ["Department KPIs", "At-Risk Metrics", "Vision 2071 Alignment", "Top Performers"],
  "workspace": ["Open Tasks", "Upcoming Milestones", "Active Risks", "Team Overview"],
  "ea": ["Architecture Gaps", "Capability Map", "Domain Conformance", "Integration Health"],
  "general": ["What can you do?", "System Overview", "Latest Insights", "Pending Actions"],
};

// ── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator = memo(() => (
  <div className="flex gap-2">
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200/50 bg-slate-50/80 px-3.5 py-2.5 shadow-sm dark:border-slate-700/40 dark:bg-slate-800/60">
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">COREVIA is thinking…</span>
      </div>
    </div>
  </div>
));
TypingIndicator.displayName = "TypingIndicator";

// ── Message bubble ────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  get_system_overview: "System Overview",
  search_demands: "Demands",
  search_projects: "Projects",
  analyze_risks: "Risk Analysis",
  detect_anomalies: "Anomaly Scan",
  predict_risks: "Risk Prediction",
  generate_daily_briefing: "Daily Briefing",
  generate_status_report: "Status Report",
  get_business_case_details: "Business Case",
  get_project_workspace: "Project Workspace",
  consult_specialized_agents: "Specialist Agents",
  export_pdf_report: "PDF Report",
  export_excel_report: "Excel Export",
  deep_analyze: "Deep Analysis",
};

const ACTION_LABELS: Record<string, string> = {
  create_task: "Task created",
  create_reminder: "Reminder set",
  send_notification: "Notification sent",
  approve_demand: "Demand approved",
  reject_demand: "Demand rejected",
  defer_demand: "Demand deferred",
  acknowledge_demand: "Demand acknowledged",
  update_project_health: "Health status updated",
  escalate_project: "Project escalated",
  bulk_approve_demands: "Demands bulk-approved",
  add_project_note: "Note added",
  export_pdf_report: "PDF report ready",
  export_excel_report: "Excel report ready",
};

// ── Inline entity link parser ─────────────────────────────────────────────────
// Detects "Project <Name>", "Demand #<ID>", "Risk: <Name>" patterns in AI text
// and wraps them with a clickable span so users can navigate directly.

interface EntityToken { type: 'text' | 'entity'; text: string; href?: string }

function parseEntityLinks(text: string): EntityToken[] {
  // Match patterns: "Project Alpha", "Demand #123", "demand ID abc-123-def"
  const pattern = /\b(Project\s+[A-Z][A-Za-z0-9 \-_]{1,40}|Demand\s+#[\w-]+|Risk:\s+[A-Z][A-Za-z0-9 ]{1,40})\b/g;
  const tokens: EntityToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
    const match = m[0];
    let href: string | undefined;
    if (/^Project\s+/i.test(match)) href = `/portfolio`;
    else if (/^Demand\s+/i.test(match)) href = `/demand`;
    tokens.push({ type: 'entity', text: match, href });
    last = m.index + match.length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens.length > 0 ? tokens : [{ type: 'text', text }];
}

function MessageText({ content }: { content: string }) {
  const tokens = parseEntityLinks(content);
  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((tok, i) =>
        tok.type === 'entity' ? (
          <a
            key={i}
            href={tok.href}
            className="inline-flex items-center gap-0.5 rounded bg-cyan-100/60 px-1 text-cyan-700 hover:bg-cyan-200/60 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-800/40 transition-colors underline-offset-2 hover:underline"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Link2 className="h-2.5 w-2.5 flex-shrink-0" />
            {tok.text}
          </a>
        ) : (
          <span key={i}>{tok.text}</span>
        ),
      )}
    </p>
  );
}

const MessageBubble = memo(({ msg, userInitial, runningTools, onFeedback, onFollowUpClick }: {
  msg: ChatMessage;
  userInitial: string;
  runningTools?: ToolActivity[];
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void;
  onFollowUpClick?: (text: string) => void;
}) => {
  const [citationsOpen, setCitationsOpen] = useState(false);
  const showToolActivity = msg.isStreaming && !msg.content && runningTools && runningTools.length > 0;
  return (
    <div className={cn("flex gap-2", msg.role === "user" && "justify-end")}>
      {msg.role === "assistant" && (
        <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
          <Bot className="h-3 w-3 text-white" />
        </div>
      )}
      <div className="flex min-w-0 max-w-[82%] flex-col gap-1">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed shadow-sm",
            msg.role === "assistant"
              ? "rounded-tl-sm border border-slate-200/50 bg-slate-50/80 text-slate-700 dark:border-slate-700/40 dark:bg-slate-800/60 dark:text-slate-300"
              : "rounded-tr-sm bg-gradient-to-br from-cyan-600 to-blue-600 text-white",
          )}
        >
          {/* Tool activity — shown inside the bubble while tools are running */}
          {showToolActivity ? (
            <div className="flex flex-col gap-1.5 py-0.5">
              {runningTools!.map(t => (
                <div key={t.name} className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 120, 240].map(d => (
                      <div
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                  <Database className="h-3 w-3 text-cyan-500" />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Fetching {TOOL_LABELS[t.name] ?? t.name}…
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {msg.role === "assistant"
                ? <MessageText content={msg.content} />
                : <p className="whitespace-pre-wrap">{msg.content}</p>
              }
              {msg.isStreaming && msg.content && <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-cyan-400 align-middle" />}
            </>
          )}
          <p className={cn("mt-1 text-[9px]", msg.role === "assistant" ? "text-slate-400 dark:text-slate-500" : "text-white/60")}>
            {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
          </p>
        </div>

        {/* Action confirmation badge */}
        {msg.actionConfirmed && (
          <div className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {msg.actionConfirmed}
          </div>
        )}

          {/* File attachment download buttons */}
          {msg.fileAttachments && msg.fileAttachments.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {msg.fileAttachments.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  download={file.filename}
                  className="flex items-center gap-2 rounded-lg border border-cyan-200/70 bg-cyan-50/80 px-3 py-2 text-[11px] font-medium text-cyan-700 transition-all hover:border-cyan-400/60 hover:bg-cyan-100/80 dark:border-cyan-700/40 dark:bg-cyan-900/20 dark:text-cyan-300 dark:hover:bg-cyan-800/30"
                >
                  {file.format === 'pdf' ? (
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                  )}
                  <span className="flex-1 truncate">{file.filename}</span>
                  <Download className="h-3 w-3 flex-shrink-0 opacity-60" />
                </a>
              ))}
            </div>
          )}

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <button
            onClick={() => setCitationsOpen(o => !o)}
            className="flex items-center gap-1 self-start rounded-lg border border-slate-200/60 bg-white/60 px-2 py-0.5 text-[9px] text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700/40 dark:bg-slate-900/40 dark:text-slate-400"
          >
            <Database className="h-2.5 w-2.5" />
            {msg.citations.length} data source{msg.citations.length > 1 ? 's' : ''}
            <ChevronRight className={cn("h-2.5 w-2.5 transition-transform", citationsOpen && "rotate-90")} />
          </button>
        )}
        {citationsOpen && msg.citations && (
          <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200/60 bg-white/80 p-2 text-[9px] dark:border-slate-700/40 dark:bg-slate-900/60">
            {msg.citations.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Zap className="h-2.5 w-2.5 flex-shrink-0 text-cyan-500" />
                <span className="font-medium">{TOOL_LABELS[c.tool] ?? c.tool}:</span>
                <span className="text-slate-400">{c.summary}</span>
              </div>
            ))}
          </div>
        )}

        {/* Thumbs up/down feedback (assistant messages only) */}
        {msg.role === "assistant" && !msg.isStreaming && msg.content && onFeedback && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFeedback(msg.messageId, 'up')}
              className={cn(
                "rounded p-1 transition-colors",
                msg.feedback === 'up'
                  ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
              )}
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onFeedback(msg.messageId, 'down')}
              className={cn(
                "rounded p-1 transition-colors",
                msg.feedback === 'down'
                  ? "text-red-400 bg-red-50 dark:bg-red-900/20"
                  : "text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
              )}
              title="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {msg.followUps && msg.followUps.length > 0 && !msg.isStreaming && onFollowUpClick && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {msg.followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUpClick(q)}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-200/70 bg-cyan-50/80 px-2.5 py-1 text-[10px] font-medium text-cyan-700 transition-all hover:border-cyan-400/60 hover:bg-cyan-100/80 dark:border-cyan-700/40 dark:bg-cyan-900/20 dark:text-cyan-300 dark:hover:bg-cyan-800/30"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      {msg.role === "user" && (
        <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-slate-600 flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
          {userInitial}
        </div>
      )}
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

// ── Main component ────────────────────────────────────────────────────────────

export default function CoveriaAdvisor({
  context = "general",
  mode = "sidebar",
  title,
  subtitle,
  chips,
  onClose,
  className,
  compact = false,
  entityId,
}: CoveriaAdvisorProps) {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { voiceEnabled, isSpeaking, toggleVoice, stopSpeaking, speak } = useCoveria();

  const userName = currentUser?.displayName || currentUser?.username || "there";
  const userInitial = (currentUser?.displayName?.[0] || currentUser?.username?.[0] || "U").toUpperCase();

  const surfaceId = CONTEXT_TO_SURFACE[context];
  const resolvedChips = chips ?? DEFAULT_CHIPS[context];

  // Advisor config — check if this surface is enabled
  const { data: configData } = useQuery<{ success: boolean; data: AdvisorConfigData }>({
    queryKey: ["/api/ai-assistant/advisor/config"],
    staleTime: 60_000,
  });

  const surfaceConfig = configData?.data?.surfaces?.find(s => s.id === surfaceId);
  const isEnabled = (configData?.data?.globalEnabled ?? true) && (surfaceConfig?.enabled ?? true);

  // Context transparency — live item counts for header pills
  const ctxSummaryParams = new URLSearchParams({ surface: surfaceId, ...(entityId ? { entityId } : {}) }).toString();
  const { data: ctxSummaryData } = useQuery<{ success: boolean; data: Record<string, number> }>({
    queryKey: ["/api/ai-assistant/advisor/context-summary", surfaceId, entityId],
    queryFn: () => fetch(`/api/ai-assistant/advisor/context-summary?${ctxSummaryParams}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 30_000,
    enabled: isEnabled,
  });
  const ctxCounts = ctxSummaryData?.data ?? {};

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { messageId: nanoid(), role: "assistant", content: getGreeting(context, userName), timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Tier 2: Tool activity
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  // Tier 3: Conversation persistence
  const convStorageKey = `corevia_conv_${surfaceId}_${entityId ?? 'global'}`;
  const [convId, setConvId] = useState<string | undefined>(() => {
    try { return localStorage.getItem(convStorageKey) ?? undefined; } catch { return undefined; }
  });
  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ messageId, feedback }: { messageId: string; feedback: 'up' | 'down' }) => {
      await fetch(`/api/ai-assistant/messages/${messageId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ feedback }),
      });
    },
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages / tool activity
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isSending, toolActivities]);

  const clearHistory = useCallback(() => {
    setMessages([
      { messageId: nanoid(), role: "assistant", content: getGreeting(context, userName), timestamp: new Date() },
    ]);
    setConvId(undefined);
    try { localStorage.removeItem(convStorageKey); } catch { /* noop */ }
  }, [context, userName, convStorageKey]);

  const sendMessage = useCallback(async (userMsg: string) => {
    if (!userMsg.trim() || isSending || !isEnabled) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const isFirstMessage = messages.filter(m => m.role === "user").length === 0;
    const assistantId = nanoid();

    setInput("");
    setToolActivities([]);
    setMessages(prev => [
      ...prev,
      { messageId: nanoid(), role: "user", content: userMsg, timestamp: new Date() },
      { messageId: assistantId, role: "assistant", content: "", timestamp: new Date(), isStreaming: true },
    ]);
    setIsSending(true);

    const citations: Array<{ tool: string; summary: string }> = [];
    let actionConfirmed: string | undefined;
    let accum = "";
    let followUps: string[] | undefined;
    const fileAttachments: Array<{ url: string; filename: string; format: string }> = [];

    await streamChat(
      userMsg,
      history,
      isFirstMessage,
      context,
      {
        onToken: (token) => {
          accum += token;
          setMessages(prev =>
            prev.map(m => m.messageId === assistantId ? { ...m, content: accum } : m),
          );
        },
        onConvId: (id) => {
          setConvId(id);
          try { localStorage.setItem(convStorageKey, id); } catch { /* noop */ }
        },
        onToolStart: (name) => {
          setToolActivities(prev => [...prev.filter(t => t.name !== name), { name, status: 'running' }]);
        },
        onToolDone: (name, summary) => {
          setToolActivities(prev => prev.map(t => t.name === name ? { ...t, status: 'done', summary } : t));
          if (summary) citations.push({ tool: name, summary });
          // Clear running indicators after a brief delay
          setTimeout(() => setToolActivities(prev => prev.filter(t => t.name !== name)), 2000);
        },
        onAction: (name) => {
          actionConfirmed = ACTION_LABELS[name] ?? name;
        },
        onFollowUps: (items) => {
          followUps = items;
        },
        onFileReady: (url, filename, format) => {
          fileAttachments.push({ url, filename, format });
        },
      },
      entityId,
      convId,
    );

    // Finalize message with citations, action confirmation, and follow-ups
    setMessages(prev =>
      prev.map(m =>
        m.messageId === assistantId
          ? {
              ...m,
              content: accum || "I didn't receive a response. Please try again.",
              isStreaming: false,
              citations: citations.length > 0 ? citations : undefined,
              actionConfirmed,
              followUps,
              fileAttachments: fileAttachments.length > 0 ? [...fileAttachments] : undefined,
            }
          : m,
      ),
    );

    setToolActivities([]);
    if (voiceEnabled && accum) speak(accum);
    setIsSending(false);
  }, [context, isSending, isEnabled, messages, voiceEnabled, speak, entityId, convId, convStorageKey]);

  const handleFeedback = useCallback((messageId: string, feedback: 'up' | 'down') => {
    setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, feedback } : m));
    feedbackMutation.mutate({ messageId, feedback });
  }, [feedbackMutation]);

  const handleFollowUp = useCallback((text: string) => {
    void sendMessage(text);
  }, [sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }, [input, sendMessage]);

  // ── Disabled surface ───────────────────────────────────────────────────────

  if (!isEnabled) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-8 text-center dark:border-amber-700/30 dark:bg-amber-900/20", className)}>
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">COREVIA Advisor is disabled for this surface</p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-500/70">A system administrator can re-enable it from the Brain Console.</p>
      </div>
    );
  }

  // ── Panel title / subtitle defaults ────────────────────────────────────────

  const panelTitle = title ?? "COREVIA Advisor";
  const panelSubtitle = subtitle ?? context.replace(/-/g, " ").replace(/_/g, " ");

  // ── Layout wrapper classes ─────────────────────────────────────────────────

  const wrapperCn = cn(
    "flex flex-col overflow-hidden bg-white/80 backdrop-blur-xl dark:bg-slate-950/80",
    mode === "sidebar" && "h-full",
    mode === "embedded" && "h-full rounded-2xl border border-slate-200/60 shadow-sm dark:border-slate-700/40",
    mode === "floating" && [
      "fixed z-50 rounded-2xl border border-slate-200/70 shadow-2xl dark:border-slate-700/40",
      isExpanded
        ? "bottom-4 right-4 top-16 w-[420px]"
        : "bottom-4 right-4 h-[520px] w-[380px]",
    ],
    mode === "fullscreen" && "fixed inset-0 z-50",
    className,
  );

  return (
    <div className={wrapperCn}>

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/40">
        {!compact && (
          <div className="relative flex-shrink-0">
            <HexagonLogoFrame px={36} animated />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-950" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {panelTitle}
            </h3>
            <Badge variant="outline" className="border-emerald-400/40 bg-emerald-50 px-1.5 py-0 text-[9px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Circle className="mr-0.5 h-1 w-1 fill-emerald-500" /> Live
            </Badge>
          </div>
          <p className="truncate text-[10px] capitalize text-slate-400 dark:text-slate-500">{panelSubtitle}</p>
          {/* Context transparency pills */}
          {Object.keys(ctxCounts).length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {ctxCounts.tasks !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <ListChecks className="h-2 w-2" />{ctxCounts.tasks} tasks
                </span>
              )}
              {ctxCounts.risks !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <ShieldAlert className="h-2 w-2" />{ctxCounts.risks} risks
                </span>
              )}
              {ctxCounts.milestones !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Milestone className="h-2 w-2" />{ctxCounts.milestones} milestones
                </span>
              )}
              {ctxCounts.kpis !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <BarChart3 className="h-2 w-2" />{ctxCounts.kpis} KPIs
                </span>
              )}
              {ctxCounts.projects !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Database className="h-2 w-2" />{ctxCounts.projects} projects
                </span>
              )}
              {ctxCounts.demands !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Zap className="h-2 w-2" />{ctxCounts.demands} demands
                </span>
              )}
              {ctxCounts.missingFields !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0 text-[9px] text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangle className="h-2 w-2" />{ctxCounts.missingFields} missing
                </span>
              )}
              {ctxCounts.slaHoursRemaining !== undefined && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <History className="h-2 w-2" />{ctxCounts.slaHoursRemaining}h SLA
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              if (isSpeaking) stopSpeaking();
              else toggleVoice();
            }}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              isSpeaking && "animate-pulse bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
              !isSpeaking && voiceEnabled && "text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10",
              !isSpeaking && !voiceEnabled && "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
            title={voiceEnabled ? "Voice on" : "Voice off"}
          >
            {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={clearHistory}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title="Clear conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {(mode === "floating" || mode === "fullscreen") && (
            <button
              onClick={() => setIsExpanded(v => !v)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title={isExpanded ? "Minimize" : "Expand"}
            >
              {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Quick chips ── */}
      {resolvedChips.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-200/40 px-4 py-2 dark:border-slate-700/30">
          {resolvedChips.map((chip) => (
            <button
              key={chip}
              disabled={isSending}
              onClick={() => void sendMessage(chip)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-slate-500 transition-all hover:border-cyan-400/60 hover:bg-cyan-50/80 hover:text-cyan-600 disabled:opacity-40 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-cyan-500/40 dark:hover:text-cyan-400"
            >
              <Sparkles className="h-2.5 w-2.5" />
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Chat body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.messageId}
              msg={msg}
              userInitial={userInitial}
              runningTools={msg.isStreaming ? toolActivities : undefined}
              onFeedback={handleFeedback}
              onFollowUpClick={handleFollowUp}
            />
          ))}

          {isSending && !messages.some(m => m.isStreaming) && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input row ── */}
      <div className="shrink-0 border-t border-slate-200/60 px-4 py-3 dark:border-slate-700/40">
        <div className="flex gap-2 rounded-xl border border-slate-200/70 bg-white/80 p-1.5 shadow-sm dark:border-slate-700/40 dark:bg-slate-900/60">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={t("advisor.inputPlaceholder", { defaultValue: "Ask COREVIA anything…" })}
            className="h-8 flex-1 rounded-lg bg-transparent px-3 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-300 dark:placeholder:text-slate-500 disabled:opacity-50"
          />
          <Button
            size="icon"
            disabled={isSending || !input.trim()}
            onClick={() => void sendMessage(input)}
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 shadow-sm hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40"
          >
            {isSending ? (
              <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-center text-[9px] text-slate-400 dark:text-slate-600">
            Powered by COREVIA Intelligence · {configData?.data?.model ?? "claude-sonnet-4"}
          </p>
          {convId && (
            <div className="flex items-center gap-1 text-[9px] text-emerald-500">
              <History className="h-2.5 w-2.5" />
              <span>Memory on</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
