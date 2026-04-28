import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye, Download, Edit2, Trash2, Plus, X, User, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { getFileIcon, getAccessLevelBadge } from "./knowledgeCentre.display";
import { formatFileSize } from "./knowledgeCentre.utils";
import type { AccessLevel, DocumentWithUploader, DocumentUpdateData } from "./knowledgeCentre.types";

// ============================================================================
// DOCUMENT PREVIEW MODAL COMPONENT
// ============================================================================

interface DocumentPreviewModalProps {
  document: DocumentWithUploader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
  onUpdateMetadata: (id: string, data: DocumentUpdateData) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}

export function DocumentPreviewModal({
  document,
  open,
  onOpenChange,
  onDelete,
  onUpdateMetadata,
  isDeleting,
  isUpdating,
}: DocumentPreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { t } = useTranslation();
  const [editCategory, setEditCategory] = useState(document.category || '');
  const [editTags, setEditTags] = useState<string[]>(document.tags || []);
  const [editAccessLevel, setEditAccessLevel] = useState<AccessLevel>(document.accessLevel as AccessLevel);
  const [editVisibilityScope, setEditVisibilityScope] = useState<'global' | 'organization' | 'department' | 'private'>(
    ((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.scope as 'global' | 'organization' | 'department' | 'private' || 'organization'
  );
  const [editSector, setEditSector] = useState<string>(
    (((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.sector as string) || ''
  );
  const [editOrganization, setEditOrganization] = useState<string>(
    (((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.organization as string) || ''
  );
  const [editDepartment, setEditDepartment] = useState<string>(
    (((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.department as string) || ''
  );
  const [tagInput, setTagInput] = useState('');

  const handleSaveMetadata = () => {
    onUpdateMetadata(document.id, {
      category: editCategory || null,
      tags: editTags,
      accessLevel: editAccessLevel,
      metadata: {
        ...(document.metadata as Record<string, unknown> || {}),
        visibility: {
          scope: editVisibilityScope,
          sector: editSector || undefined,
          organization: editOrganization || undefined,
          department: editDepartment || undefined,
        },
      },
    });
    setIsEditing(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !editTags.includes(tagInput.trim())) {
      setEditTags([...editTags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-document-preview">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {getFileIcon(document.fileType)}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg line-clamp-2" data-testid="text-preview-filename">
                  {document.filename}
                </DialogTitle>
                <DialogDescription data-testid="text-preview-filesize">
                  {formatFileSize(document.fileSize)} • {document.fileType.toUpperCase()}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/knowledge/documents/${document.id}/view`, '_blank')}
                data-testid="button-view-document"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = window.document.createElement('a');
                  link.href = `/api/knowledge/documents/${document.id}/download`;
                  link.download = document.filename;
                  link.click();
                }}
                data-testid="button-download-document"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                data-testid="button-edit-metadata"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    data-testid="button-delete-document"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('knowledge.docPreviewModal.deleteDocument')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('knowledge.docPreviewModal.deleteConfirm')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">{t('knowledge.docPreviewModal.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDelete(document.id)}
                      disabled={isDeleting}
                      data-testid="button-confirm-delete"
                    >
                      {isDeleting ? t('knowledge.docPreviewModal.deleting') : t('knowledge.docPreviewModal.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.category')}</Label>
                {isEditing ? (
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder={t('knowledge.docPreviewModal.enterCategory')}
                    className="mt-1"
                    data-testid="input-edit-category"
                  />
                ) : (
                  <p className="text-sm font-medium" data-testid="text-preview-category">
                    {document.category || t('knowledge.docPreviewModal.noCategory')}
                  </p>
                )}
              </div>
              
              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.tags')}</Label>
                {isEditing ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder={t('knowledge.docPreviewModal.addTag')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        data-testid="input-edit-tag"
                      />
                      <Button onClick={addTag} variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {editTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editTags.map(tag => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            {tag}
                            <X 
                              className="h-3 w-3 cursor-pointer" 
                              onClick={() => removeTag(tag)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {document.tags && document.tags.length > 0 ? (
                      document.tags.map(tag => (
                        <Badge key={tag} variant="secondary" data-testid={`preview-tag-${tag}`}>
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('knowledge.docPreviewModal.noTags')}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.accessLevel')}</Label>
                {isEditing ? (
                  <Select value={editAccessLevel} onValueChange={(val: string) => setEditAccessLevel(val as AccessLevel)}>
                    <SelectTrigger className="mt-1" data-testid="select-edit-access">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t('knowledge.docPreviewModal.public')}</SelectItem>
                      <SelectItem value="internal">{t('knowledge.docPreviewModal.internal')}</SelectItem>
                      <SelectItem value="restricted">{t('knowledge.docPreviewModal.restricted')}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    {getAccessLevelBadge(document.accessLevel)}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Visibility Scope</Label>
                {isEditing ? (
                  <Select value={editVisibilityScope} onValueChange={(val: 'global' | 'organization' | 'department' | 'private') => setEditVisibilityScope(val)}>
                    <SelectTrigger className="mt-1" data-testid="select-edit-visibility-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium mt-1 capitalize">
                    {((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.scope as string || 'organization'}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Sector</Label>
                {isEditing ? (
                  <Input
                    value={editSector}
                    onChange={(e) => setEditSector(e.target.value)}
                    placeholder="e.g. Government, Healthcare"
                    className="mt-1"
                    data-testid="input-edit-sector"
                  />
                ) : (
                  <p className="text-sm font-medium mt-1">
                    {(((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.sector as string) || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Organization</Label>
                {isEditing ? (
                  <Input
                    value={editOrganization}
                    onChange={(e) => setEditOrganization(e.target.value)}
                    placeholder="e.g. Ministry of Finance"
                    className="mt-1"
                    data-testid="input-edit-organization"
                  />
                ) : (
                  <p className="text-sm font-medium mt-1">
                    {(((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.organization as string) || 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Department</Label>
                {isEditing ? (
                  <Input
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="e.g. Strategy, PMO"
                    className="mt-1"
                    data-testid="input-edit-department"
                  />
                ) : (
                  <p className="text-sm font-medium mt-1">
                    {(((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined)?.department as string) || 'Not set'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.uploadedBy')}</Label>
                <p className="text-sm font-medium flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  {document.uploaderName}
                </p>
              </div>
              
              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.uploadDate')}</Label>
                <p className="text-sm font-medium flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(document.uploadedAt), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.processingStatus')}</Label>
                <Badge 
                  variant={document.processingStatus === 'completed' ? 'default' : 'secondary'}
                  className="mt-1"
                  data-testid="badge-processing-status"
                >
                  {document.processingStatus}
                </Badge>
              </div>

              {document.chunkCount && document.chunkCount > 0 && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">{t('knowledge.docPreviewModal.chunks')}</Label>
                  <p className="text-sm font-medium mt-1">{t('knowledge.docPreviewModal.chunksIndexed', { count: document.chunkCount })}</p>
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-edit"
              >
                {t('knowledge.docPreviewModal.cancel')}
              </Button>
              <Button 
                onClick={handleSaveMetadata}
                disabled={isUpdating}
                data-testid="button-save-metadata"
              >
                {isUpdating ? t('knowledge.docPreviewModal.saving') : t('knowledge.docPreviewModal.saveChanges')}
              </Button>
            </div>
          )}

          {/* Document Content */}
          {document.fullText && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('knowledge.docPreviewModal.extractedText')}</Label>
              <ScrollArea className="h-[300px] border rounded-lg p-4 bg-muted/20">
                <p className="text-sm whitespace-pre-wrap" data-testid="text-preview-content">
                  {document.fullText}
                </p>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-close-preview"
          >
            {t('knowledge.docPreviewModal.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
