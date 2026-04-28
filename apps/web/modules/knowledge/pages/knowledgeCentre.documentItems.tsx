import type { MouseEvent } from "react";
import { format } from "date-fns";
import {
  Calendar,
  FileCheck,
  Folder,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DOCUMENT_CATEGORIES,
  KNOWLEDGE_CLASSIFICATIONS,
  type DocumentCategory,
  type KnowledgeClassification,
} from "@shared/schema";
import { formatFileSize } from "./knowledgeCentre.utils";
import type { DocumentWithUploader } from "./knowledgeCentre.types";
import {
  formatOCRTooltip,
  formatQualityBreakdown,
  getAccessLevelBadge,
  getFileIcon,
  getOCRBadge,
  getQualityBadge,
} from "./knowledgeCentre.display";

interface DocumentItemProps {
  document: DocumentWithUploader;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: (docId: string, e: MouseEvent) => void;
}

function getDisplayFolderPath(folderPath: string): string {
  const parts = folderPath.split("/");
  const classification = parts[0] as KnowledgeClassification;
  const classLabel = KNOWLEDGE_CLASSIFICATIONS[classification]?.label || parts[0];
  if (parts.length > 1) {
    return `${classLabel} › ${parts.slice(1).join(" › ")}`;
  }
  return classLabel;
}

export function DocumentCard({
  document,
  onClick,
  isSelected,
  onToggleSelect,
}: DocumentItemProps) {
  const visibility = ((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined) || {};
  const visibilityScope = (visibility.scope as string) || "organization";
  const visibilityContext = [visibility.sector, visibility.organization, visibility.department].filter(Boolean).join(" / ");

  return (
    <Card
      className={`group cursor-pointer transition-all border-border/60 bg-card/95 shadow-sm hover:shadow-md hover:border-border ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
      data-testid={`card-document-${document.id}`}
    >
      <CardHeader className="space-y-3 pb-3 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onClick={(e) => onToggleSelect(document.id, e)}
                className="shrink-0"
                data-testid={`checkbox-document-${document.id}`}
              />
            )}
            {getFileIcon(document.fileType)}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors" data-testid="text-document-filename">
                {document.filename}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wide">{document.fileType}</p>
            </div>
          </div>
          {getAccessLevelBadge(document.accessLevel)}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {document.folderPath && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className="gap-1 w-fit bg-muted/60 border border-border/50" data-testid="badge-folder">
                    <Folder className="h-3 w-3" />
                    {getDisplayFolderPath(document.folderPath)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Folder: {document.folderPath}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {document.category && (
            <Badge variant="outline" className="w-fit border-border/60" data-testid="badge-category">
              {DOCUMENT_CATEGORIES[document.category as DocumentCategory]?.label || document.category}
            </Badge>
          )}

          <Badge variant="outline" className="w-fit capitalize border-border/60" data-testid="badge-visibility-scope">
            {visibilityScope}
          </Badge>

          {visibilityContext && (
            <Badge variant="secondary" className="w-fit bg-muted/60 border border-border/50" data-testid="badge-visibility-context">
              {visibilityContext}
            </Badge>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <div className="w-fit" data-testid="badge-quality">
                  {getQualityBadge(document.qualityScore)}
                </div>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line">
                <p className="font-semibold mb-2">Quality Score: {document.qualityScore || 0}/100</p>
                <p className="text-xs">{formatQualityBreakdown(document.metadata)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {getOCRBadge(document.metadata) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <div className="w-fit" data-testid="badge-ocr">
                    {getOCRBadge(document.metadata)}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre-line">
                  <p className="text-xs">{formatOCRTooltip(document.metadata)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span data-testid="text-upload-date">{format(new Date(document.uploadedAt), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span data-testid="text-uploader-name">{document.uploaderName}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">{formatFileSize(document.fileSize)}</span>
          {document.processingStatus === "completed" && (
            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <FileCheck className="h-3 w-3 mr-1" />
              {document.chunkCount} chunks
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DocumentListItem({
  document,
  onClick,
  isSelected,
  onToggleSelect,
}: DocumentItemProps) {
  const visibility = ((document.metadata as Record<string, unknown> | undefined)?.visibility as Record<string, unknown> | undefined) || {};
  const visibilityScope = (visibility.scope as string) || "organization";
  const visibilityContext = [visibility.sector, visibility.organization, visibility.department].filter(Boolean).join(" / ");

  return (
    <Card
      className={`group cursor-pointer transition-all p-4 border-border/60 bg-card/95 shadow-sm hover:shadow-md hover:border-border ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
      data-testid={`list-document-${document.id}`}
    >
      <div className="flex items-center gap-4">
        {onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onClick={(e) => onToggleSelect(document.id, e)}
            className="shrink-0"
            data-testid={`checkbox-list-document-${document.id}`}
          />
        )}
        <div className="flex-shrink-0">{getFileIcon(document.fileType)}</div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors" data-testid="text-document-filename">
            {document.filename}
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatFileSize(document.fileSize)}</span>
            <span>•</span>
            <span>{format(new Date(document.uploadedAt), "MMM d, yyyy")}</span>
            <span>•</span>
            <span>{document.uploaderName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {document.folderPath && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className="gap-1 bg-muted/60 border border-border/50" data-testid="badge-folder">
                    <Folder className="h-3 w-3" />
                    {getDisplayFolderPath(document.folderPath)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Folder: {document.folderPath}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {document.category && (
            <Badge variant="outline" className="border-border/60" data-testid="badge-category">
              {DOCUMENT_CATEGORIES[document.category as DocumentCategory]?.label || document.category}
            </Badge>
          )}

          <Badge variant="outline" className="capitalize border-border/60" data-testid="badge-visibility-scope">
            {visibilityScope}
          </Badge>

          {visibilityContext && (
            <Badge variant="secondary" className="bg-muted/60 border border-border/50" data-testid="badge-visibility-context">
              {visibilityContext}
            </Badge>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                <div className="w-fit" data-testid="badge-quality">
                  {getQualityBadge(document.qualityScore)}
                </div>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line">
                <p className="font-semibold mb-2">Quality Score: {document.qualityScore || 0}/100</p>
                <p className="text-xs">{formatQualityBreakdown(document.metadata)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {getOCRBadge(document.metadata) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <div className="w-fit" data-testid="badge-ocr">
                    {getOCRBadge(document.metadata)}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre-line">
                  <p className="text-xs">{formatOCRTooltip(document.metadata)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {getAccessLevelBadge(document.accessLevel)}
        </div>
      </div>
    </Card>
  );
}
