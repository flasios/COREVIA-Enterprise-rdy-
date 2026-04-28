import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { WbsTaskData } from '../../../types';

export interface WbsTaskUpdates {
  taskName?: string;
  title?: string;
  description?: string;
  notes?: string;
  status?: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  duration?: number;
  estimatedHours?: number;
  actualHours?: number;
  assignedTo?: string;
  isMilestone?: boolean;
  percentComplete?: number;
  progress?: number;
  actualStartDate?: string;
  actualEndDate?: string;
  predecessors?: string[];
  plannedCost?: string;
  actualCost?: string;
}

export function TaskEditForm({ task, onSave, onCancel, isLoading }: Readonly<{
  task: WbsTaskData;
  onSave: (updates: WbsTaskUpdates) => void;
  onCancel: () => void;
  isLoading: boolean;
}>) {
  const [title, setTitle] = useState(task.taskName || task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [status, setStatus] = useState(task.status || 'not_started');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [startDate, setStartDate] = useState(task.plannedStartDate || '');
  const [endDate, setEndDate] = useState(task.plannedEndDate || '');
  const [duration, setDuration] = useState(task.duration?.toString() || '');
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours?.toString() || '');

  const handleSave = () => {
    onSave({
      title,
      description,
      notes,
      status,
      priority,
      plannedStartDate: startDate || undefined,
      plannedEndDate: endDate || undefined,
      duration: duration ? Number.parseInt(duration) : undefined,
      estimatedHours: estimatedHours ? Number.parseFloat(estimatedHours) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label>Task Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add planning notes, supplier context, acceptance notes, or delivery commentary..." />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duration (days)</Label>
          <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estimated Hours</Label>
          <Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
