import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, Trash2, Download, ChevronDown, ChevronRight,
  FileSpreadsheet, FileImage, FileCode, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EaDocument {
  id: string;
  registryType: string;
  registryEntryId: string | null;
  templateType: string | null;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  category: string | null;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  accepts: string;
}

interface DocumentPanelProps {
  registryType: string;
  entryId?: string;
  entryName?: string;
  collapsed?: boolean;
}

const fileIcon = (mime: string | null, name: string) => {
  if (mime?.includes("pdf") || name.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (mime?.includes("spreadsheet") || mime?.includes("excel") || name.endsWith(".xlsx") || name.endsWith(".csv")) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  if (mime?.includes("image") || name.endsWith(".png") || name.endsWith(".jpg")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".xml")) return <FileCode className="h-4 w-4 text-amber-500" />;
  return <File className="h-4 w-4 text-slate-500" />;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function DocumentPanel({ registryType, entryId, entryName, collapsed: initialCollapsed = true }: DocumentPanelProps) {
  const [isOpen, setIsOpen] = useState(!initialCollapsed);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("other");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const docsKey = entryId
    ? [`/api/ea/registry/documents/${registryType}`, entryId]
    : [`/api/ea/registry/documents/${registryType}`];

  const { data: docsData } = useQuery({
    queryKey: docsKey,
    queryFn: async () => {
      const url = entryId
        ? `/api/ea/registry/documents/${registryType}?entryId=${entryId}`
        : `/api/ea/registry/documents/${registryType}`;
      const r = await apiRequest("GET", url);
      return r.json();
    },
  });

  const { data: templatesData } = useQuery({
    queryKey: ["/api/ea/registry/documents/templates"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/ea/registry/documents/templates");
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      if (entryId) fd.append("entryId", entryId);
      fd.append("templateType", selectedTemplate);
      fd.append("category", selectedTemplate === "other" ? "other" : "template");
      if (description) fd.append("description", description);

      const r = await fetch(`/api/ea/registry/documents/${registryType}/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKey });
      toast({ title: "Document uploaded" });
      setDescription("");
      setSelectedTemplate("other");
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/ea/registry/documents/remove/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKey });
      toast({ title: "Document removed" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const docs: EaDocument[] = docsData?.data ?? [];
  const typeKey = registryType.replace(/-/g, "_") as keyof typeof templates;
  const templates: Record<string, DocumentTemplate[]> = templatesData?.templates ?? {};
  const availableTemplates: DocumentTemplate[] = templates[typeKey] ?? [];

  const handleFileSelect = () => {
    const file = fileRef.current?.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  return (
    <div className="border border-slate-200/60 dark:border-slate-700/60 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FileText className="h-3.5 w-3.5" />
        <span>Documents{entryName ? ` — ${entryName}` : ""}</span>
        {docs.length > 0 && (
          <Badge variant="secondary" className="text-[10px] ml-auto h-4 px-1.5">{docs.length}</Badge>
        )}
      </button>

      {isOpen && (
        <div className="p-3 space-y-3 bg-white/50 dark:bg-slate-900/50">
          {/* Upload area */}
          <div className="flex items-end gap-2">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">General Document</SelectItem>
                    {availableTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground">Description (optional)</Label>
                <Input
                  className="h-8 text-xs"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
            </div>
            <div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                <Upload className="h-3 w-3" />
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          {/* Docs list */}
          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No documents uploaded yet</p>
          ) : (
            <div className="space-y-1">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-xs">
                  {fileIcon(doc.mimeType, doc.fileName)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(doc.fileSize)}
                      {doc.templateType && doc.templateType !== "other" && ` — ${doc.templateType.replace(/_/g, " ")}`}
                      {doc.description && ` — ${doc.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-6 w-6">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-red-500 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
