import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AssumptionFormData {
  description: string;
  category: string;
  status: string;
  validationMethod: string;
  owner: string;
  validatedDate: string | null;
}

interface AddAssumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AssumptionFormData) => void;
  isPending: boolean;
}

export function AddAssumptionDialog({ open, onOpenChange, onSubmit, isPending }: AddAssumptionDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    description: '',
    category: 'general',
    validationMethod: '',
    owner: '',
  });

  const handleSubmit = () => {
    if (!formData.description) return;
    onSubmit({
      ...formData,
      status: 'pending',
      validatedDate: null,
    });
    setFormData({ description: '', category: 'general', validationMethod: '', owner: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            Add Assumption
          </DialogTitle>
          <DialogDescription>
            Record a project assumption that needs validation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="assumption-description">Assumption *</Label>
            <Textarea
              id="assumption-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Stakeholders will be available for scheduled meetings"
              className="mt-1"
              rows={2}
              data-testid="input-assumption-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1" data-testid="select-assumption-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="assumption-owner">Owner</Label>
              <Input
                id="assumption-owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.personResponsible')}
                className="mt-1"
                data-testid="input-assumption-owner"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="assumption-validation">Validation Method</Label>
            <Input
              id="assumption-validation"
              value={formData.validationMethod}
              onChange={(e) => setFormData({ ...formData, validationMethod: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.assumptionValidation')}
              className="mt-1"
              data-testid="input-assumption-validation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-assumption">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.description} data-testid="button-submit-assumption">
            {isPending ? 'Adding...' : 'Add Assumption'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditAssumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assumption: Partial<AssumptionFormData> | null;
  onSubmit: (data: AssumptionFormData) => void;
  isPending: boolean;
}

export function EditAssumptionDialog({ open, onOpenChange, assumption, onSubmit, isPending }: EditAssumptionDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<AssumptionFormData>({
    description: '',
    category: 'general',
    status: 'pending',
    validationMethod: '',
    owner: '',
    validatedDate: null,
  });

  useEffect(() => {
    if (assumption) {
      setFormData({
        description: assumption.description || '',
        category: assumption.category || 'general',
        status: assumption.status || 'pending',
        validationMethod: assumption.validationMethod || '',
        owner: assumption.owner || '',
        validatedDate: null,
      });
    }
  }, [assumption]);

  const handleSubmit = () => {
    if (!formData.description) return;
    onSubmit(formData);
  };

  if (!assumption) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            Edit Assumption
          </DialogTitle>
          <DialogDescription>
            Update project assumption details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-assumption-description">Assumption *</Label>
            <Textarea
              id="edit-assumption-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Stakeholders will be available for scheduled meetings"
              className="mt-1"
              rows={2}
              data-testid="input-edit-assumption-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-assumption-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-assumption-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="invalid">Invalid</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit-assumption-owner">Owner</Label>
            <Input
              id="edit-assumption-owner"
              value={formData.owner}
              onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.personResponsible')}
              className="mt-1"
              data-testid="input-edit-assumption-owner"
            />
          </div>
          <div>
            <Label htmlFor="edit-assumption-validation">Validation Method</Label>
            <Input
              id="edit-assumption-validation"
              value={formData.validationMethod}
              onChange={(e) => setFormData({ ...formData, validationMethod: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.assumptionValidation')}
              className="mt-1"
              data-testid="input-edit-assumption-validation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-assumption">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.description} data-testid="button-submit-edit-assumption">
            {isPending ? 'Updating...' : 'Update Assumption'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
