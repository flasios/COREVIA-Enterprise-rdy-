import { CheckCircle2, Clock, XCircle, AlertCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export type VerificationStatus = "pending_verification" | "verified" | "rejected" | "needs_review" | null | undefined;

const statusConfig: Record<string, {
  icon: React.ElementType;
  label: string;
  className: string;
  pulse?: boolean;
}> = {
  pending_verification: {
    icon: Clock,
    label: "Pending Verification",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    pulse: true,
  },
  verified: {
    icon: CheckCircle2,
    label: "Verified",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  needs_review: {
    icon: AlertCircle,
    label: "Needs Review",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
};

interface VerificationBadgeProps {
  status: string | null | undefined;
  sourceType?: string | null;
  confidenceScore?: number | null;
  compact?: boolean;
}

export function VerificationBadge({ status, sourceType, confidenceScore, compact }: VerificationBadgeProps) {
  if (!status) return null;
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`text-xs gap-1 border ${config.className} ${config.pulse ? "animate-pulse" : ""}`}>
            <Icon className="h-3 w-3" />
            {!compact && config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p className="font-medium">{config.label}</p>
            {sourceType === "demand_ingested" && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                Auto-ingested from approved demand
              </p>
            )}
            {confidenceScore != null && (
              <p className="text-muted-foreground">
                Confidence: {confidenceScore}%
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
