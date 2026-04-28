import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as LinkIcon, Pencil } from 'lucide-react';
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

interface DependencyFormData {
  name: string;
  type: string;
  owner: string;
  dueDate: string;
  description: string;
  status: string;
}

interface AddDependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DependencyFormData) => void;
  isPending: boolean;
}

export function AddDependencyDialog({ open, onOpenChange, onSubmit, isPending }: AddDependencyDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<DependencyFormData>({
    name: '',
    type: 'internal',
    owner: '',
    dueDate: '',
    description: '',
    status: 'pending',
  });

  const handleSubmit = () => {
    if (!formData.name) return;
    onSubmit(formData);
    setFormData({ name: '', type: 'internal', owner: '', dueDate: '', description: '', status: 'pending' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Add Dependency
          </DialogTitle>
          <DialogDescription>
            Add a new project dependency to track
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="dep-name">Dependency Name *</Label>
            <Input
              id="dep-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., IT Infrastructure Readiness"
              className="mt-1"
              data-testid="input-dependency-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="mt-1" data-testid="select-dependency-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1" data-testid="select-dependency-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dep-owner">Owner</Label>
              <Input
                id="dep-owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="e.g., IT Dept"
                className="mt-1"
                data-testid="input-dependency-owner"
              />
            </div>
            <div>
              <Label htmlFor="dep-date">Due Date</Label>
              <Input
                id="dep-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-1"
                data-testid="input-dependency-date"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="dep-description">Description</Label>
            <Textarea
              id="dep-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeDependency')}
              className="mt-1"
              rows={2}
              data-testid="input-dependency-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-dependency">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.name} data-testid="button-submit-dependency">
            {isPending ? 'Adding...' : 'Add Dependency'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditDependencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependency: Partial<DependencyFormData> | null;
  onSubmit: (data: DependencyFormData) => void;
  isPending: boolean;
}

export function EditDependencyDialog({ open, onOpenChange, dependency, onSubmit, isPending }: EditDependencyDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<DependencyFormData>({
    name: '',
    type: 'internal',
    owner: '',
    dueDate: '',
    description: '',
    status: 'pending',
  });

  useEffect(() => {
    if (dependency) {
      setFormData({
        name: dependency.name || '',
        type: dependency.type || 'internal',
        owner: dependency.owner || '',
        dueDate: dependency.dueDate || '',
        description: dependency.description || '',
        status: dependency.status || 'pending',
      });
    }
  }, [dependency]);

  const handleSubmit = () => {
    if (!formData.name) return;
    onSubmit(formData);
  };

  if (!dependency) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Edit Dependency
          </DialogTitle>
          <DialogDescription>
            Update project dependency details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-dep-name">Dependency Name *</Label>
            <Input
              id="edit-dep-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., IT Infrastructure Readiness"
              className="mt-1"
              data-testid="input-edit-dependency-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-dependency-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-1" data-testid="select-edit-dependency-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-dep-owner">Owner</Label>
              <Input
                id="edit-dep-owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="e.g., IT Dept"
                className="mt-1"
                data-testid="input-edit-dependency-owner"
              />
            </div>
            <div>
              <Label htmlFor="edit-dep-date">Due Date</Label>
              <Input
                id="edit-dep-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-1"
                data-testid="input-edit-dependency-date"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-dep-description">Description</Label>
            <Textarea
              id="edit-dep-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeDependency')}
              className="mt-1"
              rows={2}
              data-testid="input-edit-dependency-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-dependency">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.name} data-testid="button-submit-edit-dependency">
            {isPending ? 'Updating...' : 'Update Dependency'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
