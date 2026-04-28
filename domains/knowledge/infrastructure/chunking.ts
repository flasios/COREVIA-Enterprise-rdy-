import { logger } from "@platform/logging/Logger";
import { encoding_for_model } from 'tiktoken';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: {
    startPosition: number;
    endPosition: number;
    overlapWithPrevious?: boolean;
    overlapWithNext?: boolean;
  };
}

interface ChunkingState {
  chunks: TextChunk[];
  currentChunk: string;
  currentPosition: number;
  chunkIndex: number;
}

export class ChunkingService {
  private readonly MIN_CHUNK_TOKENS = 200;
  private readonly MAX_CHUNK_TOKENS = 4000; // Well under 8192 limit for embeddings
  private readonly OVERLAP_TOKENS = 50;
  private readonly tokenizer;
  
  constructor() {
    this.tokenizer = encoding_for_model('gpt-4');
  }

  private async finalizeCurrentChunk(state: ChunkingState): Promise<ChunkingState> {
    const chunk = await this.createChunk(
      state.currentChunk,
      state.chunkIndex,
      state.currentPosition,
      state.chunkIndex > 0
    );

    return {
      ...state,
      chunks: [...state.chunks, chunk],
    };
  }

  private advanceWithOverlap(state: ChunkingState, nextContent: string): ChunkingState {
    const overlap = this.getOverlapByTokens(state.currentChunk);
    const currentChunk = overlap + nextContent;

    return {
      ...state,
      currentChunk,
      currentPosition: state.currentPosition + currentChunk.length - overlap.length,
      chunkIndex: state.chunkIndex + 1,
    };
  }

  private async splitOversizedSentenceGroup(text: string, state: ChunkingState): Promise<ChunkingState> {
    const subChunks = this.splitByTokenLimit(text, this.MAX_CHUNK_TOKENS);
    const chunks = [...state.chunks];
    let currentPosition = state.currentPosition;
    let chunkIndex = state.chunkIndex;

    for (const subChunk of subChunks) {
      const chunk = await this.createChunk(
        subChunk,
        chunkIndex,
        currentPosition,
        chunkIndex > 0
      );
      chunks.push(chunk);
      currentPosition += subChunk.length;
      chunkIndex++;
    }

    return {
      chunks,
      currentChunk: '',
      currentPosition,
      chunkIndex,
    };
  }

  private async appendSentence(sentence: string, state: ChunkingState): Promise<ChunkingState> {
    const testWithSentence = state.currentChunk ? `${state.currentChunk} ${sentence}` : sentence;
    const sentenceTokens = this.countTokens(testWithSentence);
    const currentTokens = this.countTokens(state.currentChunk);

    if (sentenceTokens > this.MAX_CHUNK_TOKENS && currentTokens >= this.MIN_CHUNK_TOKENS) {
      const flushedState = await this.finalizeCurrentChunk(state);
      return this.advanceWithOverlap(flushedState, sentence);
    }

    if (sentenceTokens > this.MAX_CHUNK_TOKENS) {
      return this.splitOversizedSentenceGroup(testWithSentence, state);
    }

    return {
      ...state,
      currentChunk: testWithSentence,
    };
  }

  private async appendOversizedParagraph(paragraph: string, state: ChunkingState): Promise<ChunkingState> {
    let nextState = state;
    for (const sentence of this.splitIntoSentences(paragraph)) {
      nextState = await this.appendSentence(sentence, nextState);
    }
    return nextState;
  }

  private async appendParagraph(paragraph: string, state: ChunkingState): Promise<ChunkingState> {
    const testChunk = state.currentChunk ? `${state.currentChunk}\n\n${paragraph}` : paragraph;
    const testTokens = this.countTokens(testChunk);

    if (testTokens <= this.MAX_CHUNK_TOKENS) {
      return {
        ...state,
        currentChunk: testChunk,
      };
    }

    if (state.currentChunk.length > 0) {
      const flushedState = await this.finalizeCurrentChunk(state);
      return this.appendParagraph(paragraph, this.advanceWithOverlap(flushedState, paragraph));
    }

    return this.appendOversizedParagraph(paragraph, state);
  }
  
  async chunkText(text: string): Promise<TextChunk[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot chunk empty text');
    }

    let state: ChunkingState = {
      chunks: [],
      currentChunk: '',
      currentPosition: 0,
      chunkIndex: 0,
    };

    for (const paragraph of this.splitIntoParagraphs(text)) {
      state = await this.appendParagraph(paragraph, state);
    }

    if (state.currentChunk.trim().length > 0) {
      state = await this.finalizeCurrentChunk(state);
    }

    return state.chunks;
  }
  
  private splitByTokenLimit(text: string, maxTokens: number): string[] {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= maxTokens) {
      return [text];
    }
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < tokens.length) {
      const end = Math.min(start + maxTokens, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      const decoded = this.tokenizer.decode(chunkTokens);
      chunks.push(new TextDecoder().decode(decoded));
      start = end;
    }
    
    return chunks;
  }
  
  private async createChunk(
    content: string,
    index: number,
    startPosition: number,
    hasOverlap: boolean
  ): Promise<TextChunk> {
    const trimmedContent = content.trim();
    const tokenCount = this.countTokens(trimmedContent);
    
    return {
      chunkIndex: index,
      content: trimmedContent,
      tokenCount,
      metadata: {
        startPosition,
        endPosition: startPosition + trimmedContent.length,
        overlapWithPrevious: hasOverlap,
        overlapWithNext: false,
      },
    };
  }
  
  private getOverlapByTokens(text: string): string {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= this.OVERLAP_TOKENS) {
      return text;
    }
    
    const overlapTokens = tokens.slice(-this.OVERLAP_TOKENS);
    const decoded = this.tokenizer.decode(overlapTokens);
    const overlapText = new TextDecoder().decode(decoded);
    
    const sentenceEnd = overlapText.lastIndexOf('. ');
    if (sentenceEnd > overlapText.length / 2) {
      return overlapText.slice(sentenceEnd + 2);
    }
    
    const wordBoundary = overlapText.lastIndexOf(' ');
    if (wordBoundary > overlapText.length / 2) {
      return overlapText.slice(wordBoundary + 1);
    }
    
    return overlapText;
  }
  
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
  
  private splitIntoSentences(text: string): string[] {
    const sentenceEndings = /([.!?])\s+/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceEndings.exec(text)) !== null) {
      sentences.push(text.slice(lastIndex, match.index + 1).trim());
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      sentences.push(text.slice(lastIndex).trim());
    }
    
    return sentences.filter(s => s.length > 0);
  }
  
  private countTokens(text: string): number {
    try {
      const tokens = this.tokenizer.encode(text);
      return tokens.length;
    } catch (error) {
      logger.error('Token counting error:', error);
      return Math.ceil(text.length / 4);
    }
  }
  
  free() {
    if (this.tokenizer) {
      this.tokenizer.free();
    }
  }
}

export const chunkingService = new ChunkingService();
