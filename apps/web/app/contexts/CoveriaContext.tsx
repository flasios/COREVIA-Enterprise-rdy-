/**
 * Coveria Context - AI Assistant State Management
 * 
 * Enhanced Version: Production-optimized with comprehensive error handling,
 * performance optimization, better caching, retry logic, and monitoring
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useRef, 
  useEffect, 
  useMemo,
  type ReactNode, 
  type RefObject 
} from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { canUseBrowserTts, cancelBrowserTts, speakWithBrowserTts } from "@/shared/lib/browserTts";

// ============================================================================
// TYPES
// ============================================================================

interface AvatarPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  structuredOutput?: Array<{type: string; title: string; data: unknown}>;
  timestamp?: Date;
  messageId: string;
  satisfaction?: number;
}

interface ProactiveInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'recommendation' | 'warning' | 'celebration';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  generatedAt: string;
  expiresAt: string;
  actionable: boolean;
}

interface CoveriaPersonality {
  formality: number;
  technicalDepth: number;
  proactivity: number;
  empathy: number;
  enthusiasm: number;
}

interface DailyBriefing {
  greeting: string;
  insights: string[];
  priorities: string[];
  recommendations: string[];
}

interface CoveriaContextType {
  isOpen: boolean;
  openCoveria: () => void;
  closeCoveria: () => void;
  toggleCoveria: () => void;
  avatarRef: RefObject<HTMLButtonElement>;
  avatarPosition: AvatarPosition | null;
  updateAvatarPosition: () => void;
  voiceEnabled: boolean;
  toggleVoice: () => void;
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  stopSpeaking: () => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearChat: (greeting: string) => void;
  hasSpokenGreeting: boolean;
  setHasSpokenGreeting: React.Dispatch<React.SetStateAction<boolean>>;
  proactiveInsights: ProactiveInsight[];
  dismissInsight: (id: string) => void;
  rateSatisfaction: (messageId: string, satisfaction: number) => void;
  personality: CoveriaPersonality | null;
  fetchDailyBriefing: () => Promise<DailyBriefing | null>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  INSIGHTS_FETCH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  PERSONALITY_FETCH_INTERVAL: 30 * 60 * 1000, // 30 minutes
  MAX_CHAT_MESSAGES: 100,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  // Upper bound for total speak operation lifecycle (edge-tts is ~3s)
  TTS_TIMEOUT: 30000,
  STORAGE_KEYS: {
    VOICE_ENABLED: 'coveria-voice-enabled',
    CHAT_MESSAGES: 'coveria-chat-messages',
    LAST_BRIEFING: 'coveria-last-briefing',
  },
} as const;

// ============================================================================
// CONTEXT
// ============================================================================

const CoveriaContext = createContext<CoveriaContextType | undefined>(undefined);

const fallbackAvatarRef = { current: null } as RefObject<HTMLButtonElement>;
const fallbackSetChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>> = () => undefined;
const fallbackSetHasSpokenGreeting: React.Dispatch<React.SetStateAction<boolean>> = () => undefined;

const fallbackCoveriaContext: CoveriaContextType = {
  isOpen: false,
  openCoveria: () => undefined,
  closeCoveria: () => undefined,
  toggleCoveria: () => undefined,
  avatarRef: fallbackAvatarRef,
  avatarPosition: null,
  updateAvatarPosition: () => undefined,
  voiceEnabled: false,
  toggleVoice: () => undefined,
  speak: async () => undefined,
  isSpeaking: false,
  stopSpeaking: () => undefined,
  chatMessages: [],
  setChatMessages: fallbackSetChatMessages,
  clearChat: () => undefined,
  hasSpokenGreeting: false,
  setHasSpokenGreeting: fallbackSetHasSpokenGreeting,
  proactiveInsights: [],
  dismissInsight: () => undefined,
  rateSatisfaction: () => undefined,
  personality: null,
  fetchDailyBriefing: async () => null,
  isLoading: false,
  error: null,
  clearError: () => undefined,
};

// ============================================================================
// PROVIDER
// ============================================================================

export function CoveriaProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [avatarPosition, setAvatarPosition] = useState<AvatarPosition | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.VOICE_ENABLED);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasSpokenGreeting, setHasSpokenGreeting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(CONFIG.STORAGE_KEYS.CHAT_MESSAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed
          .slice(-CONFIG.MAX_CHAT_MESSAGES) // Limit stored messages
          .map((m: unknown) => {
            if (!isRecord(m)) return null;
            const role = m.role === 'assistant' ? 'assistant' : 'user';
            const content = typeof m.content === 'string' ? m.content : '';
            const timestamp =
              typeof m.timestamp === 'string' || typeof m.timestamp === 'number' || m.timestamp instanceof Date
                ? new Date(m.timestamp)
                : undefined;
            const messageId = typeof m.messageId === 'string' ? m.messageId : createMessageId();

            return {
              role,
              content,
              timestamp,
              messageId,
              structuredOutput: Array.isArray(m.structuredOutput) ? (m.structuredOutput as ChatMessage['structuredOutput']) : undefined,
              satisfaction: typeof m.satisfaction === 'number' ? m.satisfaction : undefined,
            } satisfies ChatMessage;
          })
          .filter((m: ChatMessage | null): m is ChatMessage => m !== null);
      }
    } catch (e) {
      console.warn('[Coveria] Failed to restore chat:', e);
    }
    return [];
  });

  const [proactiveInsights, setProactiveInsights] = useState<ProactiveInsight[]>([]);
  const [personality, setPersonality] = useState<CoveriaPersonality | null>(null);

  // Refs
  const avatarRef = useRef<HTMLButtonElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const ttsControllerRef = useRef<AbortController | null>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((err: unknown, context: string) => {
    console.error(`[Coveria] ${context}:`, err);
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);

    // Auto-clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  /**
   * Retry logic for API requests
   */
  const retryRequest = useCallback(async <T,>(
    fn: () => Promise<T>,
    context: string,
    attempts = CONFIG.MAX_RETRY_ATTEMPTS
  ): Promise<T | null> => {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === attempts - 1) {
          handleError(err, context);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
      }
    }
    return null;
  }, [handleError]);

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.VOICE_ENABLED, voiceEnabled.toString());
    } catch (e) {
      console.warn('[Coveria] Failed to save voice setting:', e);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    try {
      // Limit messages stored
      const messagesToStore = chatMessages.slice(-CONFIG.MAX_CHAT_MESSAGES);
      sessionStorage.setItem(
        CONFIG.STORAGE_KEYS.CHAT_MESSAGES, 
        JSON.stringify(messagesToStore)
      );
    } catch (e) {
      console.warn('[Coveria] Failed to save chat:', e);
    }
  }, [chatMessages]);

  // ============================================================================
  // PROACTIVE INSIGHTS
  // ============================================================================

  const fetchInsights = useCallback(async () => {
    if (!isAuthenticated) {
      setProactiveInsights([]);
      return;
    }

    try {
      // Cancel previous request
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }

      fetchControllerRef.current = new AbortController();

      const response = await fetch('/api/ai-assistant/coveria/insights', {
        credentials: 'include',
        signal: fetchControllerRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setProactiveInsights(data.data);
        }
      }
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.warn('[Coveria] Failed to fetch insights:', err);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProactiveInsights([]);
      return;
    }

    fetchInsights();
    const interval = setInterval(fetchInsights, CONFIG.INSIGHTS_FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchInsights, isAuthenticated]);

  // ============================================================================
  // PERSONALITY
  // ============================================================================

  const fetchPersonality = useCallback(async () => {
    if (!isAuthenticated) {
      setPersonality(null);
      return;
    }

    try {
      const response = await fetch('/api/ai-assistant/coveria/intelligence-state', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.personality) {
          setPersonality(data.data.personality);
        }
      }
    } catch (err) {
      console.warn('[Coveria] Failed to fetch personality:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPersonality(null);
      return;
    }

    fetchPersonality();
    const interval = setInterval(fetchPersonality, CONFIG.PERSONALITY_FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPersonality, isAuthenticated]);

  // ============================================================================
  // AVATAR POSITION
  // ============================================================================

  const updateAvatarPosition = useCallback(() => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      setAvatarPosition({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  }, []);

  // ============================================================================
  // COVERIA PANEL CONTROLS
  // ============================================================================

  const openCoveria = useCallback(() => {
    updateAvatarPosition();
    setIsOpen(true);
    clearError();
  }, [updateAvatarPosition, clearError]);

  const closeCoveria = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleCoveria = useCallback(() => {
    if (!isOpen) {
      updateAvatarPosition();
      clearError();
    }
    setIsOpen(prev => !prev);
  }, [isOpen, updateAvatarPosition, clearError]);

  // ============================================================================
  // VOICE CONTROLS
  // ============================================================================

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => !prev);
    if (isSpeaking) {
      stopSpeaking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  const stopSpeaking = useCallback(() => {
    try {
      cancelBrowserTts();

      if (ttsControllerRef.current) {
        ttsControllerRef.current.abort();
        ttsControllerRef.current = null;
      }

      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      setIsSpeaking(false);
    } catch (err) {
      console.warn('[Coveria] Error stopping audio:', err);
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return;

    stopSpeaking();

    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    if (!canUseBrowserTts()) {
      setError('Voice playback is unavailable in this browser');
      return;
    }

    setIsSpeaking(true);

    try {
      try {
        await speakWithBrowserTts({
          text: cleanText,
          language: 'en-GB',
        });
      } catch (error) {
        console.warn('[Coveria] Browser speech synthesis failed:', error);
        setError(error instanceof Error ? error.message : 'Voice playback failed');
        ttsControllerRef.current = null;
      }
    } catch {
      // ignore
    }

    setIsSpeaking(false);
  }, [voiceEnabled, stopSpeaking]);

  // ============================================================================
  // CHAT MANAGEMENT
  // ============================================================================

  const clearChat = useCallback((greeting: string) => {
    setChatMessages([{ 
      role: 'assistant', 
      content: greeting, 
      timestamp: new Date(),
      messageId: generateMessageId(),
    }]);
    stopSpeaking();
    setHasSpokenGreeting(false);
  }, [stopSpeaking, generateMessageId]);

  // ============================================================================
  // INSIGHTS MANAGEMENT
  // ============================================================================

  const dismissInsight = useCallback(async (id: string) => {
    // Optimistically update UI
    setProactiveInsights(prev => prev.filter(i => i.id !== id));

    try {
      await retryRequest(
        async () => {
          const response = await fetch(
            `/api/ai-assistant/coveria/insights/${id}/dismiss`, 
            {
              method: 'POST',
              credentials: 'include',
            }
          );

          if (!response.ok) {
            throw new Error('Failed to dismiss insight');
          }

          return response;
        },
        'Dismiss insight'
      );
    } catch (err) {
      // Revert optimistic update on error
      console.warn('[Coveria] Failed to dismiss insight:', err);
      fetchInsights(); // Refresh to get correct state
    }
  }, [retryRequest, fetchInsights]);

  // ============================================================================
  // SATISFACTION RATING
  // ============================================================================

  const rateSatisfaction = useCallback(async (messageId: string, satisfaction: number) => {
    // Update local state immediately
    setChatMessages(prev => prev.map(msg => 
      msg.messageId === messageId ? { ...msg, satisfaction } : msg
    ));

    // Find the message and its preceding user message
    const messageIndex = chatMessages.findIndex(m => m.messageId === messageId);
    const message = messageIndex >= 0 ? chatMessages[messageIndex] : null;
    const userMessage = messageIndex > 0 ? chatMessages[messageIndex - 1] : null;

    if (message && message.role === 'assistant') {
      try {
        await retryRequest(
          async () => {
            return await apiRequest('POST', '/api/ai-assistant/coveria/record-interaction', {
              userInput: userMessage?.role === 'user' ? userMessage.content : '',
              coveriaResponse: message.content,
              satisfaction,
              wasHelpful: satisfaction >= 4,
              messageId,
            });
          },
          'Record satisfaction'
        );
      } catch (err) {
        console.warn('[Coveria] Failed to record satisfaction:', err);
      }
    }
  }, [chatMessages, retryRequest]);

  // ============================================================================
  // DAILY BRIEFING
  // ============================================================================

  const fetchDailyBriefing = useCallback(async (): Promise<DailyBriefing | null> => {
    if (!isAuthenticated) {
      return null;
    }

    setIsLoading(true);

    try {
      const result = await retryRequest(
        async () => {
          const response = await fetch('/api/ai-assistant/coveria/daily-briefing', {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to fetch daily briefing');
          }

          const data = await response.json();

          if (data.success && data.data) {
            // Cache briefing
            try {
              localStorage.setItem(
                CONFIG.STORAGE_KEYS.LAST_BRIEFING,
                JSON.stringify({ data: data.data, timestamp: Date.now() })
              );
            } catch (e) {
              console.warn('[Coveria] Failed to cache briefing:', e);
            }

            return data.data;
          }

          throw new Error('Invalid briefing data');
        },
        'Fetch daily briefing'
      );

      setIsLoading(false);
      return result;

    } catch (_err) {
      setIsLoading(false);

      // Try to return cached briefing
      try {
        const cached = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_BRIEFING);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;

          // Return cached if less than 24 hours old
          if (age < 24 * 60 * 60 * 1000) {
            console.warn('[Coveria] Using cached briefing');
            return data;
          }
        }
      } catch (cacheErr) {
        console.warn('[Coveria] Failed to retrieve cached briefing:', cacheErr);
      }

      return null;
    }
  }, [isAuthenticated, retryRequest]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
    };
  }, [stopSpeaking]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue = useMemo(() => ({
    isOpen,
    openCoveria,
    closeCoveria,
    toggleCoveria,
    avatarRef,
    avatarPosition,
    updateAvatarPosition,
    voiceEnabled,
    toggleVoice,
    speak,
    isSpeaking,
    stopSpeaking,
    chatMessages,
    setChatMessages,
    clearChat,
    hasSpokenGreeting,
    setHasSpokenGreeting,
    proactiveInsights,
    dismissInsight,
    rateSatisfaction,
    personality,
    fetchDailyBriefing,
    isLoading,
    error,
    clearError,
  }), [
    isOpen,
    openCoveria,
    closeCoveria,
    toggleCoveria,
    avatarPosition,
    updateAvatarPosition,
    voiceEnabled,
    toggleVoice,
    speak,
    isSpeaking,
    stopSpeaking,
    chatMessages,
    clearChat,
    hasSpokenGreeting,
    proactiveInsights,
    dismissInsight,
    rateSatisfaction,
    personality,
    fetchDailyBriefing,
    isLoading,
    error,
    clearError,
  ]);

  return (
    <CoveriaContext.Provider value={contextValue}>
      {children}
    </CoveriaContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useCoveria() {
  const context = useContext(CoveriaContext);
  if (context === undefined) {
    console.warn("[Coveria] useCoveria called outside CoveriaProvider; using fallback context");
    return fallbackCoveriaContext;
  }
  return context;
}
