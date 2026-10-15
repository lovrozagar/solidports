import { createEffect, createMemo, createSignal, merge, untrack } from 'solid-js';
import { createLayoutEffect } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import EditorImport from 'docs/react-simple-code-editor/src/index';
import type { EditableSourceProjection, HastRoot } from '../CodeHighlighter/types';
import { useGrammarsReady } from '../CodeHighlighter/useGrammarsReady';
import { useCodeContext, useDemandSourceParser } from '../CodeProvider/CodeContext';
import { hastToJsx } from '../pipeline/hastUtils';
import { resolveGrammarScope } from '../pipeline/parseSource/grammarMaps';
import { stripLeadingPerLine } from './stripLeadingPerLine';
import type { SetSource } from './useSourceEditing';

type EditorComponent = typeof EditorImport;
function resolveEditor(
  editor:
    | EditorComponent
    | {
        default: EditorComponent;
      },
): EditorComponent {
  return 'default' in editor ? editor.default : editor;
}
const Editor = resolveEditor(EditorImport);
export interface CodeEditorProps {
  source: string;
  sourceProjection?: EditableSourceProjection;
  expanded?: boolean;
  fileName?: string;
  displayFileName?: string;
  language?: string;
  class?: string;
  fallback?: JSX.Element;
  setSource: SetSource;
  onActivate?: () => void;
  onBoundary?: () => void;
  onExit?: () => void;
  onReady?: (textarea: HTMLTextAreaElement) => void;
}
function getEditorValue(
  source: string,
  sourceProjection: EditableSourceProjection | undefined,
  expanded: boolean,
): string {
  if (expanded || !sourceProjection) {
    return source;
  }
  const indentationLength = sourceProjection.indentation?.length ?? 0;
  return stripLeadingPerLine(sourceProjection.source, indentationLength, indentationLength);
}
function restoreProjectionIndentation(source: string, indentation: string | undefined): string {
  if (!indentation) {
    return source;
  }
  return `${indentation}${source.replaceAll('\n', `\n${indentation}`)}`;
}
function toCanonicalProjectionOffset(
  source: string,
  offset: number,
  indentation: string | undefined,
): number {
  if (!indentation) {
    return offset;
  }
  let lineCount = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === '\n') {
      lineCount += 1;
    }
  }
  return offset + lineCount * indentation.length;
}
function getCaretLine(
  source: string,
  position: number,
): {
  content: string;
  line: number;
} {
  let line = 0;
  let lineStart = 0;
  for (let index = 0; index < position; index += 1) {
    if (source[index] === '\n') {
      line += 1;
      lineStart = index + 1;
    }
  }
  return {
    content: source.slice(lineStart, position),
    line,
  };
}
function validateProjection(
  source: string,
  sourceProjection: EditableSourceProjection | undefined,
): EditableSourceProjection | undefined {
  if (
    !sourceProjection ||
    sourceProjection.start < 0 ||
    sourceProjection.end < sourceProjection.start ||
    sourceProjection.end > source.length ||
    source.slice(sourceProjection.start, sourceProjection.end) !== sourceProjection.source
  ) {
    return undefined;
  }
  return sourceProjection;
}

/** Textarea editor adapter with projection patching and asynchronous highlighting. */
export function CodeEditor(_props: CodeEditorProps) {
  const props = merge(
    {
      expanded: false,
    },
    _props,
  );
  const _useCodeContext = useCodeContext();
  const _useCodeContext2 = createMemo(() => {
    const { ensureParseSourceWorker, loadSourceParser, parseSource, parseSourceAsync } =
      _useCodeContext();
    return {
      ensureParseSourceWorker,
      loadSourceParser,
      parseSource,
      parseSourceAsync,
    };
  });
  const parseFileName = createMemo(() => props.displayFileName ?? props.fileName ?? 'code.txt');
  const grammarScope = createMemo(() => resolveGrammarScope(parseFileName(), props.language));
  const grammarScopes = createMemo(() => {
    const _grammarScope = grammarScope();
    return _grammarScope ? [_grammarScope] : [];
  });
  const grammarsReady = useGrammarsReady(grammarScopes, () =>
    Boolean(_useCodeContext2().loadSourceParser),
  );
  useDemandSourceParser(
    () => _useCodeContext2().loadSourceParser,
    () => !_useCodeContext2().parseSource,
  );
  const editableProjection = createMemo(() =>
    validateProjection(props.source, props.sourceProjection),
  );
  const [value, setValue] = createSignal(() =>
    untrack(() => getEditorValue(props.source, editableProjection(), props.expanded)),
  );
  const deferredValue = createMemo(() => value());
  const [highlighted, setHighlighted] = createSignal<{
    source: string;
    fileName: string;
    language: string | undefined;
    hast: HastRoot;
  } | null>(null);
  const highlightedNode = createMemo(() => {
    const _highlighted = highlighted();
    return _highlighted ? hastToJsx(_highlighted.hast) : null;
  });
  const rootRef: {
    current: HTMLDivElement | null;
  } = {
    current: null,
  };
  const _editableProjection = untrack(editableProjection);
  const prefixRef = {
    current: _editableProjection
      ? untrack(() => props.source).slice(0, _editableProjection.start)
      : '',
  };
  const _editableProjection2 = untrack(editableProjection);
  const suffixRef = {
    current: _editableProjection2
      ? untrack(() => props.source).slice(_editableProjection2.end)
      : '',
  };
  const lastEmittedSourceRef: {
    current: string | null;
  } = {
    current: null,
  };
  const previousIdentityRef = {
    current: {
      fileName: untrack(() => props.fileName),
      displayFileName: untrack(() => props.displayFileName),
      expanded: untrack(() => props.expanded),
      sourceProjection: untrack(editableProjection),
    },
  };
  createLayoutEffect(
    () => [props.fileName, props.onReady],
    () => {
      const textarea = rootRef.current?.querySelector('textarea');
      if (!textarea) {
        return;
      }
      textarea.tabIndex = -1;
      textarea.setAttribute('aria-label', props.fileName ? `Edit ${props.fileName}` : 'Edit code');
      props.onReady?.(textarea);
    },
  );
  createEffect(
    () => [
      props.source,
      editableProjection(),
      props.expanded,
      props.fileName,
      props.displayFileName,
    ],
    () => {
      const previous = previousIdentityRef.current;
      const identityChanged =
        previous.fileName !== props.fileName ||
        previous.displayFileName !== props.displayFileName ||
        previous.expanded !== props.expanded ||
        previous.sourceProjection !== editableProjection();
      previousIdentityRef.current = {
        fileName: props.fileName,
        displayFileName: props.displayFileName,
        expanded: props.expanded,
        sourceProjection: editableProjection(),
      };
      if (!identityChanged && props.source === lastEmittedSourceRef.current) {
        return;
      }
      const _editableProjection3 = editableProjection();
      prefixRef.current = _editableProjection3
        ? props.source.slice(0, _editableProjection3.start)
        : '';
      const _editableProjection4 = editableProjection();
      suffixRef.current = _editableProjection4 ? props.source.slice(_editableProjection4.end) : '';
      setValue(getEditorValue(props.source, editableProjection(), props.expanded));
    },
  );
  createEffect(
    () => [
      deferredValue(),
      parseFileName(),
      props.language,
      grammarScope(),
      grammarsReady(),
      _useCodeContext2().ensureParseSourceWorker,
      _useCodeContext2().parseSource,
      _useCodeContext2().parseSourceAsync,
    ],
    () => {
      const _parseSourceAsync = _useCodeContext2().parseSourceAsync;
      const _parseSource = _useCodeContext2().parseSource;
      if ((!_parseSourceAsync && !_parseSource) || !grammarsReady()) {
        return undefined;
      }
      const abortController = new AbortController();
      const _grammarScope2 = grammarScope();
      const _ensureParseSourceWorker = _useCodeContext2().ensureParseSourceWorker;
      const _deferredValue = deferredValue();
      const _parseFileName = parseFileName();
      const highlight = async () => {
        try {
          if (_grammarScope2) {
            await _ensureParseSourceWorker?.([_grammarScope2]);
          }
          let hast: HastRoot;
          if (_parseSourceAsync) {
            hast = await _parseSourceAsync(
              _deferredValue,
              _parseFileName,
              props.language,
              abortController.signal,
            );
          } else if (_parseSource) {
            hast = _parseSource(_deferredValue, _parseFileName, props.language);
          } else {
            return;
          }
          if (!abortController.signal.aborted) {
            (() => {
              setHighlighted({
                source: _deferredValue,
                fileName: _parseFileName,
                language: props.language,
                hast,
              });
            })();
          }
        } catch {
          // Keep the editor usable as plain text if highlighting fails.
        }
      };
      void highlight();
      return () => abortController.abort();
    },
  );
  const handleValueChange = (nextValue: string) => {
    setValue(nextValue);
    const indentation = !props.expanded ? editableProjection()?.indentation : undefined;
    const canonicalValue = restoreProjectionIndentation(nextValue, indentation);
    const nextSource =
      !props.expanded && editableProjection()
        ? `${prefixRef.current}${canonicalValue}${suffixRef.current}`
        : canonicalValue;
    lastEmittedSourceRef.current = nextSource;
    const textarea = rootRef.current?.querySelector('textarea');
    const selectionStart = textarea?.selectionStart ?? nextValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const canonicalSelectionStart = toCanonicalProjectionOffset(
      nextValue,
      selectionStart,
      indentation,
    );
    const canonicalSelectionEnd = toCanonicalProjectionOffset(nextValue, selectionEnd, indentation);
    const sourcePosition =
      !props.expanded && editableProjection()
        ? prefixRef.current.length + canonicalSelectionStart
        : canonicalSelectionStart;
    const caretLine = getCaretLine(nextSource, sourcePosition);
    (() => {
      const _editableProjection5 = editableProjection();
      props.setSource(
        nextSource,
        props.fileName,
        {
          position: sourcePosition,
          extent: canonicalSelectionEnd - canonicalSelectionStart,
          ...caretLine,
        },
        undefined,
        !props.expanded && _editableProjection5
          ? {
              source: canonicalValue,
              start: _editableProjection5.start,
              end: _editableProjection5.start + canonicalValue.length,
              indentation: _editableProjection5.indentation,
            }
          : undefined,
      );
    })();
  };
  const handleKeyDown = (
    event: KeyboardEvent & {
      currentTarget: HTMLElement;
      target: Element;
    },
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onExit?.();
      return;
    }
    if (
      props.expanded ||
      !editableProjection() ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return;
    }
    const textarea = rootRef.current?.querySelector('textarea');
    if (!textarea || textarea.selectionStart !== textarea.selectionEnd) {
      return;
    }
    const atStart = textarea.selectionStart === 0;
    const atEnd = textarea.selectionEnd === textarea.value.length;
    if (
      ((event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') &&
        atStart) ||
      ((event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown') &&
        atEnd)
    ) {
      props.onBoundary?.();
    }
  };
  const parserPending = createMemo(
    () => !_useCodeContext2().parseSource && Boolean(_useCodeContext2().loadSourceParser),
  );
  const grammarPending = createMemo(() =>
    Boolean(_useCodeContext2().parseSource && grammarScope() && !grammarsReady()),
  );
  const _render = createMemo(() => {
    if (props.fallback && (parserPending() || grammarPending())) {
      return props.fallback;
    }
    return (
      <div
        ref={(element) => {
          rootRef.current = element;
        }}
        class="editable-code-editor"
      >
        <Editor
          value={value()}
          onValueChange={handleValueChange}
          highlight={(currentValue) => {
            let content: JSX.Element;
            const _highlighted2 = highlighted();
            const _parseFileName2 = parseFileName();
            const _parseSource2 = _useCodeContext2().parseSource;
            if (
              _highlighted2?.source === currentValue &&
              _highlighted2.fileName === _parseFileName2 &&
              _highlighted2.language === props.language
            ) {
              content = highlightedNode();
            } else if (_parseSource2 && grammarsReady()) {
              content = hastToJsx(_parseSource2(currentValue, _parseFileName2, props.language));
            } else {
              content = currentValue;
            }
            return (
              <code class={props.language ? `language-${props.language}` : undefined}>
                {content}
              </code>
            );
          }}
          tabSize={2}
          insertSpaces
          preClassName={props.class}
          textareaClassName="editable-code-textarea"
          onFocus={props.onActivate}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  });
  return <>{_render()}</>;
}
