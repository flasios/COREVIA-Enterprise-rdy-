import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  FileText, Grid3x3, List, Trash2,
  Filter, SortAsc, BookOpen, BarChart3,
  Award, CalendarIcon, ChevronRight, FolderOpen, Folder, FolderTree, Home,
  FolderInput, Globe, User, X, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { getClassificationIcon } from "./knowledgeCentre.display";
import { DocumentCard, DocumentListItem } from "./knowledgeCentre.documentItems";
import type {
  DocumentWithUploader,
  FilterState,
  VisibilityScope,
} from "./knowledgeCentre.types";
import {
  KNOWLEDGE_CLASSIFICATIONS,
  KNOWLEDGE_CLASSIFICATION_LIST,
  type KnowledgeClassification,
} from "@shared/schema";

interface DocumentLibraryProps {
  documents: DocumentWithUploader[];
  allDocuments: DocumentWithUploader[];
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterAccessLevel: string;
  setFilterAccessLevel: (level: string) => void;
  filterFileType: string;
  setFilterFileType: (type: string) => void;
  filterVisibilityScope: 'all' | VisibilityScope;
  setFilterVisibilityScope: (scope: 'all' | VisibilityScope) => void;
  filterSector: string;
  setFilterSector: (sector: string) => void;
  filterOrganization: string;
  setFilterOrganization: (organization: string) => void;
  filterDepartment: string;
  setFilterDepartment: (department: string) => void;
  categories: string[];
  sectors: string[];
  organizations: string[];
  departments: string[];
  uploaders: Array<{ id: string; name: string }>;
  advancedFilters: FilterState;
  setAdvancedFilters: (filters: FilterState) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  onDocumentClick: (doc: DocumentWithUploader) => void;
  currentFolder: string | null;
  setCurrentFolder: (folder: string | null) => void;
  folderCounts: Record<string, number>;
}

export function DocumentLibrary({
  documents,
  allDocuments,
  isLoading,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  filterCategory,
  setFilterCategory,
  filterAccessLevel,
  setFilterAccessLevel,
  filterFileType,
  setFilterFileType,
  filterVisibilityScope,
  setFilterVisibilityScope,
  filterSector,
  setFilterSector,
  filterOrganization,
  setFilterOrganization,
  filterDepartment,
  setFilterDepartment,
  categories,
  sectors,
  organizations,
  departments,
  uploaders,
  advancedFilters,
  setAdvancedFilters,
  clearAllFilters,
  activeFilterCount,
  onDocumentClick,
  currentFolder,
  setCurrentFolder,
  folderCounts,
}: DocumentLibraryProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<string>('');
  
  // Toggle document selection
  const toggleDocumentSelection = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocuments(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };
  
  // Select/deselect all visible documents
  const toggleSelectAll = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map(d => d.id)));
    }
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };
  
  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const res = await fetch('/api/knowledge/documents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentIds }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete documents');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
      toast({
        title: t('knowledge.documentLibrary.documentsDeleted'),
        description: t('knowledge.documentLibrary.deletedCount', { count: data.data?.deletedCount || selectedDocuments.size }),
      });
      clearSelection();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t('knowledge.documentLibrary.deleteFailed'),
        description: error.message,
      });
    },
  });
  
  // Bulk move mutation
  const bulkMoveMutation = useMutation({
    mutationFn: async ({ documentIds, folderPath }: { documentIds: string[]; folderPath: string }) => {
      const res = await fetch('/api/knowledge/documents/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ documentIds, folderPath }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to move documents');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
      toast({
        title: t('knowledge.documentLibrary.documentsMoved'),
        description: t('knowledge.documentLibrary.movedCount', { count: data.data?.movedCount || selectedDocuments.size }),
      });
      clearSelection();
      setBulkMoveDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t('knowledge.documentLibrary.moveFailed'),
        description: error.message,
      });
    },
  });
  
  // Handle bulk delete
  const handleBulkDelete = () => {
    if (selectedDocuments.size === 0) return;
    if (confirm(t('knowledge.documentLibrary.confirmBulkDelete', { count: selectedDocuments.size }))) {
      bulkDeleteMutation.mutate(Array.from(selectedDocuments));
    }
  };
  
  // Handle bulk move
  const handleBulkMove = () => {
    if (selectedDocuments.size === 0 || !targetFolder) return;
    bulkMoveMutation.mutate({
      documentIds: Array.from(selectedDocuments),
      folderPath: targetFolder,
    });
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Get breadcrumb parts from current folder
  const breadcrumbParts = useMemo(() => {
    if (!currentFolder) return [];
    if (currentFolder === '_uncategorized') {
      return [{ label: 'Uncategorized', path: '_uncategorized' }];
    }
    return currentFolder.split('/').map((part, index, arr) => ({
      label: index === 0 ? KNOWLEDGE_CLASSIFICATIONS[part as KnowledgeClassification]?.label || part : part,
      path: arr.slice(0, index + 1).join('/')
    }));
  }, [currentFolder]);

  const currentScopeLabel = useMemo(() => {
    if (!currentFolder) return t('knowledge.documentLibrary.allDocuments');
    const last = breadcrumbParts[breadcrumbParts.length - 1];
    return last?.label || currentFolder;
  }, [currentFolder, breadcrumbParts, t]);

  const summaryStats = useMemo(() => {
    const withQuality = documents.filter((doc) => typeof doc.qualityScore === 'number' && (doc.qualityScore || 0) > 0).length;
    const governanceTagged = documents.filter((doc) => {
      const visibility = (doc.metadata as { visibility?: { scope?: string } } | null | undefined)?.visibility;
      return Boolean(visibility?.scope);
    }).length;
    const classesWithDocs = Object.keys(folderCounts).filter((key) => !key.includes('/')).length;
    return {
      visible: documents.length,
      selected: selectedDocuments.size,
      qualityTracked: withQuality,
      governanceTagged,
      classesWithDocs,
    };
  }, [documents, selectedDocuments.size, folderCounts]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setAdvancedFilters({ ...advancedFilters, [key]: value });
  };

  const toggleArrayFilter = (key: keyof Omit<FilterState, 'dateRange'>, value: string) => {
    const currentArray = advancedFilters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    setAdvancedFilters({ ...advancedFilters, [key]: newArray });
  };

  const removeFilter = (filterType: keyof FilterState, value?: string) => {
    if (filterType === 'dateRange') {
      updateFilter('dateRange', { from: null, to: null });
    } else {
      const currentArray = advancedFilters[filterType] as string[];
      if (value !== undefined) {
        setAdvancedFilters({ ...advancedFilters, [filterType]: currentArray.filter(item => item !== value) });
      } else {
        setAdvancedFilters({ ...advancedFilters, [filterType]: [] });
      }
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      {/* Folder Sidebar */}
      <Card className="h-fit sticky top-4 border-border/60 bg-card/95 shadow-sm" data-testid="folder-sidebar">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            {t('knowledge.documentLibrary.classifications')}
          </CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>{t('knowledge.documentLibrary.organizeByType')}</span>
            <Badge variant="outline" className="text-xs">{Object.keys(folderCounts).length}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="px-3 pb-3">
              {/* All Documents */}
              <Button
                variant={currentFolder === null ? "secondary" : "ghost"}
                className="w-full justify-start gap-2 mb-2"
                onClick={() => setCurrentFolder(null)}
                data-testid="folder-all-documents"
              >
                <Home className="h-4 w-4" />
                <span className="flex-1 text-left">{t('knowledge.documentLibrary.allDocuments')}</span>
                <Badge variant="outline" className="ml-auto">{allDocuments.length}</Badge>
              </Button>
              
              {/* Uncategorized Documents */}
              {(() => {
                const uncategorizedCount = documents.filter(doc => !doc.folderPath).length;
                const isUncategorizedSelected = currentFolder === '_uncategorized';
                return uncategorizedCount > 0 ? (
                  <Button
                    variant={isUncategorizedSelected ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 mb-2"
                    onClick={() => setCurrentFolder('_uncategorized')}
                    data-testid="folder-uncategorized"
                  >
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{t('knowledge.documentLibrary.uncategorized')}</span>
                    <Badge variant="outline" className="ml-auto">{uncategorizedCount}</Badge>
                  </Button>
                ) : null;
              })()}
              
              {/* Classification Folders */}
              <div className="space-y-1">
                {KNOWLEDGE_CLASSIFICATION_LIST.map(classification => {
                  const isExpanded = expandedFolders.has(classification.id);
                  const isSelected = currentFolder === classification.id;
                  const count = folderCounts[classification.id] || 0;
                  
                  return (
                    <div key={classification.id}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => toggleFolderExpanded(classification.id)}
                          data-testid={`folder-expand-${classification.id}`}
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                        <Button
                          variant={isSelected ? "secondary" : "ghost"}
                          className="flex-1 justify-start gap-2 h-8 px-2"
                          onClick={() => setCurrentFolder(classification.id)}
                          data-testid={`folder-${classification.id}`}
                        >
                          {getClassificationIcon(classification.icon, "h-4 w-4")}
                          <span className="flex-1 text-left truncate">{classification.label}</span>
                          {count > 0 && <Badge variant="outline" className="ml-auto text-xs">{count}</Badge>}
                        </Button>
                      </div>
                      
                      {/* Subfolders */}
                      {isExpanded && classification.subfolders.length > 0 && (
                        <div className="ml-6 mt-1 space-y-1 border-l pl-2">
                          {classification.subfolders.map(subfolder => {
                            const subfolderPath = `${classification.id}/${subfolder.slug}`;
                            const isSubSelected = currentFolder === subfolderPath;
                            const subCount = folderCounts[subfolderPath] || 0;
                            
                            return (
                              <Button
                                key={subfolder.slug}
                                variant={isSubSelected ? "secondary" : "ghost"}
                                className="w-full justify-start gap-2 h-7 px-2 text-sm"
                                onClick={() => setCurrentFolder(subfolderPath)}
                                data-testid={`folder-${classification.id}-${subfolder.slug}`}
                              >
                                <Folder className="h-3 w-3" />
                                <span className="flex-1 text-left truncate">{subfolder.label}</span>
                                {subCount > 0 && <Badge variant="outline" className="ml-auto text-xs">{subCount}</Badge>}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="min-w-0 space-y-4">
        <Card className="border-border/60 bg-card/95 shadow-sm" data-testid="library-command-deck">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Knowledge Library</h3>
                <p className="text-xs text-muted-foreground">Focused scope: {currentScopeLabel}</p>
              </div>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount} active filters
                </Badge>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground">Visible</p>
                <p className="text-base font-semibold" data-testid="summary-visible-count">{summaryStats.visible}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground">Selected</p>
                <p className="text-base font-semibold">{summaryStats.selected}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground">Quality Tracked</p>
                <p className="text-base font-semibold">{summaryStats.qualityTracked}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground">Governance Tagged</p>
                <p className="text-base font-semibold">{summaryStats.governanceTagged}</p>
              </div>
              <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
                <p className="text-[11px] text-muted-foreground">Active Classifications</p>
                <p className="text-base font-semibold">{summaryStats.classesWithDocs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breadcrumb Navigation */}
        {currentFolder && (
          <div className="flex items-center gap-2 text-sm rounded-md border border-border/50 bg-muted/20 p-2" data-testid="folder-breadcrumb">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={() => setCurrentFolder(null)}
            >
              <Home className="h-3 w-3" />
              {t('knowledge.documentLibrary.all')}
            </Button>
            {breadcrumbParts.map((part, index) => (
              <div key={part.path} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant={index === breadcrumbParts.length - 1 ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setCurrentFolder(part.path)}
                >
                  {part.label}
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {/* Toolbar */}
        <Card className="p-4 border-border/60 bg-card/95 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{t('knowledge.documentLibrary.view')}:</Label>
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <SortAsc className="h-4 w-4" />
              {t('knowledge.documentLibrary.sort')}:
            </Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('knowledge.documentLibrary.newestFirst')}</SelectItem>
                <SelectItem value="oldest">{t('knowledge.documentLibrary.oldestFirst')}</SelectItem>
                <SelectItem value="most_used">{t('knowledge.documentLibrary.mostUsed')}</SelectItem>
                <SelectItem value="highest_quality">{t('knowledge.documentLibrary.highestQuality')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground" data-testid="text-document-count">
            {documents.length} {t('knowledge.documentLibrary.documentCount', { count: documents.length })}
          </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Filter className="h-4 w-4" />
              {t('knowledge.documentLibrary.filters')}:
            </Label>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[145px]" data-testid="select-filter-category">
                <SelectValue placeholder={t('knowledge.documentLibrary.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('knowledge.documentLibrary.allCategories')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAccessLevel} onValueChange={setFilterAccessLevel}>
              <SelectTrigger className="w-[145px]" data-testid="select-filter-access">
                <SelectValue placeholder={t('knowledge.documentLibrary.accessLevel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('knowledge.documentLibrary.allAccess')}</SelectItem>
                <SelectItem value="public">{t('knowledge.documentLibrary.public')}</SelectItem>
                <SelectItem value="internal">{t('knowledge.documentLibrary.internal')}</SelectItem>
                <SelectItem value="restricted">{t('knowledge.documentLibrary.restricted')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterFileType} onValueChange={setFilterFileType}>
              <SelectTrigger className="w-[145px]" data-testid="select-filter-filetype">
                <SelectValue placeholder={t('knowledge.documentLibrary.fileType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('knowledge.documentLibrary.allTypes')}</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX</SelectItem>
                <SelectItem value="doc">DOC</SelectItem>
                <SelectItem value="txt">TXT</SelectItem>
                <SelectItem value="md">Markdown</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVisibilityScope} onValueChange={(v) => setFilterVisibilityScope(v as 'all' | VisibilityScope)}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-visibility-scope">
                <SelectValue placeholder="Visibility Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSector} onValueChange={setFilterSector}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-sector">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOrganization} onValueChange={setFilterOrganization}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-organization">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((organization) => (
                  <SelectItem key={organization} value={organization}>{organization}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-department">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>{department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedDocuments.size > 0 && (
        <Card className="p-3 border-primary/50 bg-primary/5" data-testid="card-bulk-actions">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedDocuments.size === documents.length && documents.length > 0}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all"
              />
              <span className="text-sm font-medium" data-testid="text-selected-count">
                {selectedDocuments.size} {t('knowledge.documentLibrary.selected')}
              </span>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMoveDialogOpen(true)}
                disabled={bulkMoveMutation.isPending}
                data-testid="button-bulk-move"
              >
                <FolderInput className="h-4 w-4 mr-2" />
                {t('knowledge.documentLibrary.moveToFolder')}
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {bulkDeleteMutation.isPending ? t('knowledge.documentLibrary.deleting') : t('knowledge.documentLibrary.delete')}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-bulk-move">
          <DialogHeader>
            <DialogTitle>{t('knowledge.documentLibrary.moveDocuments', { count: selectedDocuments.size })}</DialogTitle>
            <DialogDescription>
              {t('knowledge.documentLibrary.moveDocumentsDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="target-folder" className="text-sm font-medium">
              {t('knowledge.documentLibrary.targetFolder')}
            </Label>
            <Select value={targetFolder} onValueChange={setTargetFolder}>
              <SelectTrigger className="mt-2" data-testid="select-target-folder">
                <SelectValue placeholder={t('knowledge.documentLibrary.selectFolder')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KNOWLEDGE_CLASSIFICATIONS).map(([id, classification]) => (
                  <SelectItem key={id} value={id}>
                    {classification.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkMoveDialogOpen(false)}
            >
              {t('knowledge.documentLibrary.cancel')}
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={!targetFolder || bulkMoveMutation.isPending}
              data-testid="button-confirm-move"
            >
              {bulkMoveMutation.isPending ? t('knowledge.documentLibrary.moving') : t('knowledge.documentLibrary.moveDocumentsBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Filters */}
      <Card>
        <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="button-toggle-advanced-filters">
                  <Filter className="h-4 w-4" />
                  <span className="font-semibold">{t('knowledge.documentLibrary.advancedFilters')}</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1" data-testid="badge-active-filter-count">
                      {activeFilterCount}
                    </Badge>
                  )}
                  <ChevronRight className={`h-4 w-4 transition-transform ${isFilterOpen ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-all-filters">
                <X className="h-4 w-4 mr-2" />
                {t('knowledge.documentLibrary.clearAllFilters')}
              </Button>
            )}
          </div>

          <CollapsibleContent>
            <div className="p-6 space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Date Range Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {t('knowledge.documentLibrary.uploadDateRange')}
                  </Label>
                  <div className="space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-from">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {advancedFilters.dateRange.from ? format(advancedFilters.dateRange.from, 'PPP') : <span>{t('knowledge.documentLibrary.fromDate')}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={advancedFilters.dateRange.from || undefined}
                          onSelect={(date) => updateFilter('dateRange', { ...advancedFilters.dateRange, from: date || null })}
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-to">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {advancedFilters.dateRange.to ? format(advancedFilters.dateRange.to, 'PPP') : <span>{t('knowledge.documentLibrary.toDate')}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={advancedFilters.dateRange.to || undefined}
                          onSelect={(date) => updateFilter('dateRange', { ...advancedFilters.dateRange, to: date || null })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Uploader Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('knowledge.documentLibrary.uploadedBy')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                    {uploaders.length > 0 ? uploaders.map(uploader => (
                      <div key={uploader.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`uploader-${uploader.id}`}
                          checked={advancedFilters.uploaders.includes(uploader.id)}
                          onCheckedChange={() => toggleArrayFilter('uploaders', uploader.id)}
                          data-testid={`checkbox-uploader-${uploader.id}`}
                        />
                        <label htmlFor={`uploader-${uploader.id}`} className="text-sm cursor-pointer flex-1">
                          {uploader.name}
                        </label>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">{t('knowledge.documentLibrary.noUploaders')}</p>
                    )}
                  </div>
                </div>

                {/* Quality Score Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t('knowledge.documentLibrary.qualityScore')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {(['excellent', 'good', 'fair', 'poor', 'unrated'] as const).map(range => (
                      <div key={range} className="flex items-center space-x-2">
                        <Checkbox
                          id={`quality-${range}`}
                          checked={advancedFilters.qualityRanges.includes(range)}
                          onCheckedChange={() => toggleArrayFilter('qualityRanges', range)}
                          data-testid={`checkbox-quality-${range}`}
                        />
                        <label htmlFor={`quality-${range}`} className="text-sm cursor-pointer capitalize">
                          {t(`knowledge.documentLibrary.quality.${range}`)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Usage/Citation Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('knowledge.documentLibrary.usageLevel')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {(['high', 'low', 'none'] as const).map(level => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox
                          id={`usage-${level}`}
                          checked={advancedFilters.usageLevels.includes(level)}
                          onCheckedChange={() => toggleArrayFilter('usageLevels', level)}
                          data-testid={`checkbox-usage-${level}`}
                        />
                        <label htmlFor={`usage-${level}`} className="text-sm cursor-pointer capitalize">
                          {t(`knowledge.documentLibrary.usage.${level}`)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* File Type Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('knowledge.documentLibrary.fileTypesLabel')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {(['pdf', 'docx', 'txt', 'md', 'png', 'jpg'] as const).map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filetype-${type}`}
                          checked={advancedFilters.fileTypes.includes(type)}
                          onCheckedChange={() => toggleArrayFilter('fileTypes', type)}
                          data-testid={`checkbox-filetype-${type}`}
                        />
                        <label htmlFor={`filetype-${type}`} className="text-sm cursor-pointer uppercase">
                          {type}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {t('knowledge.documentLibrary.categoriesLabel')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                    {categories.length > 0 ? categories.map(category => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={advancedFilters.categories.includes(category)}
                          onCheckedChange={() => toggleArrayFilter('categories', category)}
                          data-testid={`checkbox-category-${category}`}
                        />
                        <label htmlFor={`category-${category}`} className="text-sm cursor-pointer flex-1">
                          {category}
                        </label>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">{t('knowledge.documentLibrary.noCategories')}</p>
                    )}
                  </div>
                </div>

                {/* Language Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('knowledge.documentLibrary.language')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {(['Arabic', 'English', 'Mixed', 'Unknown'] as const).map(lang => (
                      <div key={lang} className="flex items-center space-x-2">
                        <Checkbox
                          id={`language-${lang}`}
                          checked={advancedFilters.languages.includes(lang)}
                          onCheckedChange={() => toggleArrayFilter('languages', lang)}
                          data-testid={`checkbox-language-${lang}`}
                        />
                        <label htmlFor={`language-${lang}`} className="text-sm cursor-pointer">
                          {lang}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OCR Status Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {t('knowledge.documentLibrary.ocrStatus')}
                  </Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    {([
                      { value: 'processed', label: t('knowledge.documentLibrary.ocr.processed') },
                      { value: 'not_processed', label: t('knowledge.documentLibrary.ocr.notProcessed') },
                      { value: 'failed', label: t('knowledge.documentLibrary.ocr.failed') }
                    ] as const).map(({ value, label }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ocr-${value}`}
                          checked={advancedFilters.ocrStatus.includes(value)}
                          onCheckedChange={() => toggleArrayFilter('ocrStatus', value)}
                          data-testid={`checkbox-ocr-${value}`}
                        />
                        <label htmlFor={`ocr-${value}`} className="text-sm cursor-pointer">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Active Filter Pills */}
        {activeFilterCount > 0 && (
          <div className="px-4 pb-4 pt-2">
            <div className="flex flex-wrap gap-2">
              {/* Date Range Pills */}
              {(advancedFilters.dateRange.from || advancedFilters.dateRange.to) && (
                <Badge variant="secondary" className="gap-1" data-testid="pill-date-range">
                  <CalendarIcon className="h-3 w-3" />
                  {advancedFilters.dateRange.from && format(advancedFilters.dateRange.from, 'MMM d, yyyy')}
                  {advancedFilters.dateRange.from && advancedFilters.dateRange.to && ' - '}
                  {advancedFilters.dateRange.to && format(advancedFilters.dateRange.to, 'MMM d, yyyy')}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('dateRange')}
                    data-testid="button-remove-date-range"
                  />
                </Badge>
              )}

              {/* Uploader Pills */}
              {advancedFilters.uploaders.map(uploaderId => {
                const uploader = uploaders.find(u => u.id === uploaderId);
                return uploader ? (
                  <Badge key={uploaderId} variant="secondary" className="gap-1" data-testid={`pill-uploader-${uploaderId}`}>
                    <User className="h-3 w-3" />
                    {uploader.name}
                    <X
                      className="h-3 w-3 cursor-pointer hover-elevate"
                      onClick={() => removeFilter('uploaders', uploaderId)}
                      data-testid={`button-remove-uploader-${uploaderId}`}
                    />
                  </Badge>
                ) : null;
              })}

              {/* Quality Pills */}
              {advancedFilters.qualityRanges.map(range => (
                <Badge key={range} variant="secondary" className="gap-1 capitalize" data-testid={`pill-quality-${range}`}>
                  <Award className="h-3 w-3" />
                  {range}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('qualityRanges', range)}
                    data-testid={`button-remove-quality-${range}`}
                  />
                </Badge>
              ))}

              {/* Usage Pills */}
              {advancedFilters.usageLevels.map(level => (
                <Badge key={level} variant="secondary" className="gap-1 capitalize" data-testid={`pill-usage-${level}`}>
                  <BarChart3 className="h-3 w-3" />
                  {level === 'high' ? t('knowledge.documentLibrary.mostCited') : level === 'low' ? t('knowledge.documentLibrary.leastCited') : t('knowledge.documentLibrary.neverCited')}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('usageLevels', level)}
                    data-testid={`button-remove-usage-${level}`}
                  />
                </Badge>
              ))}

              {/* File Type Pills */}
              {advancedFilters.fileTypes.map(type => (
                <Badge key={type} variant="secondary" className="gap-1 uppercase" data-testid={`pill-filetype-${type}`}>
                  <FileText className="h-3 w-3" />
                  {type}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('fileTypes', type)}
                    data-testid={`button-remove-filetype-${type}`}
                  />
                </Badge>
              ))}

              {/* Category Pills */}
              {advancedFilters.categories.map(category => (
                <Badge key={category} variant="secondary" className="gap-1" data-testid={`pill-category-${category}`}>
                  <BookOpen className="h-3 w-3" />
                  {category}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('categories', category)}
                    data-testid={`button-remove-category-${category}`}
                  />
                </Badge>
              ))}

              {/* Language Pills */}
              {advancedFilters.languages.map(lang => (
                <Badge key={lang} variant="secondary" className="gap-1" data-testid={`pill-language-${lang}`}>
                  <Globe className="h-3 w-3" />
                  {lang}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('languages', lang)}
                    data-testid={`button-remove-language-${lang}`}
                  />
                </Badge>
              ))}

              {/* OCR Status Pills */}
              {advancedFilters.ocrStatus.map(status => (
                <Badge key={status} variant="secondary" className="gap-1" data-testid={`pill-ocr-${status}`}>
                  <Sparkles className="h-3 w-3" />
                  {status === 'processed' ? t('knowledge.documentLibrary.ocr.processed') : status === 'not_processed' ? t('knowledge.documentLibrary.ocr.notProcessed') : t('knowledge.documentLibrary.ocr.failed')}
                  <X
                    className="h-3 w-3 cursor-pointer hover-elevate"
                    onClick={() => removeFilter('ocrStatus', status)}
                    data-testid={`button-remove-ocr-${status}`}
                  />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Documents Display */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t('knowledge.documentLibrary.noDocuments')}</h3>
              <p className="text-muted-foreground">
                {t('knowledge.documentLibrary.noDocumentsDesc')}
              </p>
            </div>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="document-grid">
          {documents.map(doc => (
            <DocumentCard 
              key={doc.id} 
              document={doc} 
              onClick={() => onDocumentClick(doc)}
              isSelected={selectedDocuments.has(doc.id)}
              onToggleSelect={toggleDocumentSelection}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2" data-testid="document-list">
          {documents.map(doc => (
            <DocumentListItem 
              key={doc.id} 
              document={doc} 
              onClick={() => onDocumentClick(doc)}
              isSelected={selectedDocuments.has(doc.id)}
              onToggleSelect={toggleDocumentSelection}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
