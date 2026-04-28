import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Download, CheckCircle2, AlertCircle, Building2,
  ChevronRight, Loader2, FileCheck, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IngestResult {
  success: boolean;
  message: string;
  demandTitle: string;
  totalCreated: number;
  created: {
    applications: unknown[];
    capabilities: unknown[];
    data_domains: unknown[];
    technology_standards: unknown[];
    integrations: unknown[];
  };
  approvedVersions: {
    businessCase: { id: string; version: number; status: string } | null;
    requirements: { id: string; version: number; status: string } | null;
    enterpriseArchitecture: { id: string; version: number; status: string } | null;
  };
}

interface DemandInfo {
  id: string;
  title: string;
  department: string | null;
  workflowStatus: string;
  approvedAt: string | null;
  managerApprovedAt: string | null;
  hasApprovedEA: boolean;
  hasApprovedBC: boolean;
  hasApprovedReq: boolean;
  versions: {
    businessCase: { id: string; versionNumber: number; status: string } | null;
    requirements: { id: string; versionNumber: number; status: string } | null;
    enterpriseArchitecture: { id: string; versionNumber: number; status: string } | null;
  };
}

interface DemandIngestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemandIngestDialog({ open, onOpenChange }: DemandIngestDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [result, setResult] = useState<IngestResult | null>(null);

  const { data: eligibleData, isLoading } = useQuery({
    queryKey: ["/api/ea/registry/eligible-demands"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ea/registry/eligible-demands");
      return r.json();
    },
    enabled: open,
  });

  const ingestMutation = useMutation({
    mutationFn: async (demandId: string) => {
      const r = await apiRequest("POST", "/api/ea/registry/ingest-from-demand", { demandId });
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data);
      // Invalidate all registry queries
      queryClient.invalidateQueries({ queryKey: ["/api/ea/registry"] });
      toast({
        title: `Ingested ${data.totalCreated} entries`,
        description: `From demand: ${data.demandTitle}`,
      });
    },
    onError: () => toast({ title: "Ingest failed", variant: "destructive" }),
  });

  const demands: DemandInfo[] = eligibleData?.data ?? [];

  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Demand Auto-Ingest
          </DialogTitle>
          <DialogDescription>
            Import EA registry entries from approved demand reports with approved business cases, requirements, and EA assessments.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* Ingest Results */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">{result.message}</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  All entries are marked as &quot;Pending Verification&quot;
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {([
                ["Applications", result.created.applications.length],
                ["Capabilities", result.created.capabilities.length],
                ["Data Domains", result.created.data_domains.length],
                ["Tech Standards", result.created.technology_standards.length],
                ["Integrations", result.created.integrations.length],
              ] as const).map(([label, count]) => (
                <div key={label} className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{count}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {result.approvedVersions && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground">Source Versions Used:</h4>
                <div className="flex flex-wrap gap-2">
                  {result.approvedVersions.businessCase && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileCheck className="h-3 w-3 text-emerald-500" />
                      Business Case v{result.approvedVersions.businessCase.version}
                    </Badge>
                  )}
                  {result.approvedVersions.requirements && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileCheck className="h-3 w-3 text-blue-500" />
                      Requirements v{result.approvedVersions.requirements.version}
                    </Badge>
                  )}
                  {result.approvedVersions.enterpriseArchitecture && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <FileCheck className="h-3 w-3 text-indigo-500" />
                      EA v{result.approvedVersions.enterpriseArchitecture.version}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          /* Demand Selection */
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              </div>
            ) : demands.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No Eligible Demands</p>
                <p className="text-sm mt-1">
                  No demand reports with manager-approved status and approved EA versions found.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {demands.length} demand report{demands.length > 1 ? "s" : ""} eligible for EA registry ingest:
                </p>
                {demands.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{d.title || d.id}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {d.department && (
                          <span className="text-[10px] text-muted-foreground">{d.department}</span>
                        )}
                        <div className="flex gap-1">
                          {d.hasApprovedBC && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> BC
                            </Badge>
                          )}
                          {d.hasApprovedReq && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> REQ
                            </Badge>
                          )}
                          {d.hasApprovedEA && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> EA
                            </Badge>
                          )}
                          {!d.hasApprovedBC && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 text-muted-foreground">
                              <X className="h-2.5 w-2.5" /> BC
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => ingestMutation.mutate(d.id)}
                      disabled={ingestMutation.isPending}
                    >
                      {ingestMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Ingest
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
