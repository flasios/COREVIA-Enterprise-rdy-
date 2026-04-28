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

interface AddRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: unknown) => void;
  isPending: boolean;
}

export function AddRiskDialog({ open, onOpenChange, onSubmit, isPending }: AddRiskDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'technical',
    probability: 'medium',
    impact: 'moderate',
    responseStrategy: '',
    mitigationPlan: '',
  });

  const handleSubmit = () => {
    if (!formData.title) return;
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add New Risk</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="risk-title">Risk Title *</Label>
            <Input
              id="risk-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.enterRiskTitle')}
              className="mt-1"
              data-testid="input-risk-title"
            />
          </div>
          <div>
            <Label htmlFor="risk-description">Description</Label>
            <Textarea
              id="risk-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeRisk')}
              className="mt-1"
              data-testid="input-risk-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-1" data-testid="select-risk-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Probability</Label>
              <Select value={formData.probability} onValueChange={(v) => setFormData({ ...formData, probability: v })}>
                <SelectTrigger className="mt-1" data-testid="select-risk-probability">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very_low">Very Low</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="very_high">Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Impact</Label>
              <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v })}>
                <SelectTrigger className="mt-1" data-testid="select-risk-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="negligible">Negligible</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Response Strategy</Label>
              <Select value={formData.responseStrategy} onValueChange={(v) => setFormData({ ...formData, responseStrategy: v })}>
                <SelectTrigger className="mt-1" data-testid="select-risk-strategy">
                  <SelectValue placeholder={t('projectWorkspace.dialogs.selectStrategy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avoid">Avoid</SelectItem>
                  <SelectItem value="mitigate">Mitigate</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="accept">Accept</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="mitigation-plan">Mitigation Plan</Label>
            <Textarea
              id="mitigation-plan"
              value={formData.mitigationPlan}
              onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeMitigation')}
              className="mt-1"
              data-testid="input-mitigation-plan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-risk">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.title} data-testid="button-submit-risk">
            {isPending ? 'Creating...' : 'Create Risk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: unknown) => void;
  isPending: boolean;
}

export function AddIssueDialog({ open, onOpenChange, onSubmit, isPending }: AddIssueDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issueType: 'technical',
    priority: 'medium',
    severity: 'moderate',
  });

  const handleSubmit = () => {
    if (!formData.title) return;
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Log New Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="issue-title">Issue Title *</Label>
            <Input
              id="issue-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.enterIssueTitle')}
              className="mt-1"
              data-testid="input-issue-title"
            />
          </div>
          <div>
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('projectWorkspace.dialogs.describeIssue')}
              className="mt-1"
              data-testid="input-issue-description"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={formData.issueType} onValueChange={(v) => setFormData({ ...formData, issueType: v })}>
                <SelectTrigger className="mt-1" data-testid="select-issue-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="process">Process</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="scope">Scope</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="mt-1" data-testid="select-issue-priority">
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
              <Label>Severity</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                <SelectTrigger className="mt-1" data-testid="select-issue-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-issue">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.title} data-testid="button-submit-issue">
            {isPending ? 'Creating...' : 'Log Issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
