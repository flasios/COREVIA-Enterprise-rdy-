import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_CATEGORY_LIST } from "@shared/documentCategories";
import { useTranslation } from "react-i18next";

type UploadAccessLevel = "public" | "internal" | "restricted";

type PMOOfficeUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pmoUploadInputKey: number;
  pmoUploadFile: File | null;
  onPmoUploadFileChange: (file: File | null) => void;
  pmoUploadClassification: string;
  onPmoUploadClassificationChange: (value: string) => void;
  pmoUploadCategory: string;
  onPmoUploadCategoryChange: (value: string) => void;
  pmoUploadTags: string;
  onPmoUploadTagsChange: (value: string) => void;
  pmoUploadAccess: UploadAccessLevel;
  onPmoUploadAccessChange: (value: UploadAccessLevel) => void;
  onSubmit: () => void;
  submitPending: boolean;
};

export default function PMOOfficeUploadDialog({
  open,
  onOpenChange,
  pmoUploadInputKey,
  pmoUploadFile,
  onPmoUploadFileChange,
  pmoUploadClassification,
  onPmoUploadClassificationChange,
  pmoUploadCategory,
  onPmoUploadCategoryChange,
  pmoUploadTags,
  onPmoUploadTagsChange,
  pmoUploadAccess,
  onPmoUploadAccessChange,
  onSubmit,
  submitPending,
}: PMOOfficeUploadDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("pmo.office.uploadPmoStandard")}</DialogTitle>
          <DialogDescription>{t("pmo.office.uploadPmoStandardDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-amber-200/60 bg-amber-50/40 p-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Document</Label>
            <Input
              key={pmoUploadInputKey}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.rtf,.json,.xml,.html,.png,.jpg,.jpeg,.tiff,.bmp,.gif,.webp"
              onChange={(event) => onPmoUploadFileChange(event.target.files?.[0] || null)}
              className="mt-2"
              data-testid="input-pmo-upload"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {pmoUploadFile ? `${t("pmo.office.uploadSelected")}: ${pmoUploadFile.name}` : t("pmo.office.uploadFormats")}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("pmo.office.uploadClassification")}</Label>
              <Select value={pmoUploadClassification} onValueChange={onPmoUploadClassificationChange}>
                <SelectTrigger data-testid="select-pmo-classification">
                  <SelectValue placeholder={t("pmo.office.selectClassification")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Guidelines">{t("pmo.office.classGuidelines")}</SelectItem>
                  <SelectItem value="Process">{t("pmo.office.classProcess")}</SelectItem>
                  <SelectItem value="Policies">{t("pmo.office.classPolicies")}</SelectItem>
                  <SelectItem value="Research">{t("pmo.office.classResearch")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("pmo.office.uploadCategory")}</Label>
              <Select value={pmoUploadCategory} onValueChange={onPmoUploadCategoryChange}>
                <SelectTrigger data-testid="select-pmo-category">
                  <SelectValue placeholder={t("pmo.office.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORY_LIST.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("pmo.office.uploadTags")}</Label>
            <Input
              value={pmoUploadTags}
              onChange={(event) => onPmoUploadTagsChange(event.target.value)}
              placeholder="governance, compliance, portfolio"
              data-testid="input-pmo-tags"
            />
            <div className="text-[11px] text-muted-foreground">{t("pmo.office.uploadTagsHint")}</div>
          </div>

          <div className="space-y-2">
            <Label>{t("pmo.office.uploadAccessLevel")}</Label>
            <Select value={pmoUploadAccess} onValueChange={(value) => onPmoUploadAccessChange(value as UploadAccessLevel)}>
              <SelectTrigger data-testid="select-pmo-access">
                <SelectValue placeholder={t("pmo.office.selectAccess")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="restricted">Restricted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{t("pmo.office.uploadIndexHint")}</div>
          <Button size="sm" onClick={onSubmit} disabled={!pmoUploadFile || submitPending} data-testid="button-pmo-upload">
            {submitPending ? t("pmo.office.uploading") : t("pmo.office.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}