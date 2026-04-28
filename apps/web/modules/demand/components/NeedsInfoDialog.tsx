import { useState } from "react";
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Send, X } from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { useDecisionResume } from "../hooks/useDecisionResume";

interface NeedsInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decisionId: string;
  missingFields: string[];
  demandTitle?: string;
  onSuccess?: () => void;
}

const fieldLabels: Record<string, string> = {
  estimatedBudget: "Estimated Budget",
  estimatedTimeline: "Estimated Timeline",
  businessObjective: "Business Objective",
  expectedOutcome: "Expected Outcome",
  stakeholders: "Key Stakeholders",
  technicalRequirements: "Technical Requirements",
  riskAssessment: "Risk Assessment",
  successMetrics: "Success Metrics",
  resourceRequirements: "Resource Requirements",
  dependencies: "Dependencies",
  constraints: "Constraints",
  assumptions: "Assumptions",
  justification: "Business Justification",
  priority: "Priority Level",
  impactAssessment: "Impact Assessment",
};

const fieldDescriptions: Record<string, string> = {
  estimatedBudget: "The anticipated budget range for this initiative (e.g., AED 50,000 - 100,000)",
  estimatedTimeline: "Expected duration or target completion date",
  businessObjective: "The key business goal this initiative addresses",
  expectedOutcome: "What you expect to achieve upon completion",
  stakeholders: "Key people or departments involved",
  technicalRequirements: "Technical specifications or system requirements",
  riskAssessment: "Potential risks and mitigation strategies",
  successMetrics: "How success will be measured",
  resourceRequirements: "People, tools, or resources needed",
  dependencies: "Other projects or systems this depends on",
  constraints: "Limitations or restrictions to consider",
  assumptions: "Key assumptions made for this initiative",
  justification: "Why this initiative is needed now",
  priority: "Critical, High, Medium, or Low",
  impactAssessment: "Expected impact on operations or stakeholders",
};

export function NeedsInfoDialog({
  open,
  onOpenChange,
  decisionId,
  missingFields,
  demandTitle,
  onSuccess,
}: NeedsInfoDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const { provideInfo, isSubmitting } = useDecisionResume({
    onSuccess: () => {
      onOpenChange(false);
      setFormData({});
      onSuccess?.();
    },
  });

  const handleSubmit = () => {
    if (Object.keys(formData).length === 0) return;

    provideInfo({
      decisionId,
      additionalData: formData,
    });
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const isTextArea = (field: string) => {
    return [
      "businessObjective",
      "expectedOutcome",
      "technicalRequirements",
      "riskAssessment",
      "successMetrics",
      "dependencies",
      "constraints",
      "assumptions",
      "justification",
      "impactAssessment",
    ].includes(field);
  };

  const allFieldsFilled = missingFields.every(field => formData[field]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <HexagonLogoFrame px={20} />
            </div>
            <div>
              <DialogTitle className="text-lg">{t('demand.needsInfo.title')}</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                {demandTitle ? `${t('demand.needsInfo.for')}: ${demandTitle}` : t('demand.needsInfo.defaultDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t('demand.needsInfo.instructions')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {missingFields.map(field => (
              <Badge
                key={field}
                variant="outline"
                className={`text-xs ${formData[field]?.trim() ? 'border-emerald-500 text-emerald-600' : 'border-amber-500 text-amber-600'}`}
              >
                {fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').trim()}
                {formData[field]?.trim() && " ✓"}
              </Badge>
            ))}
          </div>

          <div className="space-y-4">
            {missingFields.map(field => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field} className="text-sm font-medium">
                  {fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').trim()}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                {fieldDescriptions[field] && (
                  <p className="text-xs text-muted-foreground -mt-1">
                    {fieldDescriptions[field]}
                  </p>
                )}
                {isTextArea(field) ? (
                  <Textarea
                    id={field}
                    value={formData[field] || ""}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter ${fieldLabels[field]?.toLowerCase() || field}...`}
                    className="min-h-[80px] resize-none"
                  />
                ) : (
                  <Input
                    id={field}
                    value={formData[field] || ""}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter ${fieldLabels[field]?.toLowerCase() || field}...`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            {t('demand.needsInfo.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allFieldsFilled || isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? t('demand.needsInfo.submitting') : t('demand.needsInfo.submitAndResume')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
