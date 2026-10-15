// docs-infra's `abstractCreateTypes/TypeCode`, kept by hand for Solid: the server and the client's
// first render show the links-only fallback; the highlighted code replaces it once mounted.
import { createSignal, onSettled, Show } from 'solid-js';
import type { Element as HastElement, Root as HastRoot } from 'hast';
import type { FallbackNode } from '../pipeline/hastUtils/fallbackFormat';
import { fallbackToHast } from '../pipeline/hastUtils/fallbackFormat';
import { renderHast } from '../pipeline/hastToSolid';
import { useCodeComponents } from '../useCode/CodeComponentsContext';
import { requestIdle } from '../useCoordinated/scheduleTasks';

type HighlightAt = 'hydration' | 'idle' | 'visible';

interface TypeCodeProps {
  /** JSON-serialized HAST tree (root > pre > code > children), after its enhancers ran. */
  hastJson?: string;
  /** When to replace the fallback with the fully-highlighted version. */
  highlightAt: HighlightAt;
  /** Links-only fallback (code children with highlighting spans stripped). */
  fallback?: FallbackNode[];
  /** Props for the `<code>` element (`class`, data attributes). */
  codeProps?: Record<string, unknown>;
}

/**
 * Find the children of the first `<code>` element in a parsed HAST tree.
 */
function findCodeChildren(node: HastRoot | HastElement): HastRoot['children'] | null {
  if (node.type === 'element' && node.tagName === 'code') {
    return node.children;
  }
  for (const child of node.children) {
    if (child.type === 'element') {
      const found = findCodeChildren(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/**
 * Renders a links-only fallback, then the fully syntax-highlighted version at the configured time:
 *
 * - `'hydration'`: once mounted.
 * - `'idle'`: when the browser is idle.
 * - `'visible'`: when the element enters the viewport, then when the browser is idle; the
 *   highlighted version is released again when it leaves.
 */
export function TypeCode(props: TypeCodeProps) {
  const components = useCodeComponents();
  const [hast, setHast] = createSignal<HastRoot | null>(null);
  let code: HTMLElement | undefined;

  const parse = () => {
    if (props.hastJson == null) {
      return;
    }
    try {
      const parsed = JSON.parse(props.hastJson);
      const root: HastRoot =
        parsed.type === 'root'
          ? parsed
          : { type: 'root', children: Array.isArray(parsed) ? parsed : [parsed] };
      setHast({ type: 'root', children: findCodeChildren(root) ?? root.children });
    } catch (error) {
      console.warn('Failed to parse highlighted code HAST; rendering fallback instead.', error);
    }
  };

  onSettled(() => {
    // Fall back to 'idle' when the observers are unavailable.
    const mode =
      props.highlightAt === 'visible' &&
      (typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined')
        ? 'idle'
        : props.highlightAt;
    if (mode === 'hydration') {
      parse();
      return undefined;
    }
    if (mode === 'idle' || !code) {
      return requestIdle(parse, { timeout: 2000 });
    }
    const element = code;
    let cancel: (() => void) | undefined;
    const io = new IntersectionObserver(([entry]) => {
      cancel?.();
      cancel = undefined;
      if (entry.isIntersecting) {
        cancel = requestIdle(parse, { timeout: 2000 });
      } else {
        setHast(null);
      }
    });
    io.observe(element);
    // Ancestor layout changes (tabs, accordions) and native <details> toggles (whose events do not
    // bubble) can show the element without a scroll: make the observer re-evaluate.
    const nudge = () => {
      io.unobserve(element);
      io.observe(element);
    };
    const ro = new ResizeObserver(nudge);
    ro.observe(element);
    document.addEventListener('toggle', nudge, true);
    return () => {
      cancel?.();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('toggle', nudge, true);
    };
  });

  return (
    <code {...props.codeProps} ref={code}>
      <Show
        when={hast()}
        fallback={props.fallback ? renderHast(fallbackToHast(props.fallback), components()) : null}
      >
        {(highlighted) => renderHast(highlighted(), components())}
      </Show>
    </code>
  );
}
