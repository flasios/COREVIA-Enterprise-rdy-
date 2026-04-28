import { formatFileSize } from "./knowledgeCentreUtils";

const ALLOWED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/rtf": [".rtf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/json": [".json"],
  "application/xml": [".xml"],
  "text/xml": [".xml"],
  "text/html": [".html"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff"],
  "image/bmp": [".bmp"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
} as const;

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export function validateFile(
  file: File,
  maxSize: number = MAX_FILE_SIZE,
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds limit (${formatFileSize(maxSize)})`,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES).flat() as readonly string[];

  if (!extension || !allowedExtensions.includes(`.${extension}`)) {
    return {
      valid: false,
      error: `File type .${extension || "unknown"} is not supported`,
    };
  }

  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, "_")
    .replace(/\0/g, "")
    .replace(/[\x00-\x1f\x80-\x9f]/g, "")
    .replace(/[^a-zA-Z0-9._\-\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "_")
    .substring(0, 255);
}

export function sanitizeFolderPath(folderPath: string): string | null {
  let sanitized = folderPath.trim().replace(/^\/+|\/+$/g, "");

  if (sanitized.includes("..")) {
    return null;
  }

  sanitized = sanitized.replace(/[^a-zA-Z0-9/_\-\u0600-\u06FF\u0750-\u077F]/g, "_");

  const segments = sanitized.split("/").filter((s) => s.length > 0);

  if (segments.length === 0) {
    return null;
  }

  return segments.join("/");
}
