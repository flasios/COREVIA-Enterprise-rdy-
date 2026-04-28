import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentLibrary } from "./knowledgeCentre.DocumentLibrary";
import { DocumentUpload } from "./knowledgeCentre.DocumentUpload";
import { SearchInterface } from "./knowledgeCentre.SearchInterface";
import { DocumentPreviewModal } from "./knowledgeCentre.DocumentPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Upload, FileText, Search, Shield,
  BookOpen, BarChart3,
  Network, Radar,
} from "lucide-react";
import {
  getOCRStatus,
  getQualityRange,
  getUsageLevel,
  type OCRStatusType,
  type QualityRangeType,
  type UsageLevelType,
} from "./knowledgeCentre.utils";
import { useDebounce, useLocalStorage } from "./knowledgeCentre.hooks";
import { TabLoadingSkeleton } from "./knowledgeCentre.skeletons";
import type {
  AskAIResponse,
  DocumentMetadata,
  DocumentUpdateData,
  DocumentWithUploader,
  FilterState,
  SearchResult,
  VisibilityScope,
} from "./knowledgeCentre.types";
import { Footer } from "@/components/layout";

// Lazy load heavy components for better initial load performance
const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard"));
const KnowledgeGraphNavigator = lazy(() => import("@/modules/knowledge").then(m => ({ default: m.KnowledgeGraphNavigator })));
const ExecutiveBriefingGenerator = lazy(() => import("@/modules/knowledge").then(m => ({ default: m.ExecutiveBriefingGenerator })));
const InsightRadarDashboard = lazy(() => import("@/modules/knowledge").then(m => ({ default: m.InsightRadarDashboard })));
const PolicyWatchtower = lazy(() => import("@/modules/knowledge").then(m => ({ default: m.PolicyWatchtower })));
const DocumentConnections = lazy(() => import("@/modules/knowledge").then(m => ({ default: m.DocumentConnections })));

// ============================================================================
// CONSTANTS
// ============================================================================

const DEBOUNCE_DELAY = 300;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function KnowledgeCentre() {
  const { t } = useTranslation();
  const { toast } = useToast();
  // Initialize viewMode from localStorage
  const [savedViewMode, setSavedViewMode] = useLocalStorage<'grid' | 'list'>('knowledge-view-mode', 'grid');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(savedViewMode);

  // Sync viewMode to localStorage when it changes
  useEffect(() => {
    setSavedViewMode(viewMode);
  }, [viewMode, setSavedViewMode]);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccessLevel, setFilterAccessLevel] = useState<string>('all');
  const [filterFileType, setFilterFileType] = useState<string>('all');
  const [filterVisibilityScope, setFilterVisibilityScope] = useState<'all' | VisibilityScope>('all');
  const [filterSector, setFilterSector] = useState<string>('all');
  const [filterOrganization, setFilterOrganization] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithUploader | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null); // null = all documents, "policies" = root, "policies/IT Policies" = subfolder

  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    dateRange: { from: null, to: null },
    uploaders: [],
    qualityRanges: [],
    usageLevels: [],
    fileTypes: [],
    categories: [],
    languages: [],
    ocrStatus: [],
  });

  // Load filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newFilters: FilterState = {
      dateRange: { from: null, to: null },
      uploaders: [],
      qualityRanges: [],
      usageLevels: [],
      fileTypes: [],
      categories: [],
      languages: [],
      ocrStatus: [],
    };

    // Parse date range
    const fromDate = params.get('from');
    const toDate = params.get('to');
    if (fromDate) newFilters.dateRange.from = new Date(fromDate);
    if (toDate) newFilters.dateRange.to = new Date(toDate);

    // Parse array filters
    const uploaders = params.get('uploaders');
    if (uploaders) newFilters.uploaders = uploaders.split(',');

    const qualityRanges = params.get('quality');
    if (qualityRanges) newFilters.qualityRanges = qualityRanges.split(',') as QualityRangeType[];

    const usageLevels = params.get('usage');
    if (usageLevels) newFilters.usageLevels = usageLevels.split(',') as UsageLevelType[];

    const fileTypes = params.get('types');
    if (fileTypes) newFilters.fileTypes = fileTypes.split(',');

    const categories = params.get('cats');
    if (categories) newFilters.categories = categories.split(',');

    const languages = params.get('langs');
    if (languages) newFilters.languages = languages.split(',');

    const ocrStatus = params.get('ocr');
    if (ocrStatus) newFilters.ocrStatus = ocrStatus.split(',') as OCRStatusType[];

    // Only update if any filters were found
    if (fromDate || toDate || uploaders || qualityRanges || usageLevels || fileTypes || categories || languages || ocrStatus) {
      setAdvancedFilters(newFilters);
    }
  }, []);

  // Save filters to URL params when they change
  useEffect(() => {
    const params = new URLSearchParams();

    // Add date range
    if (advancedFilters.dateRange.from) {
      params.set('from', advancedFilters.dateRange.from.toISOString().split('T')[0]!);
    }
    if (advancedFilters.dateRange.to) {
      params.set('to', advancedFilters.dateRange.to.toISOString().split('T')[0]!);
    }

    // Add array filters
    if (advancedFilters.uploaders.length > 0) {
      params.set('uploaders', advancedFilters.uploaders.join(','));
    }
    if (advancedFilters.qualityRanges.length > 0) {
      params.set('quality', advancedFilters.qualityRanges.join(','));
    }
    if (advancedFilters.usageLevels.length > 0) {
      params.set('usage', advancedFilters.usageLevels.join(','));
    }
    if (advancedFilters.fileTypes.length > 0) {
      params.set('types', advancedFilters.fileTypes.join(','));
    }
    if (advancedFilters.categories.length > 0) {
      params.set('cats', advancedFilters.categories.join(','));
    }
    if (advancedFilters.languages.length > 0) {
      params.set('langs', advancedFilters.languages.join(','));
    }
    if (advancedFilters.ocrStatus.length > 0) {
      params.set('ocr', advancedFilters.ocrStatus.join(','));
    }

    // Update URL without reloading
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [advancedFilters]);

  // Analytics tab is now visible to all authenticated users
  const hasAnalyticsPermission = true;

  // Search state with debouncing for performance
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY);
  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword'>('semantic');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);


  // Ask AI state
  const [askAIQuery, setAskAIQuery] = useState('');
  const [askAIResponse, setAskAIResponse] = useState<AskAIResponse | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);

  // Fetch documents with optimized caching
  const { data: documentsData, isLoading: documentsLoading, refetch: _refetchDocuments } = useQuery<{ success: boolean; data: DocumentWithUploader[]; count: number }>({
    queryKey: ['/api/knowledge/documents'],
    refetchInterval: 30000,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const documents = documentsData?.data || [];

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    const getGovernance = (doc: DocumentWithUploader) => {
      const metadata = (doc.metadata || {}) as DocumentMetadata;
      const visibility = (metadata.visibility || {}) as {
        scope?: VisibilityScope;
        sector?: string;
        organization?: string;
        department?: string;
      };
      return {
        scope: visibility.scope || 'organization',
        sector: visibility.sector || '',
        organization: visibility.organization || '',
        department: visibility.department || '',
      };
    };

    // Folder filter (hierarchical classification)
    if (currentFolder) {
      if (currentFolder === '_uncategorized') {
        // Show only documents without a folder path
        filtered = filtered.filter(doc => !doc.folderPath);
      } else {
        filtered = filtered.filter(doc => {
          const docFolder = doc.folderPath || '';
          // Match exact folder or documents within that folder
          return docFolder === currentFolder || docFolder.startsWith(currentFolder + '/');
        });
      }
    }

    // Basic filters
    if (filterCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === filterCategory);
    }
    if (filterAccessLevel !== 'all') {
      filtered = filtered.filter(doc => doc.accessLevel === filterAccessLevel);
    }
    if (filterFileType !== 'all') {
      filtered = filtered.filter(doc => doc.fileType === filterFileType);
    }

    if (filterVisibilityScope !== 'all') {
      filtered = filtered.filter((doc) => getGovernance(doc).scope === filterVisibilityScope);
    }

    if (filterSector !== 'all') {
      filtered = filtered.filter((doc) => getGovernance(doc).sector === filterSector);
    }

    if (filterOrganization !== 'all') {
      filtered = filtered.filter((doc) => getGovernance(doc).organization === filterOrganization);
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter((doc) => getGovernance(doc).department === filterDepartment);
    }

    // Advanced filters
    // Date range filter
    if (advancedFilters.dateRange.from) {
      filtered = filtered.filter(doc => new Date(doc.uploadedAt) >= advancedFilters.dateRange.from!);
    }
    if (advancedFilters.dateRange.to) {
      const endOfDay = new Date(advancedFilters.dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(doc => new Date(doc.uploadedAt) <= endOfDay);
    }

    // Uploader filter
    if (advancedFilters.uploaders.length > 0) {
      filtered = filtered.filter(doc => advancedFilters.uploaders.includes(doc.uploadedBy));
    }

    // Quality range filter
    if (advancedFilters.qualityRanges.length > 0) {
      filtered = filtered.filter(doc => {
        const qualityRange = getQualityRange(doc.qualityScore);
        return advancedFilters.qualityRanges.includes(qualityRange);
      });
    }

    // Usage level filter
    if (advancedFilters.usageLevels.length > 0) {
      filtered = filtered.filter(doc => {
        const usageLevel = getUsageLevel(doc.usageCount);
        return advancedFilters.usageLevels.includes(usageLevel);
      });
    }

    // File type filter (advanced)
    if (advancedFilters.fileTypes.length > 0) {
      filtered = filtered.filter(doc => advancedFilters.fileTypes.includes(doc.fileType.toLowerCase()));
    }

    // Category filter (advanced multi-select)
    if (advancedFilters.categories.length > 0) {
      filtered = filtered.filter(doc => doc.category && advancedFilters.categories.includes(doc.category));
    }

    // Language filter
    if (advancedFilters.languages.length > 0) {
      filtered = filtered.filter(doc => {
        const metadata = doc.metadata as DocumentMetadata | null;
        const lang = metadata?.ocr?.language || 'Unknown';
        return advancedFilters.languages.includes(lang);
      });
    }

    // OCR status filter
    if (advancedFilters.ocrStatus.length > 0) {
      filtered = filtered.filter(doc => {
        const metadata = doc.metadata as DocumentMetadata | null;
        const status = getOCRStatus(metadata?.ocr);
        return advancedFilters.ocrStatus.includes(status);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      if (sortBy === 'most_used') {
        return (b.usageCount || 0) - (a.usageCount || 0);
      }
      if (sortBy === 'highest_quality') {
        return (Number(b.qualityScore) || 0) - (Number(a.qualityScore) || 0);
      }
      return 0;
    });

    return filtered;
  }, [documents, currentFolder, filterCategory, filterAccessLevel, filterFileType, sortBy, advancedFilters, filterDepartment, filterOrganization, filterSector, filterVisibilityScope]);

  // Calculate folder document counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(doc => {
      const folder = doc.folderPath;
      if (folder) {
        // Count for exact folder
        counts[folder] = (counts[folder] || 0) + 1;
        // Also count for parent folders
        const parts = folder.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentPath = parts.slice(0, i).join('/');
          counts[parentPath] = (counts[parentPath] || 0) + 1;
        }
      }
    });
    return counts;
  }, [documents]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(documents.map(doc => doc.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [documents]);

  const governanceOptions = useMemo(() => {
    const sectors = new Set<string>();
    const organizations = new Set<string>();
    const departments = new Set<string>();

    documents.forEach((doc) => {
      const metadata = (doc.metadata || {}) as DocumentMetadata;
      const visibility = (metadata.visibility || {}) as {
        sector?: string;
        organization?: string;
        department?: string;
      };
      if (visibility.sector) sectors.add(visibility.sector);
      if (visibility.organization) organizations.add(visibility.organization);
      if (visibility.department) departments.add(visibility.department);
    });

    return {
      sectors: Array.from(sectors).sort(),
      organizations: Array.from(organizations).sort(),
      departments: Array.from(departments).sort(),
    };
  }, [documents]);

  // Get unique uploaders for filter
  const uploaders = useMemo(() => {
    const uniqueUploaders = new Map<string, string>();
    documents.forEach(doc => {
      if (doc.uploadedBy && doc.uploaderName) {
        uniqueUploaders.set(doc.uploadedBy, doc.uploaderName);
      }
    });
    return Array.from(uniqueUploaders.entries()).map(([id, name]) => ({ id, name }));
  }, [documents]);

  // Clear all advanced filters
  const clearAllFilters = useCallback(() => {
    setAdvancedFilters({
      dateRange: { from: null, to: null },
      uploaders: [],
      qualityRanges: [],
      usageLevels: [],
      fileTypes: [],
      categories: [],
      languages: [],
      ocrStatus: [],
    });
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.dateRange.from || advancedFilters.dateRange.to) count++;
    if (advancedFilters.uploaders.length > 0) count++;
    if (advancedFilters.qualityRanges.length > 0) count++;
    if (advancedFilters.usageLevels.length > 0) count++;
    if (advancedFilters.fileTypes.length > 0) count++;
    if (advancedFilters.categories.length > 0) count++;
    if (advancedFilters.languages.length > 0) count++;
    if (advancedFilters.ocrStatus.length > 0) count++;
    return count;
  }, [advancedFilters]);

  // Delete mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await apiRequest('DELETE', `/api/knowledge/documents/${documentId}`);
      return res.json();
    },
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['/api/knowledge/documents'] });
      const previousDocuments = queryClient.getQueryData(['/api/knowledge/documents']);
      queryClient.setQueryData(['/api/knowledge/documents'], (old: { success: boolean; data: DocumentWithUploader[]; count: number } | undefined) => {
        const newData = old?.data?.filter(doc => doc.id !== documentId) || [];
        return {
          ...old,
          success: true,
          data: newData,
          count: newData.length,
        };
      });
      return { previousDocuments };
    },
    onError: (error: Error, documentId, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(['/api/knowledge/documents'], context.previousDocuments);
      }
      toast({
        variant: "destructive",
        title: t('knowledge.deleteFailed'),
        description: error.message,
      });
    },
    onSuccess: () => {
      toast({
        title: t('knowledge.documentDeleted'),
        description: t('knowledge.documentDeletedDesc'),
      });
      setPreviewOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
    },
  });

  // Update metadata mutation with optimistic update
  const updateMetadataMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentUpdateData }) => {
      const res = await apiRequest('PATCH', `/api/knowledge/documents/${id}`, data);
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/knowledge/documents'] });
      const previousDocuments = queryClient.getQueryData(['/api/knowledge/documents']);
      queryClient.setQueryData(['/api/knowledge/documents'], (old: { success: boolean; data: DocumentWithUploader[]; count: number } | undefined) => {
        const newData = old?.data?.map(doc =>
          doc.id === id ? { ...doc, ...data } : doc
        ) || [];
        return {
          ...old,
          success: true,
          data: newData,
          count: newData.length,
        };
      });
      return { previousDocuments };
    },
    onError: (error: Error, variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(['/api/knowledge/documents'], context.previousDocuments);
      }
      toast({
        variant: "destructive",
        title: t('knowledge.updateFailed'),
        description: error.message,
      });
    },
    onSuccess: () => {
      toast({
        title: t('knowledge.metadataUpdated'),
        description: t('knowledge.metadataUpdatedDesc'),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge/documents'] });
    },
  });

  // Search function
  const handleSearch = useCallback(async () => {
    const queryToSearch = debouncedSearchQuery.trim();
    if (!queryToSearch) {
      toast({
        variant: "destructive",
        title: t('knowledge.searchQueryRequired'),
        description: t('knowledge.searchQueryRequiredDesc'),
      });
      return;
    }

    setIsSearching(true);
    setAskAIResponse(null);

    try {
      const endpoint = searchMode === 'semantic'
        ? '/api/knowledge/search'
        : '/api/knowledge/hybrid-search';

      const res = await apiRequest('POST', endpoint, {
        query: queryToSearch,
        topK: 20,
      });
      const result = await res.json();

      if (result.success) {
        setSearchResults(result.data.results);
        toast({
          title: t('knowledge.searchCompleted'),
          description: t('knowledge.searchCompletedDesc', { count: result.data.count }),
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: t('knowledge.searchFailed'),
        description: error instanceof Error ? error.message : t('app.errorOccurred'),
      });
    } finally {
      setIsSearching(false);
    }
  }, [debouncedSearchQuery, searchMode, toast, t]);

  // Ask AI function
  const handleAskAI = useCallback(async () => {
    if (!askAIQuery.trim()) {
      toast({
        variant: "destructive",
        title: t('knowledge.questionRequired'),
        description: t('knowledge.questionRequiredDesc'),
      });
      return;
    }

    setIsAskingAI(true);

    try {
      const res = await apiRequest('POST', '/api/knowledge/ask', {
        query: askAIQuery,
        topK: 5,
        useHybrid: true,
      });
      const result = await res.json();

      if (result.success) {
        setAskAIResponse(result.data);
        toast({
          title: t('knowledge.aiResponseGenerated'),
          description: t('knowledge.confidencePercent', { percent: (result.data.confidence * 100).toFixed(0) }),
        });
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: t('knowledge.aiRequestFailed'),
        description: error instanceof Error ? error.message : t('app.errorOccurred'),
      });
    } finally {
      setIsAskingAI(false);
    }
  }, [askAIQuery, toast, t]);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-knowledge-centre">
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold" data-testid="text-page-title">{t('knowledge.knowledgeCentre')}</h1>
            <span className="text-xs text-muted-foreground">{t('knowledge.aiPoweredDocRepo')}</span>
          </div>
        </div>

        <Tabs defaultValue="library" className="space-y-4">
          <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-2">
              <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent w-full justify-start">
                <TabsTrigger
                  value="library"
                  data-testid="tab-trigger-library"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  <BookOpen className="h-3 w-3" />
                  {t('knowledge.library')}
                </TabsTrigger>
                <TabsTrigger
                  value="upload"
                  data-testid="tab-trigger-upload"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white"
                >
                  <Upload className="h-3 w-3" />
                  {t('knowledge.upload')}
                </TabsTrigger>
                <TabsTrigger
                  value="connections"
                  data-testid="tab-trigger-connections"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-violet-500 data-[state=active]:text-white"
                >
                  <Network className="h-3 w-3" />
                  {t('knowledge.connections')}
                </TabsTrigger>
                <TabsTrigger
                  value="search"
                  data-testid="tab-trigger-search"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                >
                  <Search className="h-3 w-3" />
                  {t('knowledge.aiSearch')}
                </TabsTrigger>
                <TabsTrigger
                  value="graph"
                  data-testid="tab-trigger-graph"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
                >
                  <Network className="h-3 w-3" />
                  {t('knowledge.graph')}
                </TabsTrigger>
                <TabsTrigger
                  value="radar"
                  data-testid="tab-trigger-radar"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-rose-500 data-[state=active]:text-white"
                >
                  <Radar className="h-3 w-3" />
                  {t('knowledge.radar')}
                </TabsTrigger>
                <span className="text-muted-foreground/50 mx-1">|</span>
                <TabsTrigger
                  value="briefings"
                  data-testid="tab-trigger-briefings"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-teal-500 data-[state=active]:text-white"
                >
                  <FileText className="h-3 w-3" />
                  {t('knowledge.briefings')}
                </TabsTrigger>
                <TabsTrigger
                  value="watchtower"
                  data-testid="tab-trigger-watchtower"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-red-500 data-[state=active]:text-white"
                >
                  <Shield className="h-3 w-3" />
                  {t('knowledge.watchtower')}
                </TabsTrigger>
                {hasAnalyticsPermission && (
                  <>
                    <span className="text-muted-foreground/50 mx-1">|</span>
                    <TabsTrigger
                      value="analytics"
                      data-testid="tab-trigger-analytics"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                    >
                      <BarChart3 className="h-3 w-3" />
                      {t('knowledge.analytics.label')}
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </CardContent>
          </Card>

          {/* Document Library Tab */}
          <TabsContent value="library" className="space-y-6" data-testid="tab-content-library">
            <DocumentLibrary
              documents={filteredDocuments}
              allDocuments={documents}
              isLoading={documentsLoading}
              viewMode={viewMode}
              setViewMode={setViewMode}
              sortBy={sortBy}
              setSortBy={setSortBy}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterAccessLevel={filterAccessLevel}
              setFilterAccessLevel={setFilterAccessLevel}
              filterFileType={filterFileType}
              setFilterFileType={setFilterFileType}
              filterVisibilityScope={filterVisibilityScope}
              setFilterVisibilityScope={setFilterVisibilityScope}
              filterSector={filterSector}
              setFilterSector={setFilterSector}
              filterOrganization={filterOrganization}
              setFilterOrganization={setFilterOrganization}
              filterDepartment={filterDepartment}
              setFilterDepartment={setFilterDepartment}
              categories={categories}
              sectors={governanceOptions.sectors}
              organizations={governanceOptions.organizations}
              departments={governanceOptions.departments}
              uploaders={uploaders}
              advancedFilters={advancedFilters}
              setAdvancedFilters={setAdvancedFilters}
              clearAllFilters={clearAllFilters}
              activeFilterCount={activeFilterCount}
              onDocumentClick={(doc) => {
                setSelectedDocument(doc);
                setPreviewOpen(true);
              }}
              currentFolder={currentFolder}
              setCurrentFolder={setCurrentFolder}
              folderCounts={folderCounts}
            />
          </TabsContent>

          {/* Upload Documents Tab */}
          <TabsContent value="upload" className="space-y-6" data-testid="tab-content-upload">
            <DocumentUpload />
          </TabsContent>

          {/* AI Search Tab */}
          <TabsContent value="search" className="space-y-6" data-testid="tab-content-search">
            <SearchInterface
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchMode={searchMode}
              setSearchMode={setSearchMode}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearch={handleSearch}
              askAIQuery={askAIQuery}
              setAskAIQuery={setAskAIQuery}
              askAIResponse={askAIResponse}
              isAskingAI={isAskingAI}
              onAskAI={handleAskAI}
            />
          </TabsContent>

          {/* Knowledge Graph Tab */}
          <TabsContent value="graph" className="space-y-6" data-testid="tab-content-graph">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <KnowledgeGraphNavigator />
            </Suspense>
          </TabsContent>

          {/* Executive Briefings Tab */}
          <TabsContent value="briefings" className="space-y-6" data-testid="tab-content-briefings">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <ExecutiveBriefingGenerator />
            </Suspense>
          </TabsContent>

          {/* Insight Radar Tab */}
          <TabsContent value="radar" className="space-y-6" data-testid="tab-content-radar">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <InsightRadarDashboard />
            </Suspense>
          </TabsContent>

          {/* Policy Watchtower Tab */}
          <TabsContent value="watchtower" className="space-y-6" data-testid="tab-content-watchtower">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <PolicyWatchtower />
            </Suspense>
          </TabsContent>

          {/* Document Connections Tab */}
          <TabsContent value="connections" className="space-y-6" data-testid="tab-content-connections">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <DocumentConnections />
            </Suspense>
          </TabsContent>

          {/* Analytics Tab (Manager+ only) */}
          {hasAnalyticsPermission && (
            <TabsContent value="analytics" className="space-y-6" data-testid="tab-content-analytics">
              <Suspense fallback={<TabLoadingSkeleton />}>
                <AnalyticsDashboard />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>

        {/* Document Preview Modal */}
        {selectedDocument && (
          <DocumentPreviewModal
            document={selectedDocument}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            onDelete={(id) => deleteMutation.mutate(id)}
            onUpdateMetadata={(id, data) => updateMetadataMutation.mutate({ id, data })}
            isDeleting={deleteMutation.isPending}
            isUpdating={updateMetadataMutation.isPending}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
