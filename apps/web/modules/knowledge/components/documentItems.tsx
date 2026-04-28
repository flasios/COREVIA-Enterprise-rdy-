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
import { formatFileSize } from "../hooks/knowledgeCentreUtils";
import type { DocumentWithUploader } from "../types/knowledgeCentre";
import {
  formatOCRTooltip,
  formatQualityBreakdown,
  getAccessLevelBadge,
  getFileIcon,
  getOCRBadge,
  getQualityBadge,
} from "./display";

interface DocumentItemProps {
  document: DocumentWithUploader;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: (docId: string, e: MouseEvent) => void;
}

export function DocumentCard({
  document,
  onClick,
  isSelected,
  onToggleSelect,
}: DocumentItemProps) {
  return (
    <Card
      className={`hover-elevate cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
      data-testid={`card-document-${document.id}`}
    >
      <CardHeader className="space-y-3">
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
              <h3 className="font-semibold text-sm line-clamp-2" data-testid="text-document-filename">
                {document.filename}
              </h3>
            </div>
          </div>
          {getAccessLevelBadge(document.accessLevel)}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {document.folderPath && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className="gap-1 w-fit" data-testid="badge-folder">
                    <Folder className="h-3 w-3" />
                    {(() => {
                      const parts = document.folderPath.split("/");
                      const classification = parts[0] as KnowledgeClassification;
                      const classLabel = KNOWLEDGE_CLASSIFICATIONS[classification]?.label || parts[0];
                      if (parts.length > 1) {
                        return `${classLabel} › ${parts.slice(1).join(" › ")}`;
                      }
                      return classLabel;
                    })()}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Folder: {document.folderPath}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {document.category && (
            <Badge variant="outline" className="w-fit" data-testid="badge-category">
              {DOCUMENT_CATEGORIES[document.category as DocumentCategory]?.label || document.category}
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

      <CardContent className="space-y-3">
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
          <span className="text-muted-foreground">{formatFileSize(document.fileSize)}</span>
          {document.processingStatus === "completed" && (
            <Badge variant="secondary" className="text-xs">
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
  return (
    <Card
      className={`hover-elevate cursor-pointer transition-all p-4 ${isSelected ? "ring-2 ring-primary" : ""}`}
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
          <h3 className="font-semibold text-sm mb-1" data-testid="text-document-filename">
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
                  <Badge variant="secondary" className="gap-1" data-testid="badge-folder">
                    <Folder className="h-3 w-3" />
                    {(() => {
                      const parts = document.folderPath.split("/");
                      const classification = parts[0] as KnowledgeClassification;
                      const classLabel = KNOWLEDGE_CLASSIFICATIONS[classification]?.label || parts[0];
                      if (parts.length > 1) {
                        return `${classLabel} › ${parts.slice(1).join(" › ")}`;
                      }
                      return classLabel;
                    })()}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Folder: {document.folderPath}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {document.category && (
            <Badge variant="outline" data-testid="badge-category">
              {DOCUMENT_CATEGORIES[document.category as DocumentCategory]?.label || document.category}
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
