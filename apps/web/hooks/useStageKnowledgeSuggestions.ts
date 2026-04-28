import { useState, useEffect, useCallback, useRef } from 'react';

export interface KnowledgeSuggestion {
  id: string;
  title: string;
  snippet: string;
  confidence: number;
  documentType: string;
  category: string;
  actions: string[];
}

interface SuggestionContext {
  // Creation context
  title?: string;
  description?: string;
  requestType?: string;
  // Review context
  category?: string;
  priority?: string;
  requirements?: string;
  // Approval context
  businessCase?: string;
  costs?: string;
  strategicAlignment?: string;
}

interface UseStageSuggestionsResult {
  suggestions: KnowledgeSuggestion[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  showMore: () => void;
  hasMore: boolean;
}

const DEBOUNCE_DELAY = 500;
const MIN_CONTEXT_LENGTH = 3;

// Simple cache storage
const suggestionCache = new Map<string, { suggestions: KnowledgeSuggestion[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(stage: string, context: SuggestionContext): string {
  return `${stage}_${JSON.stringify(context)}`;
}

function cleanCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  suggestionCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => suggestionCache.delete(key));
}

export function useStageKnowledgeSuggestions(
  stage: 'creation' | 'review' | 'approval',
  context: SuggestionContext,
  demandId?: number
): UseStageSuggestionsResult {
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(3);
  const [totalAvailable, setTotalAvailable] = useState(0);
  
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const lastContextRef = useRef<string>('');

  const fetchSuggestions = useCallback(async (currentLimit: number) => {
    // Check if context has enough content
    const contextValues = Object.values(context).filter(Boolean).join('');
    if (contextValues.length < MIN_CONTEXT_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(stage, context);
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Suggestions Hook] Using cached results');
      setSuggestions(cached.suggestions.slice(0, currentLimit));
      setTotalAvailable(cached.suggestions.length);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams({
        stage,
        limit: '8', // Fetch more than needed for "show more"
        ...(demandId && { demandId: demandId.toString() }),
        ...Object.entries(context).reduce((acc, [key, value]) => {
          if (value) acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      });

      const response = await fetch(`/api/knowledge/suggestions?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      
      if (data.success) {
        const allSuggestions = data.data.suggestions || [];
        
        // Cache the results
        suggestionCache.set(cacheKey, {
          suggestions: allSuggestions,
          timestamp: Date.now(),
        });
        cleanCache();
        
        setSuggestions(allSuggestions.slice(0, currentLimit));
        setTotalAvailable(allSuggestions.length);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('[Suggestions Hook] Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [stage, context, demandId]);

  // Debounced effect when context changes
  useEffect(() => {
    const contextString = JSON.stringify(context);
    
    // Skip if context hasn't changed
    if (contextString === lastContextRef.current) {
      return;
    }
    
    lastContextRef.current = contextString;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(limit);
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [context, limit, fetchSuggestions]);

  const refresh = useCallback(() => {
    // Clear cache for this context
    const cacheKey = getCacheKey(stage, context);
    suggestionCache.delete(cacheKey);
    
    // Fetch fresh data
    fetchSuggestions(limit);
  }, [stage, context, limit, fetchSuggestions]);

  const showMore = useCallback(() => {
    const newLimit = limit + 5;
    setLimit(newLimit);
    
    // Check if we have cached data that can satisfy the new limit
    const cacheKey = getCacheKey(stage, context);
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setSuggestions(cached.suggestions.slice(0, newLimit));
    } else {
      fetchSuggestions(newLimit);
    }
  }, [stage, context, limit, fetchSuggestions]);

  const hasMore = suggestions.length < totalAvailable;

  return {
    suggestions,
    loading,
    error,
    refresh,
    showMore,
    hasMore,
  };
}
