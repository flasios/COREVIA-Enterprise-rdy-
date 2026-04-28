import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  FileSearch,
  Loader2,
  RefreshCw,
  Shield,
  Target,
  Lightbulb,
  Mail,
  AlertCircle,
  Send,
  X as _X,
  ClipboardCheck
} from 'lucide-react';
import HexagonLogoFrame from '@/components/shared/misc/HexagonLogoFrame';
import { VideoLogo } from '@/components/ui/video-logo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { TaskEvidence, EvidenceAnalysis, WbsTaskData } from './types';

interface AIEvidenceEvaluatorProps {
  task: WbsTaskData;
  evidence: TaskEvidence[];
  projectName?: string;
  onAnalysisComplete?: (analysis: EvidenceAnalysis) => void;
}

interface EvidenceEvaluationResponse {
  analysis?: EvidenceAnalysis;
}

function buildTaskDescription(task: WbsTaskData): string {
  const explicitDescription = typeof task.description === 'string' ? task.description.trim() : '';
  if (explicitDescription) return explicitDescription;

  const taskLabel = task.taskName || task.title || 'Unnamed task';
  const taskType = task.taskType ? `${task.taskType} task` : 'task';
  const wbsCode = task.wbsCode ? ` (${task.wbsCode})` : '';

  return `${taskType}: ${taskLabel}${wbsCode}`;
}

function normalizeDeliverables(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const candidate = record.name ?? record.title ?? record.label ?? record.deliverable;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter((entry): entry is string => entry.length > 0);
}

function formatAnalyzedAt(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 'recently';
  }

  const analyzedAt = new Date(value);
  return Number.isNaN(analyzedAt.getTime()) ? 'recently' : analyzedAt.toLocaleString();
}

export function AIEvidenceEvaluator({
  task,
  evidence,
  projectName,
  onAnalysisComplete
}: AIEvidenceEvaluatorProps) {
  const [analysis, setAnalysis] = useState<EvidenceAnalysis | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailType, setEmailType] = useState<'report' | 'escalation'>('report');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [additionalMessage, setAdditionalMessage] = useState('');
  const taskDescription = buildTaskDescription(task);
  const taskDeliverables = normalizeDeliverables(task.deliverables);
  const { toast } = useToast();
  const { t } = useTranslation();

  const analysisMutation = useMutation<EvidenceEvaluationResponse, Error>({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/evaluate-evidence', {
        taskId: task.id,
        taskName: task.taskName || task.title,
        taskDescription,
        deliverables: taskDeliverables,
        evidence: evidence.map(e => ({
          id: e.id,
          fileName: e.fileName,
          fileType: e.fileType,
          description: e.description,
        })),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.analysis) {
        setAnalysis(data.analysis);
        onAnalysisComplete?.(data.analysis);
      }
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/send-evidence-email', {
        recipientEmail,
        recipientName,
        taskName: task.taskName || task.title,
        projectName: projectName || 'N/A',
        analysis,
        emailType: emailType === 'escalation' ? 'escalation' : 'report',
        senderName: 'EIAPH System',
        additionalMessage: additionalMessage || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: emailType === 'escalation' ? t('projectWorkspace.toast.escalationSent') : t('projectWorkspace.toast.reportSent'),
        description: t('projectWorkspace.toast.emailSentDesc', { email: recipientEmail }),
      });
      setShowEmailDialog(false);
      setRecipientEmail('');
      setRecipientName('');
      setAdditionalMessage('');
    },
    onError: () => {
      toast({
        title: t('projectWorkspace.toast.emailFailed'),
        description: t('projectWorkspace.toast.failedSendEmailDesc'),
        variant: 'destructive',
      });
    },
  });

  const openEmailDialog = (type: 'report' | 'escalation') => {
    setEmailType(type);
    setShowEmailDialog(true);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  if (evidence.length === 0) {
    return (
      <div className="p-6 bg-gradient-to-br from-slate-500/5 to-slate-600/5 rounded-xl border border-border/30">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <FileSearch className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h4 className="font-medium text-sm">{t('projectWorkspace.evidence.noEvidence')}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Upload task evidence to enable AI analysis
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <HexagonLogoFrame px={16} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">AI Evidence Evaluation</h4>
            <p className="text-[10px] text-muted-foreground">
              Powered by COREVIA AI
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={analysis ? 'outline' : 'default'}
          onClick={() => analysisMutation.mutate()}
          disabled={analysisMutation.isPending}
          className="h-8"
          data-testid="btn-analyze-evidence"
        >
          {analysisMutation.isPending ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Re-analyze
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1.5" />
              Evaluate Evidence
            </>
          )}
        </Button>
      </div>

      {analysisMutation.isPending && (
        <div className="p-6 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-indigo-500/5 rounded-xl border border-purple-500/20">
          <div className="flex flex-col items-center gap-4">
            <VideoLogo size="sm" />
            <div className="text-center">
              <p className="text-sm font-medium">COREVIA is analyzing your evidence...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Evaluating completeness, quality, and relevance
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Progress value={45} className="h-1" />
            </div>
          </div>
        </div>
      )}

      {analysis && !analysisMutation.isPending && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className={`p-4 rounded-xl border ${getScoreBg(analysis.overallScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className={`w-4 h-4 ${getScoreColor(analysis.overallScore)}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Overall</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.overallScore)}`}>
                {analysis.overallScore}%
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${getScoreBg(analysis.completenessScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className={`w-4 h-4 ${getScoreColor(analysis.completenessScore)}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Complete</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.completenessScore)}`}>
                {analysis.completenessScore}%
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${getScoreBg(analysis.qualityScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={`w-4 h-4 ${getScoreColor(analysis.qualityScore)}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Quality</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.qualityScore)}`}>
                {analysis.qualityScore}%
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${getScoreBg(analysis.relevanceScore)}`}>
              <div className="flex items-center gap-2 mb-2">
                <Shield className={`w-4 h-4 ${getScoreColor(analysis.relevanceScore)}`} />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Relevant</span>
              </div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.relevanceScore)}`}>
                {analysis.relevanceScore}%
              </div>
            </div>
          </div>

          {analysis.findings.length > 0 && (
            <div className="p-4 bg-card/50 rounded-xl border border-border/30">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <FileSearch className="w-3.5 h-3.5" />
                Key Findings
              </h5>
              <ul className="space-y-2">
                {analysis.findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.riskFlags.length > 0 && (
            <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Risk Flags
              </h5>
              <ul className="space-y-2">
                {analysis.riskFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendations.length > 0 && (
            <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5" />
                Recommendations
              </h5>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.complianceNotes && analysis.complianceNotes.length > 0 && (
            <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-3.5 h-3.5" />
                Compliance Notes
              </h5>
              <ul className="space-y-2">
                {analysis.complianceNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <ClipboardCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-muted-foreground">
              Analyzed {formatAnalyzedAt(analysis.analyzedAt)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEmailDialog('report')}
                className="h-7 text-xs"
                data-testid="btn-send-report"
              >
                <Mail className="w-3 h-3 mr-1.5" />
                Send Report
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => openEmailDialog('escalation')}
                className="h-7 text-xs"
                data-testid="btn-escalate"
              >
                <AlertCircle className="w-3 h-3 mr-1.5" />
                Escalate
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {emailType === 'escalation' ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Escalate Evidence Review
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 text-primary" />
                  Send Evaluation Report
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {emailType === 'escalation'
                ? 'Send an urgent escalation email about this evidence evaluation.'
                : 'Share the AI evaluation report via email.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="recipientEmail">Recipient Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder={t('projectWorkspace.evidence.emailPlaceholder')}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                data-testid="input-recipient-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recipientName">Recipient Name (Optional)</Label>
              <Input
                id="recipientName"
                placeholder={t('projectWorkspace.evidence.namePlaceholder')}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                data-testid="input-recipient-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="additionalMessage">
                {emailType === 'escalation' ? 'Escalation Reason' : 'Additional Message'} (Optional)
              </Label>
              <Textarea
                id="additionalMessage"
                placeholder={emailType === 'escalation'
                  ? 'Please explain why this requires urgent attention...'
                  : 'Add any additional context or notes...'}
                value={additionalMessage}
                onChange={(e) => setAdditionalMessage(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-additional-message"
              />
            </div>
            {analysis && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Evidence Summary</p>
                <div className="flex items-center gap-4">
                  <Badge variant={analysis.overallScore >= 60 ? 'default' : 'destructive'}>
                    Score: {analysis.overallScore}%
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {analysis.findings.length} findings, {analysis.riskFlags.length} risks
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              data-testid="btn-cancel-email"
            >
              Cancel
            </Button>
            <Button
              variant={emailType === 'escalation' ? 'destructive' : 'default'}
              onClick={() => emailMutation.mutate()}
              disabled={!recipientEmail || emailMutation.isPending}
              data-testid="btn-confirm-send-email"
            >
              {emailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {emailType === 'escalation' ? 'Send Escalation' : 'Send Report'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
