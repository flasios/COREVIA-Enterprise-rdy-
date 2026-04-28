import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Upload, FileText, FileCode, FileSpreadsheet,
  X, Loader2, Image, FolderOpen,
} from "lucide-react";
import { validateFile } from "./knowledgeCentre.validation";
import type {
  AccessLevel,
  BulkUploadResult,
  FileWithPath,
  VisibilityScope,
} from "./knowledgeCentre.types";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BulkUploadFile {
  id: string;
  file: File;
  folderPath?: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate';
  progress: number;
  error?: string;
  classification?: {
    category: string;
    tags: string[];
    language: string;
    documentType: string;
  };
}

// ============================================================================
// BULK UPLOAD ZONE COMPONENT
// ============================================================================

export function BulkUploadZone() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [files, setFiles] = useState<BulkUploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [autoClassify, setAutoClassify] = useState(true);
  const [defaultAccessLevel, setDefaultAccessLevel] = useState<'public' | 'internal' | 'restricted'>('internal');
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('organization');
  const [visibilitySector, setVisibilitySector] = useState('');
  const [visibilityOrganization, setVisibilityOrganization] = useState('');
  const [visibilityDepartment, setVisibilityDepartment] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validatedFiles: BulkUploadFile[] = [];
    const invalidFiles: string[] = [];
    
    for (const file of acceptedFiles) {
      const validation = validateFile(file);
      if (validation.valid) {
        validatedFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          status: 'pending' as const,
          progress: 0,
        });
      } else {
        invalidFiles.push(`${file.name}: ${validation.error}`);
      }
    }
    
    if (invalidFiles.length > 0) {
      toast({
        variant: "destructive",
        title: t('knowledge.bulkUpload.filesSkipped', { count: invalidFiles.length }),
        description: invalidFiles.slice(0, 3).join(', ') + (invalidFiles.length > 3 ? `... ${t('knowledge.bulkUpload.andMore', { count: invalidFiles.length - 3 })}` : ''),
      });
    }
    
    setFiles(prev => [...prev, ...validatedFiles]);
  }, [toast, t]);
  
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const MAX_FILES = 100;
    const MAX_DEPTH = 10;
    
    if (selectedFiles.length > MAX_FILES) {
      toast({
        variant: "destructive",
        title: t('knowledge.bulkUpload.tooManyFiles'),
        description: t('knowledge.bulkUpload.tooManyFilesDesc', { count: selectedFiles.length, max: MAX_FILES }),
      });
      return;
    }
    
    const newFiles: BulkUploadFile[] = [];
    const skippedFiles: string[] = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i] as FileWithPath;
      const relativePath = file.webkitRelativePath || file.name;
      
      const pathParts = relativePath.split('/');
      if (pathParts.length > MAX_DEPTH + 1) {
        skippedFiles.push(file.name);
        continue;
      }
      
      const folderPath = pathParts.slice(0, -1).join('/');
      
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf', 'xlsx', 'csv', 'pptx', 'ppt', 'json', 'xml', 'html', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif', 'webp'];
      
      if (!ext || !allowedExts.includes(ext)) {
        skippedFiles.push(file.name);
        continue;
      }
      
      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        folderPath: folderPath || undefined,
        status: 'pending',
        progress: 0,
      });
    }
    
    if (skippedFiles.length > 0) {
      toast({
        title: t('knowledge.bulkUpload.someFilesSkipped'),
        description: t('knowledge.bulkUpload.someFilesSkippedDesc', { count: skippedFiles.length }),
      });
    }
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
      toast({
        title: t('knowledge.bulkUpload.folderLoaded'),
        description: t('knowledge.bulkUpload.folderLoadedDesc', { count: newFiles.length }),
      });
    }
    
    if (e.target) {
      e.target.value = '';
    }
  }, [toast, t]);
  
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
    maxSize: 100 * 1024 * 1024,
    multiple: true,
    maxFiles: 20,
  });
  
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success' && f.status !== 'duplicate'));
  };
  
  const uploadFiles = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      setIsUploading(false);
      return;
    }
    
    // Update all pending files to uploading
    setFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading' as const, progress: 10 } : f
    ));
    
    const formData = new FormData();
    pendingFiles.forEach(f => formData.append('files', f.file));
    formData.append('autoClassify', autoClassify.toString());
    formData.append('defaultAccessLevel', defaultAccessLevel);
    formData.append('visibilityScope', visibilityScope);
    if (visibilitySector.trim()) formData.append('sector', visibilitySector.trim());
    if (visibilityOrganization.trim()) formData.append('organization', visibilityOrganization.trim());
    if (visibilityDepartment.trim()) formData.append('department', visibilityDepartment.trim());
    
    // Build folder paths map (filename -> folderPath)
    const folderPathsMap: Record<string, string> = {};
    pendingFiles.forEach(f => {
      if (f.folderPath) {
        folderPathsMap[f.file.name] = f.folderPath;
      }
    });
    if (Object.keys(folderPathsMap).length > 0) {
      formData.append('folderPaths', JSON.stringify(folderPathsMap));
    }
    
    try {
      const res = await fetch('/api/knowledge/upload/bulk', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Bulk upload failed');
      }
      
      const data = await res.json();
      
      if (data.success && data.data.results) {
        setFiles(prev => prev.map(f => {
          const result = (data.data.results as BulkUploadResult[]).find((r: BulkUploadResult) => r.filename === f.file.name);
          if (result) {
            return {
              ...f,
              status: result.status,
              progress: 100,
              error: result.error,
              classification: result.classification,
            };
          }
          return f;
        }));
        
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
        
        toast({
          title: t('knowledge.bulkUpload.uploadComplete'),
          description: t('knowledge.bulkUpload.uploadCompleteDesc', { success: data.data.successCount, duplicates: data.data.duplicateCount, errors: data.data.errorCount }),
        });
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'error' as const, error: 'Upload failed' } : f
      ));
      
      toast({
        variant: "destructive",
        title: t('knowledge.bulkUpload.uploadFailed'),
        description: error instanceof Error ? error.message : t('knowledge.bulkUpload.errorOccurred'),
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
      case 'doc':
      case 'docx': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'xlsx':
      case 'csv': return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
      case 'ppt':
      case 'pptx': return <FileText className="h-4 w-4 text-orange-500" />;
      case 'json':
      case 'xml':
      case 'html': return <FileCode className="h-4 w-4 text-violet-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp': return <Image className="h-4 w-4 text-pink-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getStatusBadge = (status: BulkUploadFile['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">{t('knowledge.bulkUpload.pending')}</Badge>;
      case 'uploading': return <Badge variant="default" className="bg-blue-500">{t('knowledge.bulkUpload.uploading')}</Badge>;
      case 'success': return <Badge variant="default" className="bg-emerald-500">{t('knowledge.bulkUpload.success')}</Badge>;
      case 'duplicate': return <Badge variant="outline" className="border-amber-500 text-amber-500">{t('knowledge.bulkUpload.duplicate')}</Badge>;
      case 'error': return <Badge variant="destructive">{t('knowledge.bulkUpload.error')}</Badge>;
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('knowledge.bulkUpload.title')}
          <Badge variant="secondary">{t('knowledge.bulkUpload.upTo100')}</Badge>
        </CardTitle>
        <CardDescription>
          {t('knowledge.bulkUpload.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File Upload Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            data-testid="dropzone-bulk-upload"
          >
            <input {...getInputProps()} data-testid="input-bulk-file-upload" />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-base font-medium">{t('knowledge.bulkUpload.dropFiles')}</p>
            ) : (
              <>
                <p className="text-sm font-medium mb-1">{t('knowledge.bulkUpload.dropOrClick')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('knowledge.bulkUpload.upTo100Individual')}
                </p>
              </>
            )}
          </div>
          
          {/* Folder Upload */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-border hover:border-primary/50"
            onClick={() => {
              if (folderInputRef.current) {
                folderInputRef.current.value = '';
                folderInputRef.current.click();
              }
            }}
            data-testid="dropzone-folder-upload"
          >
            <input
              ref={(input) => {
                (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = input;
                if (input) {
                  input.setAttribute('webkitdirectory', '');
                  input.setAttribute('directory', '');
                  input.setAttribute('mozdirectory', '');
                }
              }}
              type="file"
              className="hidden"
              onChange={handleFolderSelect}
              multiple
              data-testid="input-folder-upload"
            />
            <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">{t('knowledge.bulkUpload.clickToSelectFolder')}</p>
            <p className="text-xs text-muted-foreground">
              {t('knowledge.bulkUpload.uploadEntireFolder')}
            </p>
          </div>
        </div>
        
        {/* Options */}
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoClassify}
              onCheckedChange={setAutoClassify}
              data-testid="switch-auto-classify"
            />
            <Label className="text-sm">{t('knowledge.bulkUpload.autoClassify')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">{t('knowledge.bulkUpload.access')}:</Label>
            <Select value={defaultAccessLevel} onValueChange={(val: AccessLevel) => setDefaultAccessLevel(val)}>
              <SelectTrigger className="w-32 h-8" data-testid="select-bulk-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t('knowledge.bulkUpload.public')}</SelectItem>
                <SelectItem value="internal">{t('knowledge.bulkUpload.internal')}</SelectItem>
                <SelectItem value="restricted">{t('knowledge.bulkUpload.restricted')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg">
          <div className="space-y-2">
            <Label className="text-sm">Governance Scope</Label>
            <Select value={visibilityScope} onValueChange={(val: VisibilityScope) => setVisibilityScope(val)}>
              <SelectTrigger className="h-8" data-testid="select-bulk-visibility-scope">
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
          <div className="space-y-2">
            <Label className="text-sm">Sector</Label>
            <input
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={visibilitySector}
              onChange={(e) => setVisibilitySector(e.target.value)}
              placeholder="e.g., Education"
              data-testid="input-bulk-visibility-sector"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Organization</Label>
            <input
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={visibilityOrganization}
              onChange={(e) => setVisibilityOrganization(e.target.value)}
              placeholder="e.g., Ministry"
              data-testid="input-bulk-visibility-organization"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Department</Label>
            <input
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={visibilityDepartment}
              onChange={(e) => setVisibilityDepartment(e.target.value)}
              placeholder="e.g., IT"
              data-testid="input-bulk-visibility-department"
            />
          </div>
        </div>
        
        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('knowledge.bulkUpload.filesSelected', { count: files.length })}</Label>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearCompleted}
                  disabled={isUploading}
                  data-testid="button-clear-completed"
                >
                  {t('knowledge.bulkUpload.clearCompleted')}
                </Button>
                <Button 
                  onClick={uploadFiles} 
                  disabled={isUploading || files.filter(f => f.status === 'pending').length === 0}
                  size="sm"
                  data-testid="button-upload-all"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('knowledge.bulkUpload.uploadingEllipsis')}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {t('knowledge.bulkUpload.uploadAll')}
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {files.map(f => (
                  <div 
                    key={f.id} 
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                    data-testid={`bulk-file-${f.id}`}
                  >
                    {getFileIcon(f.file.name)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{f.file.name}</span>
                        <span className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</span>
                      </div>
                      {f.folderPath && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <FolderOpen className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{f.folderPath}</span>
                        </div>
                      )}
                      {f.status === 'uploading' && (
                        <Progress value={f.progress} className="h-1 mt-1" />
                      )}
                      {f.classification && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">{f.classification.category}</Badge>
                          <Badge variant="outline" className="text-xs">{f.classification.language}</Badge>
                          <Badge variant="outline" className="text-xs">{f.classification.documentType}</Badge>
                        </div>
                      )}
                      {f.error && (
                        <p className="text-xs text-destructive mt-1">{f.error}</p>
                      )}
                    </div>
                    {getStatusBadge(f.status)}
                    {f.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFile(f.id)}
                        className="h-6 w-6"
                        data-testid={`button-remove-${f.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
