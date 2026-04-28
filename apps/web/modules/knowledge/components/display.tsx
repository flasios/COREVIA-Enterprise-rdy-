import { Badge } from "@/components/ui/badge";
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  Globe,
  GraduationCap,
  Landmark,
  Library,
  ListChecks,
  Lock,
  Scroll,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import type { DocumentMetadata } from "../types/knowledgeCentre";

export function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();
  if (type === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (type === "docx" || type === "doc") return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
  if (type === "txt" || type === "md") return <FileCode className="h-5 w-5 text-green-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function getAccessLevelBadge(level: string) {
  if (level === "public") return <Badge variant="default" className="bg-emerald-500"><Globe className="h-3 w-3 mr-1" />Public</Badge>;
  if (level === "internal") return <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" />Internal</Badge>;
  if (level === "restricted") return <Badge variant="destructive"><Shield className="h-3 w-3 mr-1" />Restricted</Badge>;
  return <Badge variant="outline">{level}</Badge>;
}

export function getQualityBadge(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return <Badge variant="outline" className="gap-1"><FileCheck className="h-3 w-3" />Not Rated</Badge>;
  }

  if (score >= 80) {
    return <Badge variant="default" className="bg-emerald-600 gap-1"><Award className="h-3 w-3" />Excellent</Badge>;
  } else if (score >= 60) {
    return <Badge variant="default" className="bg-blue-600 gap-1"><Star className="h-3 w-3" />Good</Badge>;
  } else if (score >= 40) {
    return <Badge variant="outline" className="border-yellow-600 text-yellow-700 dark:text-yellow-400 gap-1"><FileCheck className="h-3 w-3" />Fair</Badge>;
  } else {
    return <Badge variant="destructive" className="gap-1"><FileCheck className="h-3 w-3" />Poor</Badge>;
  }
}

export function formatQualityBreakdown(metadata: unknown): string {
  const typedMetadata = metadata as DocumentMetadata | null | undefined;
  const breakdown = typedMetadata?.qualityBreakdown;
  if (!breakdown) return "Quality breakdown not available";

  return `Completeness: ${breakdown.completeness || 0}/30\nCitations: ${breakdown.citations || 0}/25\nFreshness: ${breakdown.freshness || 0}/20\nUsage: ${breakdown.usage || 0}/15\nMetadata: ${breakdown.metadata || 0}/10\n\nTotal: ${breakdown.total || 0}/100`;
}

export function getOCRBadge(metadata: unknown) {
  const typedMetadata = metadata as DocumentMetadata | null | undefined;
  const ocrData = typedMetadata?.ocr;

  if (!ocrData || !ocrData.wasProcessed) {
    return null;
  }

  let badgeClass = "bg-blue-600";
  if (ocrData.confidence && ocrData.confidence >= 80) {
    badgeClass = "bg-emerald-600";
  } else if (ocrData.confidence && ocrData.confidence < 60) {
    badgeClass = "bg-yellow-600";
  }

  return (
    <Badge variant="default" className={`gap-1 ${badgeClass}`}>
      <Sparkles className="h-3 w-3" />
      OCR: {ocrData.language || "Unknown"}
    </Badge>
  );
}

export function formatOCRTooltip(metadata: unknown): string {
  const typedMetadata = metadata as DocumentMetadata | null | undefined;
  const ocrData = typedMetadata?.ocr;
  if (!ocrData || !ocrData.wasProcessed) {
    return "Not processed with OCR";
  }

  return `OCR Processing Details:\n\nLanguage: ${ocrData.language || "Unknown"}\nConfidence: ${ocrData.confidence?.toFixed(2) || 0}%\nProcessing Time: ${ocrData.ocrProcessingTime || 0}ms\n\nThis document was processed using Optical Character Recognition (OCR) to extract text from the image.`;
}

export function getClassificationIcon(iconName: string, className: string = "h-4 w-4") {
  const icons: Record<string, JSX.Element> = {
    scroll: <Scroll className={className} />,
    "list-checks": <ListChecks className={className} />,
    compass: <Compass className={className} />,
    "shield-check": <ShieldCheck className={className} />,
    "file-text": <FileText className={className} />,
    "book-open": <BookOpen className={className} />,
    "bar-chart-3": <BarChart3 className={className} />,
    library: <Library className={className} />,
    "graduation-cap": <GraduationCap className={className} />,
    landmark: <Landmark className={className} />,
  };
  return icons[iconName] || <Folder className={className} />;
}
