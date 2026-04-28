import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Loader2, Send } from "lucide-react";
import { VersionHistoryTimeline } from "@/components/shared/versioning";
import type { ReportVersion } from "@shared/schema";

export interface EaExternalAdvisorResponse {
  ideation: string[];
  alternativeArchitectures: Array<{
    option: string;
    suitability: string;
    tradeoffs: string[];
    whenToChoose: string;
  }>;
  benchmarkComparisons: Array<{
    benchmark: string;
    baseline: string;
    target: string;
    rationale: string;
  }>;
  externalProvider?: string;
  anonymized?: boolean;
  generatedAt?: string;
}

interface VersionWorkflowAction {
  isPending: boolean;
  run: () => void;
}

interface EnterpriseArchitectureVersionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  latestVersion: ReportVersion | null;
  enterpriseVersions: ReportVersion[];
  submitForReview: VersionWorkflowAction;
  approveVersion: VersionWorkflowAction;
  sendToDirector: VersionWorkflowAction;
  finalApprove: VersionWorkflowAction;
  onViewVersion: (versionId: string) => void;
  onCompareVersions: (versionId1: string, versionId2: string) => void;
  onRestoreVersion: (versionId: string) => void;
}

export function EnterpriseArchitectureVersionSheet({
  open,
  onOpenChange,
  reportId,
  latestVersion,
  enterpriseVersions,
  submitForReview,
  approveVersion,
  sendToDirector,
  finalApprove,
  onViewVersion,
  onCompareVersions,
  onRestoreVersion,
}: EnterpriseArchitectureVersionSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("ea.architectureTab.eaVersionManagement")}</SheetTitle>
          <SheetDescription>
            {t("ea.architectureTab.eaVersionManagementDesc")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("ea.architectureTab.workflowActions")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {latestVersion?.status === "draft" && (
                <Button onClick={submitForReview.run} disabled={submitForReview.isPending} size="sm">
                  {submitForReview.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("ea.architectureTab.submitForReview")}
                </Button>
              )}
              {latestVersion?.status === "under_review" && (
                <Button onClick={approveVersion.run} disabled={approveVersion.isPending} size="sm">
                  {approveVersion.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  {t("ea.architectureTab.initialApproval")}
                </Button>
              )}
              {latestVersion?.status === "approved" && (
                <Button onClick={sendToDirector.run} disabled={sendToDirector.isPending} size="sm">
                  {sendToDirector.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("ea.architectureTab.submitForDirector")}
                </Button>
              )}
              {latestVersion?.status === "manager_approval" && (
                <Button onClick={finalApprove.run} disabled={finalApprove.isPending} size="sm">
                  {finalApprove.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  {t("ea.architectureTab.finalApproval")}
                </Button>
              )}
            </CardContent>
          </Card>

          <Separator />

          <VersionHistoryTimeline
            versions={enterpriseVersions}
            reportId={reportId}
            currentVersionId={latestVersion?.id}
            onViewVersion={onViewVersion}
            onCompareVersions={onCompareVersions}
            onRestoreVersion={onRestoreVersion}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface EnterpriseArchitectureAdvisorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advisorData: EaExternalAdvisorResponse | null;
}

export function EnterpriseArchitectureAdvisorSheet({
  open,
  onOpenChange,
  advisorData,
}: EnterpriseArchitectureAdvisorSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("ea.architectureTab.eaExternalAdvisoryPack")}</SheetTitle>
          <SheetDescription>
            {t("ea.architectureTab.eaExternalAdvisoryPackDesc")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {!advisorData ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {t("ea.architectureTab.noAdvisoryPackAvailable")}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("ea.architectureTab.ideation")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {advisorData.ideation.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {advisorData.ideation.map((item, index) => (
                        <li key={`ea-ideation-detail-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("ea.architectureTab.noIdeationPoints")}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("ea.architectureTab.alternativeArchitectureOptions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {advisorData.alternativeArchitectures.length > 0 ? (
                    advisorData.alternativeArchitectures.map((option, index) => (
                      <div key={`ea-alt-detail-${index}`} className="rounded-md border p-3 space-y-1">
                        <p className="text-sm font-semibold">{option.option}</p>
                        <p className="text-sm text-muted-foreground">{option.suitability}</p>
                        {option.tradeoffs.length > 0 && (
                          <p className="text-xs">{t("ea.architectureTab.tradeoffs")}: {option.tradeoffs.join(" • ")}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{t("ea.architectureTab.whenToChoose")}: {option.whenToChoose}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("ea.architectureTab.noAlternativesAvailable")}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("ea.architectureTab.benchmarkComparisons")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {advisorData.benchmarkComparisons.length > 0 ? (
                    advisorData.benchmarkComparisons.map((benchmark, index) => (
                      <div key={`ea-benchmark-detail-${index}`} className="rounded-md border p-3 space-y-1">
                        <p className="text-sm font-semibold">{benchmark.benchmark}</p>
                        <p className="text-xs">{t("ea.architectureTab.baseline")}: {benchmark.baseline}</p>
                        <p className="text-xs">{t("ea.architectureTab.target")}: {benchmark.target}</p>
                        <p className="text-sm text-muted-foreground">{benchmark.rationale}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("ea.architectureTab.noBenchmarkComparisons")}</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
