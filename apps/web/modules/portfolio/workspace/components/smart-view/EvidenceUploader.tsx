import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, CheckCircle, AlertCircle, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import type { TaskEvidence } from './types';

interface EvidenceUploaderProps {
  taskId: string;
  projectId: string;
  /** Use multi-file endpoint (task_evidence table) instead of legacy single-file */
  multiFile?: boolean;
  onUploadComplete?: (evidence: TaskEvidence) => void;
  onMultiUploadComplete?: (evidence: TaskEvidence[]) => void;
  existingEvidence?: TaskEvidence[];
  compact?: boolean;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export function EvidenceUploader({ 
  taskId, 
  projectId, 
  multiFile = false,
  onUploadComplete,
  onMultiUploadComplete,
  existingEvidence = [],
  compact = false,
}: EvidenceUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { toast } = useToast();
  const { t } = useTranslation();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadingFiles(prev => [...prev, ...newFiles]);

    if (multiFile) {
      // ── Multi-file batch upload (task_evidence table) ──
      const formData = new FormData();
      for (const file of acceptedFiles) {
        formData.append('evidence', file);
      }

      setUploadingFiles(prev => prev.map(f => newFiles.some(nf => nf.file === f.file) ? { ...f, progress: 30 } : f));

      try {
        const response = await fetch(`/api/portfolio/wbs/${taskId}/evidence/multi`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        setUploadingFiles(prev => prev.map(f => newFiles.some(nf => nf.file === f.file) ? { ...f, progress: 70 } : f));

        if (!response.ok) throw new Error('Upload failed');
        const result = await response.json();

        setUploadingFiles(prev => prev.map(f => newFiles.some(nf => nf.file === f.file) ? { ...f, progress: 100, status: 'complete' } : f));

        if (onMultiUploadComplete && result.data?.files) {
          const evidenceList: TaskEvidence[] = result.data.files.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            taskId: row.taskId as string || row.task_id as string,
            fileName: row.fileName as string || row.file_name as string,
            fileType: row.fileType as string || row.file_type as string || '',
            fileSize: row.fileSize as number || row.file_size as number || 0,
            uploadedAt: (row.uploadedAt as string) || (row.uploaded_at as string) || new Date().toISOString(),
            uploadedBy: (row.uploadedBy as string) || (row.uploaded_by as string) || '',
            url: row.fileUrl as string || row.file_url as string,
            verificationStatus: (row.verificationStatus as string) || (row.verification_status as string) || 'pending',
          }));
          onMultiUploadComplete(evidenceList);
        }

        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'wbs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/wbs', taskId, 'evidence'] });

        toast({
          title: t('projectWorkspace.toast.evidenceUploaded'),
          description: `${acceptedFiles.length} file(s) uploaded successfully`,
        });
      } catch (_error) {
        setUploadingFiles(prev => prev.map(f => newFiles.some(nf => nf.file === f.file) ? { ...f, status: 'error', error: 'Upload failed' } : f));
        toast({ title: t('projectWorkspace.toast.uploadFailed'), description: 'Failed to upload evidence files', variant: 'destructive' });
      }
    } else {
      // ── Legacy single-file upload ──
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]!;
      
      try {
        const formData = new FormData();
        formData.append('evidence', file);

        setUploadingFiles(prev => 
          prev.map((f, _idx) => 
            f.file === file ? { ...f, progress: 30 } : f
          )
        );

        const response = await fetch(`/api/portfolio/wbs/${taskId}/evidence`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        setUploadingFiles(prev => 
          prev.map(f => 
            f.file === file ? { ...f, progress: 70 } : f
          )
        );

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();

        setUploadingFiles(prev => 
          prev.map(f => 
            f.file === file ? { ...f, progress: 100, status: 'complete' } : f
          )
        );

        if (onUploadComplete && result.data) {
          const evidenceData: TaskEvidence = {
            id: `${result.data.taskId}-${Date.now()}`,
            taskId: result.data.taskId,
            fileName: result.data.evidenceFileName,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            uploadedAt: result.data.evidenceUploadedAt,
            uploadedBy: result.data.evidenceUploadedBy,
            url: result.data.evidenceUrl,
          };
          onUploadComplete(evidenceData);
        }

        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'wbs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/projects', projectId, 'management-summary'] });

        toast({
          title: t('projectWorkspace.toast.evidenceUploaded'),
          description: t('projectWorkspace.toast.fileUploadedDesc', { fileName: file.name }),
        });

      } catch (_error) {
        setUploadingFiles(prev => 
          prev.map(f => 
            f.file === file ? { ...f, status: 'error', error: 'Upload failed' } : f
          )
        );
        
        toast({
          title: t('projectWorkspace.toast.uploadFailed'),
          description: t('projectWorkspace.toast.fileUploadFailedDesc', { fileName: file.name }),
          variant: 'destructive',
        });
      }
    }
    } // close else (legacy)

    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status !== 'complete'));
    }, 2000);
  }, [taskId, projectId, multiFile, onUploadComplete, onMultiUploadComplete, toast, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer
          ${compact ? 'p-3' : 'p-6'}
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
          }
        `}
        data-testid="evidence-dropzone"
      >
        <input {...getInputProps()} data-testid="evidence-file-input" />
        <div className={`flex items-center gap-3 ${compact ? '' : 'flex-col text-center'}`}>
          <div className={`rounded-xl flex items-center justify-center transition-colors ${compact ? 'w-8 h-8' : 'w-12 h-12'} ${
            isDragActive ? 'bg-primary/20' : 'bg-muted'
          }`}>
            <Upload className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className={compact ? 'flex-1 min-w-0' : ''}>
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium`}>
              {isDragActive ? 'Drop files here' : compact ? 'Upload evidence documents' : 'Drag & drop evidence files'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              PDF, Word, Excel, Images up to 10MB
            </p>
          </div>
          {!compact && (
            <Button size="sm" variant="outline" type="button">
              Browse Files
            </Button>
          )}
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((uploadFile, index) => (
            <div 
              key={`${uploadFile.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                {uploadFile.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
                {uploadFile.status === 'complete' && (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                )}
                {uploadFile.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                {uploadFile.status === 'uploading' && (
                  <Progress value={uploadFile.progress} className="h-1 mt-1" />
                )}
                {uploadFile.status === 'error' && (
                  <p className="text-xs text-red-500">{uploadFile.error}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => removeFile(uploadFile.file)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {existingEvidence.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Uploaded Evidence ({existingEvidence.length})
          </h4>
          {existingEvidence.map((evidence) => (
            <div 
              key={evidence.id}
              className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg"
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                evidence.verificationStatus === 'approved' ? 'bg-emerald-500/10' :
                evidence.verificationStatus === 'rejected' ? 'bg-red-500/10' :
                'bg-amber-500/10'
              }`}>
                {evidence.verificationStatus === 'approved' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ) : evidence.verificationStatus === 'rejected' ? (
                  <XCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{evidence.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {new Date(evidence.uploadedAt).toLocaleDateString()}
                  </p>
                  {evidence.verificationStatus === 'approved' ? (
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Approved</Badge>
                  ) : evidence.verificationStatus === 'rejected' ? (
                    <Badge variant="outline" className="text-[9px] border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">Rejected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Pending</Badge>
                  )}
                </div>
              </div>
              {evidence.aiAnalysis && (
                <div className={`px-2 py-1 rounded-full text-[10px] font-medium ${
                  evidence.aiAnalysis.overallScore >= 80 
                    ? 'bg-emerald-500/10 text-emerald-500' 
                    : evidence.aiAnalysis.overallScore >= 60
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  AI Score: {evidence.aiAnalysis.overallScore}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
