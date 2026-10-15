// docs-infra's `CodeHighlighterContext`, kept by hand for Solid: one object per highlighter whose
// changing fields are getters, so a reader tracks only the fields it reads.
import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Code, Fallbacks } from './types';

export interface CodeHighlighterContextType {
  readonly code?: Code;
  readonly initialCode?: Code;
  /** Each variant's demo, rendered where it is placed. */
  readonly components?: Record<string, JSX.Element>;
  readonly errors?: Record<string, string | null>;
  readonly url?: string;
  readonly deferHighlight?: boolean;
  readonly fallbacks?: Fallbacks;
  /** Whether the precomputed highlighting shows yet (`highlightAfter`). */
  readonly highlightReady?: boolean;
  readonly highlightAfter?: 'init' | 'hydration' | 'idle';
}

export const CodeHighlighterContext = createContext<CodeHighlighterContextType | undefined>(
  undefined,
);

export function useCodeHighlighterContext(): CodeHighlighterContextType {
  const context = useContext(CodeHighlighterContext);
  if (context === undefined) {
    throw new Error(
      'Base UI docs: CodeHighlighterContext is missing. `useCodeHighlighterContext` must be used within a `CodeHighlighter` component.',
    );
  }
  return context;
}

export function useCodeHighlighterContextOptional(): CodeHighlighterContextType | undefined {
  return useContext(CodeHighlighterContext);
}
