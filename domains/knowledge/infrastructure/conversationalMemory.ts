/**
 * Conversational Memory Service
 * 
 * Maintains conversation context across multiple queries in a session.
 * Enables follow-up questions like "Tell me more about that" or "What about the costs?"
 * 
 * Benefits:
 * - Natural multi-turn conversations
 * - Context-aware responses
 * - Better follow-up question handling
 */

import { logger } from '@platform/logging/Logger';

const log = logger.service('ConversationalMemory');

export interface ConversationTurn {
  id: string;
  query: string;
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    relevance: number;
  }>;
  timestamp: Date;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  turns: ConversationTurn[];
  topics: string[];
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

export interface ContextualQuery {
  originalQuery: string;
  contextualizedQuery: string;
  referencedTurns: string[];
  isFollowUp: boolean;
}

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS_PER_SESSION = 20;
const MAX_CONTEXT_TOKENS = 2000;

export class ConversationalMemoryService {
  private sessions: Map<string, ConversationContext> = new Map();

  /**
   * Get or create a conversation session
   */
  getSession(sessionId: string, userId: string): ConversationContext {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        userId,
        turns: [],
        topics: [],
        lastActivity: new Date(),
      };
      this.sessions.set(sessionId, session);
      log.debug('Created new session', { sessionId });
    }
    
    session.lastActivity = new Date();
    return session;
  }

  /**
   * Add a conversation turn to the session
   */
  addTurn(
    sessionId: string,
    userId: string,
    query: string,
    answer: string,
    sources: ConversationTurn['sources']
  ): ConversationTurn {
    const session = this.getSession(sessionId, userId);
    
    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query,
      answer,
      sources,
      timestamp: new Date(),
    };
    
    session.turns.push(turn);
    
    // Extract and update topics
    const newTopics = this.extractTopics(query, answer);
    session.topics = Array.from(new Set([...session.topics, ...newTopics])).slice(-10);
    
    // Limit turns to prevent memory bloat
    if (session.turns.length > MAX_TURNS_PER_SESSION) {
      session.turns = session.turns.slice(-MAX_TURNS_PER_SESSION);
    }
    
    log.debug('Added turn to session', { sessionId, totalTurns: session.turns.length });
    
    this.cleanupStaleSessions();
    
    return turn;
  }

  /**
   * Contextualize a query based on conversation history
   */
  contextualizeQuery(sessionId: string, userId: string, query: string): ContextualQuery {
    const session = this.getSession(sessionId, userId);
    
    // Check if this appears to be a follow-up question
    const isFollowUp = this.isFollowUpQuery(query, session);
    
    if (!isFollowUp || session.turns.length === 0) {
      return {
        originalQuery: query,
        contextualizedQuery: query,
        referencedTurns: [],
        isFollowUp: false,
      };
    }

    log.debug('Detected follow-up query, contextualizing');

    // Build contextualized query
    const recentTurns = session.turns.slice(-3);
    const referencedTurns = recentTurns.map(t => t.id);
    
    // Create context summary
    const _contextSummary = recentTurns
      .map(t => `Q: ${t.query}\nA: ${this.truncateText(t.answer, 200)}`)
      .join('\n\n');

    // Resolve pronouns and references
    const contextualizedQuery = this.resolveReferences(query, recentTurns);

    return {
      originalQuery: query,
      contextualizedQuery,
      referencedTurns,
      isFollowUp: true,
    };
  }

  /**
   * Get conversation context for RAG prompt
   */
  getContextForPrompt(sessionId: string, userId: string, maxTokens: number = MAX_CONTEXT_TOKENS): string {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.turns.length === 0) {
      return '';
    }

    // Build context string, most recent first
    const contextParts: string[] = [];
    let estimatedTokens = 0;
    
    for (let i = session.turns.length - 1; i >= 0 && estimatedTokens < maxTokens; i--) {
      const turn = session.turns[i]!;
      const turnText = `Previous Q: ${turn.query}\nPrevious A: ${this.truncateText(turn.answer, 300)}`;
      const turnTokens = Math.ceil(turnText.length / 4);
      
      if (estimatedTokens + turnTokens <= maxTokens) {
        contextParts.unshift(turnText);
        estimatedTokens += turnTokens;
      } else {
        break;
      }
    }

    if (contextParts.length === 0) {
      return '';
    }

    return `=== Conversation History ===\n${contextParts.join('\n\n')}\n=== End History ===\n\n`;
  }

  /**
   * Get recent topics from the conversation
   */
  getRecentTopics(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session?.topics || [];
  }

  /**
   * Get source documents referenced in the conversation
   */
  getReferencedDocuments(sessionId: string): Array<{ documentId: string; filename: string; mentions: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const docCounts = new Map<string, { filename: string; count: number }>();
    
    for (const turn of session.turns) {
      for (const source of turn.sources) {
        const existing = docCounts.get(source.documentId);
        if (existing) {
          existing.count++;
        } else {
          docCounts.set(source.documentId, { filename: source.filename, count: 1 });
        }
      }
    }

    return Array.from(docCounts.entries())
      .map(([documentId, { filename, count }]) => ({ documentId, filename, mentions: count }))
      .sort((a, b) => b.mentions - a.mentions);
  }

  /**
   * Clear a session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    log.debug('Cleared session', { sessionId });
  }

  /**
   * Check if a query appears to be a follow-up
   */
  private isFollowUpQuery(query: string, session: ConversationContext): boolean {
    if (session.turns.length === 0) return false;
    
    const lowerQuery = query.toLowerCase();
    
    // Check for explicit reference words
    const referencePatterns = [
      /\b(that|this|it|they|them|those|these)\b/,
      /\b(more|also|another|further|additionally)\b/,
      /\b(same|previous|mentioned|above|earlier)\b/,
      /\b(what about|how about|and the|regarding)\b/,
      /^(why|how|when|where|who)\s/,
      /\?$/,
    ];
    
    for (const pattern of referencePatterns) {
      if (pattern.test(lowerQuery)) {
        return true;
      }
    }
    
    // Check if query is very short (likely a follow-up)
    if (query.split(' ').length <= 5) {
      return true;
    }
    
    // Check topic overlap with recent turns
    const queryTopics = this.extractTopics(query, '');
    const recentTopics = session.turns.slice(-3).flatMap(t => this.extractTopics(t.query, t.answer));
    const overlap = queryTopics.filter(t => recentTopics.includes(t));
    
    return overlap.length > 0;
  }

  /**
   * Resolve pronoun references in a query
   */
  private resolveReferences(query: string, recentTurns: ConversationTurn[]): string {
    if (recentTurns.length === 0) return query;
    
    const lastTurn = recentTurns[recentTurns.length - 1]!;
    const lastTopics = this.extractTopics(lastTurn.query, lastTurn.answer);
    
    let resolved = query;
    
    // Replace common pronouns with context
    if (lastTopics.length > 0) {
      const mainTopic = lastTopics[0]!;
      
      // Simple pronoun resolution
      resolved = resolved
        .replace(/\b(it|this|that)\b/gi, mainTopic)
        .replace(/\bthey\b/gi, `the ${mainTopic}`)
        .replace(/\bthem\b/gi, `the ${mainTopic}`);
    }
    
    // Add context prefix if query is very short
    if (query.split(' ').length <= 3 && lastTurn) {
      resolved = `Regarding "${lastTurn.query.slice(0, 50)}": ${resolved}`;
    }
    
    return resolved;
  }

  /**
   * Extract key topics from text
   */
  private extractTopics(query: string, answer: string): string[] {
    const text = `${query} ${answer}`.toLowerCase();
    
    // Common government/business terms to look for
    const topicPatterns = [
      /\b(project|demand|request|approval|budget|cost|timeline)\b/g,
      /\b(policy|procedure|standard|guideline|regulation)\b/g,
      /\b(department|ministry|agency|organization)\b/g,
      /\b(digital|transformation|innovation|technology)\b/g,
      /\b(roi|benefit|risk|impact|assessment)\b/g,
      /\b(vendor|contractor|supplier|procurement)\b/g,
      /\b(uae|emirates|federal|government)\b/g,
    ];
    
    const topics = new Set<string>();
    
    for (const pattern of topicPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(m => topics.add(m));
      }
    }
    
    return Array.from(topics);
  }

  /**
   * Truncate text to a maximum length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  /**
   * Clean up expired sessions
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastActivity.getTime() > SESSION_TTL) {
        this.sessions.delete(sessionId);
        log.debug('Cleaned up stale session', { sessionId });
      }
    }
  }
}

export const conversationalMemoryService = new ConversationalMemoryService();
