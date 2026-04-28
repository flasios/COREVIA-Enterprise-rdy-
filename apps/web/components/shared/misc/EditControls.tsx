import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Edit3, Save, RotateCcw, X } from "lucide-react";

interface EditControlsProps {
  editMode: boolean;
  isSaving?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onReset: () => void;
  onCancel?: () => void;
  editLabel?: string;
  saveLabel?: string;
  resetLabel?: string;
  cancelLabel?: string;
}

export function EditControls({
  editMode,
  isSaving = false,
  onEdit,
  onSave,
  onReset,
  onCancel,
  editLabel,
  saveLabel,
  resetLabel,
  cancelLabel
}: EditControlsProps) {
  const { t } = useTranslation();
  const resolvedEditLabel = editLabel ?? t('common.editControls.editContent');
  const resolvedSaveLabel = saveLabel ?? t('common.editControls.saveChanges');
  const resolvedResetLabel = resetLabel ?? t('common.editControls.reset');
  const resolvedCancelLabel = cancelLabel ?? t('common.editControls.cancel');

  if (editMode) {
    return (
      <div className="flex items-center gap-2">
        {onCancel && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onCancel}
            disabled={isSaving}
            data-testid="button-cancel-edit"
          >
            <X className="h-4 w-4 mr-2" />
            {resolvedCancelLabel}
          </Button>
        )}
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onReset}
          disabled={isSaving}
          data-testid="button-reset-content"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {resolvedResetLabel}
        </Button>
        <Button 
          size="sm" 
          onClick={onSave}
          disabled={isSaving}
          data-testid="button-save-content"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? t('common.editControls.saving') : resolvedSaveLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button 
      size="sm" 
      variant="outline" 
      onClick={onEdit}
      data-testid="button-edit-content"
    >
      <Edit3 className="h-4 w-4 mr-2" />
      {resolvedEditLabel}
    </Button>
  );
}