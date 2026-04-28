import { Loader2, Save as SaveIcon, Trash2, Edit3 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type PlanningArtifactDialogArtifact = {
  name: string;
};

export type PlanningArtifactDraft = {
  name: string;
  phase: string;
  description: string;
};

type PlanningArtifactDialogsProps = {
  editingArtifact: PlanningArtifactDialogArtifact | null;
  deletingArtifact: PlanningArtifactDialogArtifact | null;
  draft: PlanningArtifactDraft;
  isSaving: boolean;
  onDraftChange: (updater: (current: PlanningArtifactDraft) => PlanningArtifactDraft) => void;
  onCloseEditor: () => void;
  onSave: () => void;
  onCloseDelete: () => void;
  onDelete: () => void;
};

export function PlanningArtifactDialogs({
  editingArtifact,
  deletingArtifact,
  draft,
  isSaving,
  onDraftChange,
  onCloseEditor,
  onSave,
  onCloseDelete,
  onDelete,
}: PlanningArtifactDialogsProps) {
  return (
    <>
      <Dialog open={!!editingArtifact} onOpenChange={(open) => !open && onCloseEditor()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Edit Planning Artifact
            </DialogTitle>
            <DialogDescription>
              Refine the planning artifact before it is checked and handed forward into execution management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planning-artifact-name">Artifact name</Label>
              <Input
                id="planning-artifact-name"
                value={draft.name}
                onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="Requirements baseline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planning-artifact-phase">Planning phase</Label>
              <Input
                id="planning-artifact-phase"
                value={draft.phase}
                onChange={(event) => onDraftChange((current) => ({ ...current, phase: event.target.value }))}
                placeholder="Planning"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planning-artifact-description">Description</Label>
              <Textarea
                id="planning-artifact-description"
                value={draft.description}
                onChange={(event) => onDraftChange((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe what must be checked in planning before execution and monitoring can rely on it."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCloseEditor}>
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SaveIcon className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingArtifact} onOpenChange={(open) => !open && onCloseDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Planning Artifact
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deletingArtifact?.name}" from this planning package? This keeps the artifact out of the planning baseline until it is reintroduced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Artifact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
