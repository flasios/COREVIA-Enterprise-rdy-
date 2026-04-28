import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

interface ConstraintFormData {
  description: string;
  category: string;
  impact: string;
  mitigationPlan: string;
  mitigated: boolean;
}

interface AddConstraintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ConstraintFormData) => void;
  isPending: boolean;
}

export function AddConstraintDialog({ open, onOpenChange, onSubmit, isPending }: AddConstraintDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    description: '',
    category: 'general',
    impact: 'medium',
    mitigationPlan: '',
  });

  const handleSubmit = () => {
    if (!formData.description) return;
    onSubmit({
      ...formData,
      mitigated: false,
    });
    setFormData({ description: '', category: 'general', impact: 'medium', mitigationPlan: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            Add Constraint
          </DialogTitle>
          <DialogDescription>
            Document a project constraint or limitation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="constraint-description">Constraint *</Label>
            <Textarea
              id="constraint-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Budget cannot exceed approved amount"
              className="mt-1"
              rows={2}
              data-testid="input-constraint-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1" data-testid="select-constraint-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impact Level</Label>
              <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v })}>
                <SelectTrigger className="mt-1" data-testid="select-constraint-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="constraint-mitigation">Mitigation Plan</Label>
            <Textarea
              id="constraint-mitigation"
              value={formData.mitigationPlan}
              onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.constraintMitigation')}
              className="mt-1"
              rows={2}
              data-testid="input-constraint-mitigation"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-constraint">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.description} data-testid="button-submit-constraint">
            {isPending ? 'Adding...' : 'Add Constraint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditConstraintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  constraint: Partial<ConstraintFormData> | null;
  onSubmit: (data: ConstraintFormData) => void;
  isPending: boolean;
}

export function EditConstraintDialog({ open, onOpenChange, constraint, onSubmit, isPending }: EditConstraintDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ConstraintFormData>({
    description: '',
    category: 'general',
    impact: 'medium',
    mitigationPlan: '',
    mitigated: false,
  });

  useEffect(() => {
    if (constraint) {
      setFormData({
        description: constraint.description || '',
        category: constraint.category || 'general',
        impact: constraint.impact || 'medium',
        mitigationPlan: constraint.mitigationPlan || '',
        mitigated: constraint.mitigated || false,
      });
    }
  }, [constraint]);

  const handleSubmit = () => {
    if (!formData.description) return;
    onSubmit(formData);
  };

  if (!constraint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            Edit Constraint
          </DialogTitle>
          <DialogDescription>
            Update project constraint details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-constraint-description">Constraint *</Label>
            <Textarea
              id="edit-constraint-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Budget cannot exceed approved amount"
              className="mt-1"
              rows={2}
              data-testid="input-edit-constraint-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-constraint-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="regulatory">Regulatory</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impact Level</Label>
              <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-constraint-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="edit-constraint-mitigation">Mitigation Plan</Label>
            <Textarea
              id="edit-constraint-mitigation"
              value={formData.mitigationPlan}
              onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.constraintMitigation')}
              className="mt-1"
              rows={2}
              data-testid="input-edit-constraint-mitigation"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="edit-constraint-mitigated"
              checked={formData.mitigated}
              onCheckedChange={(checked) => setFormData({ ...formData, mitigated: !!checked })}
              data-testid="checkbox-edit-constraint-mitigated"
            />
            <Label htmlFor="edit-constraint-mitigated" className="text-sm">Constraint has been mitigated</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-constraint">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.description} data-testid="button-submit-edit-constraint">
            {isPending ? 'Updating...' : 'Update Constraint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
