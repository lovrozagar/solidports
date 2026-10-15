// docs-infra's `CodeHighlighter`, kept by hand for Solid. The docs precompute every code block and
// demo at build time (docs-infra's loaders), so this renders precomputed code only: no client
// loading, parsing, transforms, enhancing or editing.
import { createComponent, createSignal, merge, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CodeHighlighterProps, ContentProps } from './types';
import { CodeHighlighterContext } from './CodeHighlighterContext';
import type { CodeHighlighterContextType } from './CodeHighlighterContext';
import { resolveFallbackCritical } from './resolveFallbackCritical';
import { requestIdle } from '../useCoordinated/scheduleTasks';

// How long an `idle` highlight waits for the browser to go idle before it shows anyway.
const IDLE_SWAP_TIMEOUT_MS = 10_000;

/**
 * Renders `Content` with precomputed code. The highlighting shows from the first render
 * (`highlightAfter: 'init'`), once mounted (`'hydration'`), or once the browser is idle (`'idle'`,
 * the default); until then `Content` renders the plain fallback the loader built.
 */
export function CodeHighlighter<T extends {}>(props: CodeHighlighterProps<T>): JSX.Element {
  const precompute = untrack(() => props.precompute);
  if (!precompute || typeof precompute !== 'object') {
    throw new Error(
      `Base UI docs: CodeHighlighter got no precomputed code${props.url ? ` for ${props.url}` : ''}. ` +
        'The Solid docs render precomputed code only: precompute it with docs-infra\'s loaders ' +
        '(`loadPrecomputedCodeHighlighter` for demos, `transformHtmlCodeBlock` for code blocks).',
    );
  }
  const highlightAfter = untrack(() =>
    props.highlightAfter === 'stream' ? 'init' : (props.highlightAfter ?? 'idle'),
  );
  const collapseToEmpty = untrack(
    () =>
      props.collapseToEmpty ??
      (props.contentProps as { collapseToEmpty?: boolean } | undefined)?.collapseToEmpty ??
      false,
  );
  // `init` shows the highlighted visible frames (`fallbackCritical`) in the first render.
  const code = resolveFallbackCritical(precompute, highlightAfter, collapseToEmpty);

  const [highlightReady, setHighlightReady] = createSignal(highlightAfter === 'init');
  onSettled(() => {
    if (highlightAfter === 'hydration') {
      setHighlightReady(true);
      return undefined;
    }
    if (highlightAfter === 'idle') {
      return requestIdle(() => setHighlightReady(true), { timeout: IDLE_SWAP_TIMEOUT_MS });
    }
    return undefined;
  });

  const context: CodeHighlighterContextType = {
    code,
    initialCode: code,
    get components() {
      return props.components;
    },
    get url() {
      return props.url;
    },
    deferHighlight: false,
    get highlightReady() {
      return highlightReady();
    },
    highlightAfter,
  };

  const contentProps = merge(
    () => props.contentProps ?? {},
    {
      code,
      get components() {
        return props.components;
      },
      get name() {
        return props.name;
      },
      get slug() {
        return props.slug;
      },
      get url() {
        return props.url;
      },
      get variantType() {
        return props.variantType;
      },
    },
    () => ({
      ...(props.collapseToEmpty !== undefined && { collapseToEmpty: props.collapseToEmpty }),
      ...(props.initialExpanded !== undefined && { initialExpanded: props.initialExpanded }),
      ...(props.initialDisabled !== undefined && { initialDisabled: props.initialDisabled }),
    }),
  ) as ContentProps<T>;

  return (
    <CodeHighlighterContext value={context}>
      {createComponent(props.Content, contentProps)}
    </CodeHighlighterContext>
  );
}
