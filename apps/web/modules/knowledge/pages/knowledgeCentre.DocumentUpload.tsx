import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Upload, FileText, Calendar, User, Lock, Globe, Shield, Sparkles,
  X, Plus, Zap,
  FileCheck, FolderOpen, Folder,
} from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";
import { format } from "date-fns";
import {
  formatFileSize,
} from "./knowledgeCentre.utils";
import {
  sanitizeFilename,
  sanitizeFolderPath,
  validateFile,
} from "./knowledgeCentre.validation";
import { getClassificationIcon } from "./knowledgeCentre.display";
import type {
  AccessLevel,
  DuplicateWarning,
  UploadError,
  VisibilityScope,
} from "./knowledgeCentre.types";
import {
  KNOWLEDGE_CLASSIFICATIONS,
  DOCUMENT_CATEGORY_LIST,
  type KnowledgeClassification,
  type DocumentCategory,
} from "@shared/schema";
import { BulkUploadZone } from "./knowledgeCentre.BulkUploadZone";
import { RegenerateEmbeddingsSection, FixEncodingSection, UnassignedDocumentsSection } from "./knowledgeCentre.adminSections";

// ============================================================================
// CONSTANTS
// ============================================================================

const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AISuggestions {
  category: {
    suggested: string;
    confidence: number;
    alternatives?: Array<{ category: string; confidence: number }>;
  };
  tags: Array<{
    tag: string;
    score: number;
    source: string;
  }>;
}

// ============================================================================
// DOCUMENT UPLOAD COMPONENT
// ============================================================================

export function DocumentUpload() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [accessLevel, setAccessLevel] = useState<'public' | 'internal' | 'restricted'>('internal');
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('organization');
  const [visibilitySector, setVisibilitySector] = useState('');
  const [visibilityOrganization, setVisibilityOrganization] = useState('');
  const [visibilityDepartment, setVisibilityDepartment] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [_currentFileName, setCurrentFileName] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string>('');

  const buildVisibilityMetadata = useCallback(() => {
    const sector = visibilitySector.trim();
    const organization = visibilityOrganization.trim();
    const department = visibilityDepartment.trim();

    return {
      visibilityScope,
      ...(sector ? { sector } : {}),
      ...(organization ? { organization } : {}),
      ...(department ? { department } : {}),
    };
  }, [visibilityScope, visibilitySector, visibilityOrganization, visibilityDepartment]);

  // Chunked upload function for large files
  const uploadChunked = useCallback(async (file: File, metadata: {
    category?: string;
    tags?: string[];
    accessLevel: string;
    folderPath?: string;
    visibilityScope?: VisibilityScope;
    sector?: string;
    organization?: string;
    department?: string;
  }) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setUploadStatus('uploading');
    setCurrentFileName(file.name);
    setUploadProgress(0);

    try {
      // Step 1: Initialize chunked upload
      const initRes = await fetch('/api/knowledge/upload/chunked/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          fileType: file.name.split('.').pop()?.toLowerCase(),
          totalChunks,
          category: metadata.category,
          tags: metadata.tags ? JSON.stringify(metadata.tags) : undefined,
          accessLevel: metadata.accessLevel,
          folderPath: metadata.folderPath,
          visibilityScope: metadata.visibilityScope,
          sector: metadata.sector,
          organization: metadata.organization,
          department: metadata.department,
        }),
      });

      if (!initRes.ok) {
        const error = await initRes.json();
        throw new Error(error.error || 'Failed to initialize upload');
      }

      const { data: initData } = await initRes.json();
      const uploadId = initData.uploadId;

      // Step 2: Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', i.toString());

        const chunkRes = await fetch(`/api/knowledge/upload/chunked/${uploadId}/chunk`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!chunkRes.ok) {
          const error = await chunkRes.json();
          throw new Error(error.error || `Failed to upload chunk ${i + 1}`);
        }

        const { data: chunkData } = await chunkRes.json();
        setUploadProgress(Math.round((chunkData.progress * 0.9))); // 90% for upload, 10% for processing
      }

      // Step 3: Complete upload
      setUploadStatus('processing');
      setUploadProgress(90);

      const completeRes = await fetch(`/api/knowledge/upload/chunked/${uploadId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!completeRes.ok) {
        const error = await completeRes.json();
        throw new Error(error.error || 'Failed to complete upload');
      }

      const { data: completeData } = await completeRes.json();

      setUploadProgress(100);
      setUploadStatus('complete');

      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });

      toast({
        title: t('knowledge.documentUpload.uploadSuccessful'),
        description: t('knowledge.documentUpload.uploadSuccessfulChunkedDesc', { name: file.name, size: formatFileSize(file.size) }),
      });

      return completeData;
    } catch (error) {
      setUploadStatus('error');
      throw error;
    }
  }, [toast, t]);

  const selectedClassificationData = selectedClassification
    ? KNOWLEDGE_CLASSIFICATIONS[selectedClassification as KnowledgeClassification]
    : null;

  // Get allowed categories based on selected classification
  const availableCategories = useMemo(() => {
    if (!selectedClassificationData) {
      // If no classification selected, show all categories
      return DOCUMENT_CATEGORY_LIST;
    }
    // Filter to only allowed categories for this classification
    return DOCUMENT_CATEGORY_LIST.filter(cat =>
      selectedClassificationData.allowedCategories.includes(cat.id)
    );
  }, [selectedClassificationData]);

  // Reset category when classification changes and category is no longer valid
  useEffect(() => {
    if (category) {
      if (!selectedClassificationData) {
        // If classification is cleared, keep category (it's valid for all categories)
      } else {
        // If classification is set, check if category is still valid
        const isValidCategory = selectedClassificationData.allowedCategories.includes(category as DocumentCategory);
        if (!isValidCategory) {
          setCategory('');
        }
      }
    }
  }, [selectedClassification, selectedClassificationData, category]);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();

        // Handle duplicate detection (409 Conflict)
        if (res.status === 409 && error.isDuplicate) {
          throw { isDuplicate: true, ...error };
        }

        throw new Error(error.error || 'Upload failed');
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });

      // Capture AI suggestions if available
      if (data.data?.aiSuggestions) {
        setAiSuggestions(data.data.aiSuggestions);
        setShowAISuggestions(true);

        toast({
          title: t('knowledge.documentUpload.uploadSuccessful'),
          description: t('knowledge.documentUpload.uploadSuccessfulAIDesc'),
        });
      } else {
        toast({
          title: t('knowledge.documentUpload.uploadSuccessful'),
          description: t('knowledge.documentUpload.uploadSuccessfulDesc'),
        });
      }

      setUploadProgress(0);
    },
    onError: (error: Error) => {
      const uploadError = error as UploadError;
      // Handle duplicate detection
      if (uploadError.isDuplicate) {
        setDuplicateWarning({
          duplicateType: uploadError.duplicateType || 'exact',
          message: uploadError.message,
          existingDocument: uploadError.existingDocument!,
          pendingUpload: uploadError.pendingUpload!,
        });
        setUploadProgress(0);
        return;
      }

      toast({
        variant: "destructive",
        title: t('knowledge.documentUpload.uploadFailed'),
        description: error.message || t('knowledge.documentUpload.uploadErrorGeneric'),
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0]!;

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({
        variant: "destructive",
        title: t('knowledge.documentUpload.invalidFile'),
        description: validation.error,
      });
      return;
    }

    setCurrentFileName(sanitizeFilename(file.name));

    // Build folder path from classification and subfolder with sanitization
    const rawFolderPath = selectedClassification
      ? selectedSubfolder
        ? `${selectedClassification}/${selectedSubfolder}`
        : selectedClassification
      : undefined;
    const folderPath = rawFolderPath ? sanitizeFolderPath(rawFolderPath) || undefined : undefined;

    // Use chunked upload for large files (> 50MB)
    if (file.size > CHUNKED_UPLOAD_THRESHOLD) {
      try {
        await uploadChunked(file, {
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          accessLevel,
          folderPath,
          ...buildVisibilityMetadata(),
        });
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: t('knowledge.documentUpload.uploadFailed'),
          description: error instanceof Error ? error.message : t('knowledge.documentUpload.uploadLargeFileFailed'),
        });
        setUploadProgress(0);
        setUploadStatus('idle');
      }
      return;
    }

    // Regular upload for smaller files
    const formData = new FormData();
    formData.append('file', file);
    if (category) formData.append('category', category);
    if (tags.length > 0) formData.append('tags', JSON.stringify(tags));
    formData.append('accessLevel', accessLevel);
    if (folderPath) formData.append('folderPath', folderPath);
    const visibility = buildVisibilityMetadata();
    formData.append('visibilityScope', visibility.visibilityScope);
    if (visibility.sector) formData.append('sector', visibility.sector);
    if (visibility.organization) formData.append('organization', visibility.organization);
    if (visibility.department) formData.append('department', visibility.department);

    setUploadStatus('uploading');
    setUploadProgress(50);

    try {
      await uploadMutation.mutateAsync(formData);
      setUploadStatus('complete');
    } catch (error: unknown) {
      const uploadError = error as UploadError;
      // If it's a duplicate, store the formData for potential retry
      if (uploadError.isDuplicate) {
        setDuplicateWarning({
          duplicateType: uploadError.duplicateType || 'exact',
          message: uploadError.message,
          existingDocument: uploadError.existingDocument!,
          pendingUpload: formData,
        });
        setUploadProgress(0);
        setUploadStatus('idle');
      } else {
        setUploadStatus('error');
      }
    }
  }, [category, tags, accessLevel, selectedClassification, selectedSubfolder, uploadMutation, uploadChunked, toast, t, buildVisibilityMetadata]);

  const handleProceedAnyway = useCallback(async () => {
    if (!duplicateWarning?.pendingUpload) return;

    // Add flag to proceed despite warning
    duplicateWarning.pendingUpload.append('ignoreDuplicateWarning', 'true');

    setDuplicateWarning(null);
    setUploadProgress(50);
    uploadMutation.mutate(duplicateWarning.pendingUpload);
  }, [duplicateWarning, uploadMutation]);

  const handleCancelUpload = useCallback(() => {
    setDuplicateWarning(null);
    setUploadProgress(0);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/rtf': ['.rtf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/json': ['.json'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'text/html': ['.html'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/tiff': ['.tiff'],
      'image/bmp': ['.bmp'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB (chunked upload for large files)
    multiple: false,
  });

  // Reset upload status after a delay
  useEffect(() => {
    if (uploadStatus === 'complete') {
      const timer = setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setCurrentFileName('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadStatus]);

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const applySuggestedCategory = () => {
    if (aiSuggestions?.category.suggested) {
      setCategory(aiSuggestions.category.suggested);
      toast({
        title: t('knowledge.documentUpload.categoryApplied'),
        description: t('knowledge.documentUpload.categoryAppliedDesc', { category: aiSuggestions.category.suggested }),
      });
    }
  };

  const applySuggestedTags = () => {
    if (aiSuggestions?.tags) {
      const suggestedTagNames = aiSuggestions.tags.map(t => t.tag);
      setTags(suggestedTagNames);
      toast({
        title: t('knowledge.documentUpload.tagsApplied'),
        description: t('knowledge.documentUpload.tagsAppliedDesc', { count: suggestedTagNames.length }),
      });
    }
  };

  const applyAllSuggestions = () => {
    applySuggestedCategory();
    applySuggestedTags();
    setShowAISuggestions(false);
  };

  const dismissSuggestions = () => {
    setShowAISuggestions(false);
    setAiSuggestions(null);
  };

  return (
    <>
      {/* Duplicate Warning Dialog */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && handleCancelUpload()}>
        <AlertDialogContent data-testid="dialog-duplicate-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-amber-500" />
              {duplicateWarning?.duplicateType === 'exact' ? t('knowledge.documentUpload.exactDuplicate') : t('knowledge.documentUpload.similarDocument')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p className="text-base">{duplicateWarning?.message}</p>

              {duplicateWarning?.existingDocument && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="font-medium text-foreground">{t('knowledge.documentUpload.existingDocument')}:</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium" data-testid="text-existing-filename">
                        {duplicateWarning.existingDocument.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{t('knowledge.documentUpload.uploadedByUser', { name: duplicateWarning.existingDocument.uploaderName || t('knowledge.documentUpload.unknown') })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(duplicateWarning.existingDocument.uploadedAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {duplicateWarning.existingDocument.similarity && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Sparkles className="h-4 w-4" />
                        <span data-testid="text-similarity">
                          {Math.round(duplicateWarning.existingDocument.similarity * 100)}% {t('knowledge.documentUpload.similar')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                {t('knowledge.documentUpload.duplicateUploadConfirm')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpload} data-testid="button-cancel-upload">
              {t('knowledge.documentUpload.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProceedAnyway}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="button-proceed-anyway"
            >
              {t('knowledge.documentUpload.uploadAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Suggestions Card */}
      {showAISuggestions && aiSuggestions && (
        <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-blue-500/5" data-testid="card-ai-suggestions">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t('knowledge.documentUpload.aiSuggestions')}
                <Badge variant="default" className="ml-2 bg-gradient-to-r from-primary to-blue-500">
                  {t('knowledge.documentUpload.poweredByAI')}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissSuggestions}
                data-testid="button-dismiss-suggestions"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              {t('knowledge.documentUpload.aiSuggestionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Suggestion */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t('knowledge.documentUpload.suggestedCategory')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applySuggestedCategory}
                  data-testid="button-apply-category"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {t('knowledge.documentUpload.apply')}
                </Button>
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Badge variant="default" className="text-base px-3 py-1" data-testid="badge-suggested-category">
                  {aiSuggestions.category.suggested}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HexagonLogoFrame px={16} />
                  <span data-testid="text-confidence">
                    {(aiSuggestions.category.confidence * 100).toFixed(0)}% {t('knowledge.documentUpload.confidence')}
                  </span>
                </div>
              </div>

              {/* Alternative categories if available */}
              {aiSuggestions.category.alternatives && aiSuggestions.category.alternatives.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span>{t('knowledge.documentUpload.alternatives')}: </span>
                  {aiSuggestions.category.alternatives.map((alt, idx) => (
                    <span key={alt.category}>
                      {alt.category} ({(alt.confidence * 100).toFixed(0)}%)
                      {idx < aiSuggestions.category.alternatives!.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tags Suggestion */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t('knowledge.documentUpload.suggestedTags')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applySuggestedTags}
                  data-testid="button-apply-tags"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {t('knowledge.documentUpload.applyAll')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-background rounded-lg border">
                {aiSuggestions.tags.slice(0, 10).map((tag) => (
                  <Badge
                    key={tag.tag}
                    variant="secondary"
                    className="gap-1"
                    data-testid={`badge-suggested-tag-${tag.tag}`}
                  >
                    {tag.tag}
                    <span className="text-xs opacity-60">
                      {(tag.score * 100).toFixed(0)}%
                    </span>
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('knowledge.documentUpload.tfidfDesc')}
              </div>
            </div>

            {/* Apply All Button */}
            <div className="pt-2">
              <Button
                onClick={applyAllSuggestions}
                className="w-full bg-gradient-to-r from-primary to-blue-500"
                data-testid="button-apply-all-suggestions"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('knowledge.documentUpload.applyAllSuggestions')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Zone */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('knowledge.documentUpload.uploadDocument')}
          </CardTitle>
          <CardDescription>
            {t('knowledge.documentUpload.uploadDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            data-testid="dropzone-upload"
          >
            <input {...getInputProps()} data-testid="input-file-upload" />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">{t('knowledge.documentUpload.dropFileHere')}</p>
            ) : (
              <>
                <p className="text-base font-medium mb-2">{t('knowledge.documentUpload.dragAndDrop')}</p>
                <p className="text-sm text-muted-foreground mb-3">{t('knowledge.documentUpload.orClickToSelect')}</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <Badge variant="secondary" className="text-xs">PDF</Badge>
                  <Badge variant="secondary" className="text-xs">Word</Badge>
                  <Badge variant="secondary" className="text-xs">Excel</Badge>
                  <Badge variant="secondary" className="text-xs">PowerPoint</Badge>
                  <Badge variant="secondary" className="text-xs">CSV</Badge>
                  <Badge variant="secondary" className="text-xs">Images</Badge>
                  <Badge variant="secondary" className="text-xs">JSON/XML</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('knowledge.documentUpload.anyLanguageSupported')}
                </p>
              </>
            )}
          </div>

          {uploadMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('knowledge.documentUpload.processingDocument')}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} data-testid="progress-upload" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t('knowledge.documentUpload.documentMetadata')}</CardTitle>
          <CardDescription>
            {t('knowledge.documentUpload.documentMetadataDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Folder Classification Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              {t('knowledge.documentUpload.documentClassification')}
            </Label>
            <Select value={selectedClassification} onValueChange={(val) => {
              setSelectedClassification(val);
              setSelectedSubfolder('');
            }}>
              <SelectTrigger data-testid="select-classification">
                <SelectValue placeholder={t('knowledge.documentUpload.selectClassification')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KNOWLEDGE_CLASSIFICATIONS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      {getClassificationIcon(info.icon, "h-4 w-4")}
                      <span>{info.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClassificationData && (
              <p className="text-xs text-muted-foreground">{selectedClassificationData.description}</p>
            )}
          </div>

          {/* Subfolder Selection */}
          {selectedClassificationData && selectedClassificationData.subfolders.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                {t('knowledge.documentUpload.subfolderOptional')}
              </Label>
              <Select value={selectedSubfolder} onValueChange={(v) => setSelectedSubfolder(v === "__root__" ? "" : v)}>
                <SelectTrigger data-testid="select-subfolder">
                  <SelectValue placeholder={t('knowledge.documentUpload.selectSubfolder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">{t('knowledge.documentUpload.noneRoot')}</SelectItem>
                  {selectedClassificationData.subfolders.map((subfolder) => (
                    <SelectItem key={subfolder.slug} value={subfolder.slug}>
                      {subfolder.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show selected folder path */}
          {selectedClassification && (
            <div className="p-2 bg-muted rounded-md">
              <div className="flex items-center gap-1 text-sm">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('knowledge.documentUpload.folderPath')}:</span>
                <span className="font-medium">
                  {selectedSubfolder
                    ? `${selectedClassification}/${selectedSubfolder}`
                    : selectedClassification}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category" className="flex items-center gap-2">
              {t('knowledge.documentUpload.category')}
              {selectedClassification && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('knowledge.documentUpload.filteredBy', { label: selectedClassificationData?.label })}
                </Badge>
              )}
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder={t('knowledge.documentUpload.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex flex-col">
                      <span>{cat.label}</span>
                      <span className="text-xs text-muted-foreground">{cat.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedClassification && (
              <p className="text-xs text-muted-foreground">
                {t('knowledge.documentUpload.selectClassificationFirst')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('knowledge.documentUpload.tags')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('knowledge.documentUpload.addTag')}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                data-testid="input-tag"
              />
              <Button onClick={addTag} variant="outline" data-testid="button-add-tag">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1" data-testid={`badge-tag-${tag}`}>
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover-elevate"
                      onClick={() => removeTag(tag)}
                      data-testid={`button-remove-tag-${tag}`}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessLevel">{t('knowledge.documentUpload.accessLevel')}</Label>
            <Select value={accessLevel} onValueChange={(val: AccessLevel) => setAccessLevel(val)}>
              <SelectTrigger data-testid="select-access-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    {t('knowledge.documentUpload.public')}
                  </div>
                </SelectItem>
                <SelectItem value="internal">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-500" />
                    {t('knowledge.documentUpload.internal')}
                  </div>
                </SelectItem>
                <SelectItem value="restricted">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" />
                    {t('knowledge.documentUpload.restricted')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Governance Visibility
            </Label>
            <Select value={visibilityScope} onValueChange={(val: VisibilityScope) => setVisibilityScope(val)}>
              <SelectTrigger data-testid="select-visibility-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visibility-sector">Sector</Label>
              <Input
                id="visibility-sector"
                placeholder="e.g., Healthcare"
                value={visibilitySector}
                onChange={(e) => setVisibilitySector(e.target.value)}
                data-testid="input-visibility-sector"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility-organization">Organization</Label>
              <Input
                id="visibility-organization"
                placeholder="e.g., Ministry of Health"
                value={visibilityOrganization}
                onChange={(e) => setVisibilityOrganization(e.target.value)}
                data-testid="input-visibility-organization"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="visibility-department">Department</Label>
              <Input
                id="visibility-department"
                placeholder="e.g., Digital Transformation"
                value={visibilityDepartment}
                onChange={(e) => setVisibilityDepartment(e.target.value)}
                data-testid="input-visibility-department"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Bulk Upload Section */}
      <BulkUploadZone />

      {/* Regenerate Embeddings Section */}
      <RegenerateEmbeddingsSection />

      {/* Fix Arabic Encoding Section */}
      <FixEncodingSection />

      {/* Unassigned Documents Section */}
      <UnassignedDocumentsSection />
    </>
  );
}
