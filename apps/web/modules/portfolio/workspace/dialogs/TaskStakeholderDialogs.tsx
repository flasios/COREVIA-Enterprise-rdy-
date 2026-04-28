import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: unknown) => void;
  isPending: boolean;
}

export function AddTaskDialog({ open, onOpenChange, onSubmit, isPending }: AddTaskDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    taskCode: '',
    title: '',
    description: '',
    wbsLevel: 1,
    taskType: 'task',
    priority: 'medium',
    estimatedHours: '',
  });

  const handleSubmit = () => {
    if (!formData.title || !formData.taskCode) return;
    onSubmit({
      ...formData,
      estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add WBS Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-code">Task Code *</Label>
              <Input
                id="task-code"
                value={formData.taskCode}
                onChange={(e) => setFormData({ ...formData, taskCode: e.target.value })}
                placeholder="e.g., 1.1.1"
                className="mt-1"
                data-testid="input-task-code"
              />
            </div>
            <div>
              <Label>WBS Level</Label>
              <Select value={String(formData.wbsLevel)} onValueChange={(v) => setFormData({ ...formData, wbsLevel: parseInt(v) })}>
                <SelectTrigger className="mt-1" data-testid="select-wbs-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                  <SelectItem value="4">Level 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="task-title">Task Title *</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.enterTaskTitle')}
              className="mt-1"
              data-testid="input-task-title"
            />
          </div>
          <div>
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeTask')}
              className="mt-1"
              data-testid="input-task-description"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Task Type</Label>
              <Select value={formData.taskType} onValueChange={(v) => setFormData({ ...formData, taskType: v })}>
                <SelectTrigger className="mt-1" data-testid="select-task-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work_package">Work Package</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="deliverable">Deliverable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="mt-1" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estimated-hours">Est. Hours</Label>
              <Input
                id="estimated-hours"
                type="number"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.hours')}
                className="mt-1"
                data-testid="input-estimated-hours"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.title || !formData.taskCode} data-testid="button-submit-task">
            {isPending ? 'Creating...' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddStakeholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: unknown) => void;
  isPending: boolean;
}

export function AddStakeholderDialog({ open, onOpenChange, onSubmit, isPending }: AddStakeholderDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    organization: '',
    email: '',
    stakeholderType: 'key_user',
    influenceLevel: 'medium',
    interestLevel: 'medium',
  });

  const handleSubmit = () => {
    if (!formData.name) return;
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stakeholder-name">Name *</Label>
              <Input
                id="stakeholder-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.fullName')}
                className="mt-1"
                data-testid="input-stakeholder-name"
              />
            </div>
            <div>
              <Label htmlFor="stakeholder-title">Title</Label>
              <Input
                id="stakeholder-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.jobTitle')}
                className="mt-1"
                data-testid="input-stakeholder-title"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stakeholder-org">Organization</Label>
              <Input
                id="stakeholder-org"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.organizationName')}
                className="mt-1"
                data-testid="input-stakeholder-org"
              />
            </div>
            <div>
              <Label htmlFor="stakeholder-email">Email</Label>
              <Input
                id="stakeholder-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('projectWorkspace.dialogs.emailAddress')}
                className="mt-1"
                data-testid="input-stakeholder-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={formData.stakeholderType} onValueChange={(v) => setFormData({ ...formData, stakeholderType: v })}>
                <SelectTrigger className="mt-1" data-testid="select-stakeholder-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sponsor">Sponsor</SelectItem>
                  <SelectItem value="champion">Champion</SelectItem>
                  <SelectItem value="key_user">Key User</SelectItem>
                  <SelectItem value="decision_maker">Decision Maker</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                  <SelectItem value="affected_party">Affected Party</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Influence</Label>
              <Select value={formData.influenceLevel} onValueChange={(v) => setFormData({ ...formData, influenceLevel: v })}>
                <SelectTrigger className="mt-1" data-testid="select-influence-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interest</Label>
              <Select value={formData.interestLevel} onValueChange={(v) => setFormData({ ...formData, interestLevel: v })}>
                <SelectTrigger className="mt-1" data-testid="select-interest-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-stakeholder">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.name} data-testid="button-submit-stakeholder">
            {isPending ? 'Adding...' : 'Add Stakeholder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
