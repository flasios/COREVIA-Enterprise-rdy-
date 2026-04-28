export interface Violation {
  file: string;
  line: number;
  snippet: string;
  message: string;
}

export interface Rule {
  pattern: RegExp;
  message: string;
  allow?: (relativePath: string, match: string, content: string) => boolean;
}

export function collectFiles(
  root: string,
  directories: string[],
  extensions?: Set<string>,
): string[];

export function normalizeRelative(root: string, filePath: string): string;

export function findMatches(
  root: string,
  directories: string[],
  rules: Rule[],
): Violation[];

export function reportAndExit(label: string, violations: Violation[]): void;

export function createPlaceholderRules(scopeName: string): Rule[];
