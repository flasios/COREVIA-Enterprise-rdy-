import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Equal,
  FileText as _FileText,
  DollarSign as _DollarSign,
  Calendar as _Calendar,
  Users as _Users,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { ReportVersion } from "@shared/schema";

interface VersionDiffViewerProps {
  versionA: ReportVersion;
  versionB: ReportVersion;
  onClose: () => void;
}

type ChangeType = "added" | "removed" | "modified" | "unchanged";

interface FieldChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: ChangeType;
  category: string;
}

export default function VersionDiffViewer({
  versionA,
  versionB,
  onClose
}: VersionDiffViewerProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");
  const { t } = useTranslation();

  // Calculate differences between versions
  const calculateDiff = (): FieldChange[] => {
    const changes: FieldChange[] = [];
    const dataA = versionA.versionData as Record<string, unknown>;
    const dataB = versionB.versionData as Record<string, unknown>;

    // Define fields to compare with their labels and categories
    const fieldsToCompare = [
      { key: "businessObjective", label: "Business Objective", category: "Overview" },
      { key: "expectedOutcomes", label: "Expected Outcomes", category: "Overview" },
      { key: "successCriteria", label: "Success Criteria", category: "Overview" },
      { key: "estimatedBudget", label: "Estimated Budget", category: "Financial" },
      { key: "estimatedTimeline", label: "Timeline", category: "Planning" },
      { key: "urgency", label: "Urgency", category: "Overview" },
      { key: "stakeholders", label: "Stakeholders", category: "Governance" },
      { key: "constraints", label: "Constraints", category: "Planning" },
      { key: "riskFactors", label: "Risk Factors", category: "Risk" }
    ];

    fieldsToCompare.forEach(({ key, label, category }) => {
      const oldVal = dataA?.[key];
      const newVal = dataB?.[key];

      let changeType: ChangeType = "unchanged";
      if (oldVal === undefined && newVal !== undefined) {
        changeType = "added";
      } else if (oldVal !== undefined && newVal === undefined) {
        changeType = "removed";
      } else if (oldVal !== newVal) {
        changeType = "modified";
      }

      if (changeType !== "unchanged") {
        changes.push({
          field: key,
          label,
          oldValue: oldVal,
          newValue: newVal,
          changeType,
          category
        });
      }
    });

    // Check AI Analysis changes
    if (dataA?.aiAnalysis !== dataB?.aiAnalysis) {
      changes.push({
        field: "aiAnalysis",
        label: "AI Analysis",
        oldValue: dataA?.aiAnalysis,
        newValue: dataB?.aiAnalysis,
        changeType: "modified",
        category: "Analysis"
      });
    }

    return changes;
  };

  const changes = calculateDiff();
  const categorizedChanges = changes.reduce((acc, change) => {
    if (!acc[change.category]) {
      acc[change.category] = [];
    }
    acc[change.category]!.push(change);
    return acc;
  }, {} as Record<string, FieldChange[]>);

  const getChangeIcon = (type: ChangeType) => {
    switch (type) {
      case "added": return <Plus className="h-3.5 w-3.5 text-emerald-500" />;
      case "removed": return <Minus className="h-3.5 w-3.5 text-rose-500" />;
      case "modified": return <ArrowRight className="h-3.5 w-3.5 text-amber-500" />;
      default: return <Equal className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getChangeBadge = (type: ChangeType) => {
    switch (type) {
      case "added": return <Badge variant="default" className="bg-emerald-500 h-5">{t('versioning.diffViewer.added')}</Badge>;
      case "removed": return <Badge variant="destructive" className="h-5">{t('versioning.diffViewer.removed')}</Badge>;
      case "modified": return <Badge variant="default" className="bg-amber-500 h-5">{t('versioning.diffViewer.modified')}</Badge>;
      default: return <Badge variant="outline" className="h-5">{t('versioning.diffViewer.unchanged')}</Badge>;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderSideBySide = (change: FieldChange) => (
    <div
      key={change.field}
      className="grid grid-cols-2 gap-3 p-4 rounded-lg border bg-card hover-elevate"
      data-testid={`diff-field-${change.field}`}
    >
      {/* Old Value */}
      <div className={`space-y-2 ${change.changeType === "removed" ? "bg-rose-50 dark:bg-rose-950/20 p-3 rounded" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('versioning.diffViewer.before', { version: versionA.versionNumber })}</span>
          {change.changeType === "removed" && <XCircle className="h-3 w-3 text-rose-500" />}
        </div>
        <div className={`text-sm ${change.changeType === "removed" ? "line-through opacity-60" : ""}`}>
          {formatValue(change.oldValue)}
        </div>
      </div>

      {/* New Value */}
      <div className={`space-y-2 ${change.changeType === "added" ? "bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded" : change.changeType === "modified" ? "bg-amber-50 dark:bg-amber-950/20 p-3 rounded" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('versioning.diffViewer.after', { version: versionB.versionNumber })}</span>
          {change.changeType === "added" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
          {change.changeType === "modified" && <AlertCircle className="h-3 w-3 text-amber-500" />}
        </div>
        <div className={`text-sm ${change.changeType === "added" ? "font-medium" : ""}`}>
          {formatValue(change.newValue)}
        </div>
      </div>
    </div>
  );

  const renderUnified = (change: FieldChange) => (
    <div
      key={change.field}
      className="p-4 rounded-lg border bg-card space-y-3 hover-elevate"
      data-testid={`diff-unified-${change.field}`}
    >
      {change.changeType === "removed" && (
        <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2 mb-2">
            <Minus className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-xs font-medium text-rose-700 dark:text-rose-400">{t('versioning.diffViewer.removed')}</span>
            <span className="text-xs text-muted-foreground">({versionA.versionNumber})</span>
          </div>
          <div className="text-sm line-through opacity-70">{formatValue(change.oldValue)}</div>
        </div>
      )}

      {change.changeType === "added" && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('versioning.diffViewer.added')}</span>
            <span className="text-xs text-muted-foreground">({versionB.versionNumber})</span>
          </div>
          <div className="text-sm font-medium">{formatValue(change.newValue)}</div>
        </div>
      )}

      {change.changeType === "modified" && (
        <div className="space-y-2">
          <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded border border-rose-200 dark:border-rose-800">
            <div className="flex items-center gap-2 mb-2">
              <Minus className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-xs font-medium text-rose-700 dark:text-rose-400">{t('versioning.diffViewer.before', { version: versionA.versionNumber })}</span>
              <span className="text-xs text-muted-foreground">({versionA.versionNumber})</span>
            </div>
            <div className="text-sm line-through opacity-70">{formatValue(change.oldValue)}</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('versioning.diffViewer.after', { version: versionB.versionNumber })}</span>
              <span className="text-xs text-muted-foreground">({versionB.versionNumber})</span>
            </div>
            <div className="text-sm font-medium">{formatValue(change.newValue)}</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                {t('versioning.diffViewer.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('versioning.diffViewer.comparing', { versionA: versionA.versionNumber, versionB: versionB.versionNumber })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "side-by-side" | "unified")}>
                <TabsList className="h-8">
                  <TabsTrigger value="side-by-side" className="text-xs h-7">{t('versioning.diffViewer.sideBySide')}</TabsTrigger>
                  <TabsTrigger value="unified" className="text-xs h-7">{t('versioning.diffViewer.unified')}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-diff">
                {t('versioning.diffViewer.close')}
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="bg-emerald-500">
                {changes.filter(c => c.changeType === "added").length}
              </Badge>
              <span className="text-muted-foreground">{t('versioning.diffViewer.added')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="bg-amber-500">
                {changes.filter(c => c.changeType === "modified").length}
              </Badge>
              <span className="text-muted-foreground">{t('versioning.diffViewer.modified')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="destructive">
                {changes.filter(c => c.changeType === "removed").length}
              </Badge>
              <span className="text-muted-foreground">{t('versioning.diffViewer.removed')}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Changes by Category */}
      {Object.entries(categorizedChanges).map(([category, categoryChanges]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryChanges.map(change => (
              <div key={change.field} className="space-y-2">
                <div className="flex items-center gap-2">
                  {getChangeIcon(change.changeType)}
                  <span className="text-sm font-medium">{change.label}</span>
                  {getChangeBadge(change.changeType)}
                </div>
                {viewMode === "side-by-side" ? renderSideBySide(change) : renderUnified(change)}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {changes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Equal className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">{t('versioning.diffViewer.noChanges')}</p>
            <p className="text-sm mt-1">{t('versioning.diffViewer.identical')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
