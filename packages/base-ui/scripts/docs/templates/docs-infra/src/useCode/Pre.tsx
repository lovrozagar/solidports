// docs-infra's `useCode/Pre`, kept by hand for Solid: the read-only code view. Every element is
// created where it is placed (`renderHast` in the frame that shows it), so the server and the
// client key it alike; the decoded tree and the per-frame highlighting swap in once mounted.
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onSettled,
  Show,
  untrack,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Element as HastElement, ElementContent, Root as HastRoot, RootContent } from 'hast';
import type { VariantSource } from '../CodeHighlighter/types';
import type { FallbackNode } from '../CodeHighlighter/fallbackFormat';
import { fallbackToHast, fallbackIsHighlighted } from '../CodeHighlighter/fallbackFormat';
import { frameFallbackFromSpans } from '../pipeline/hastUtils';
import { stripHighlightingSpans } from '../pipeline/hastUtils/stripHighlightingSpans';
import { renderHast } from '../pipeline/hastToSolid';
import { decodeHastSource } from '../pipeline/loadIsomorphicCodeVariant/decodeHastSource';
import {
  resolveCollapsedFrameType,
  getInitialVisibleFrames,
} from '../pipeline/parseSource/frameVisibility';
import { isFrameSpan } from '../pipeline/parseSource/isFrameSpan';
import { getSourceLineCounts } from './sourceLineCounts';
import type { SourceLineCounts } from './sourceLineCounts';
import { subscribeToggleNudge } from './subscribeToggleNudge';

type VisibleFrames = { [index: number]: boolean };

function resolveFrameTypeAttribute(
  frameType: string | undefined,
  collapseToEmpty: boolean,
): string | undefined {
  const resolved = resolveCollapsedFrameType(frameType, collapseToEmpty);
  return resolved && resolved !== 'normal' ? resolved : undefined;
}

/** A frame's code: highlighted, or its plain fallback (same lines, so the height holds). */
function renderFrameCode(frame: HastElement, highlighted: boolean): JSX.Element {
  if (highlighted) {
    return renderHast({ type: 'root', children: frame.children });
  }
  const fallback = frame.data?.fallback as ElementContent[] | undefined;
  return renderHast({
    type: 'root',
    children: fallback ?? frameFallbackFromSpans(frame.children),
  });
}

export interface PreProps {
  children: VariantSource;
  class?: string;
  language?: string;
  /** Whether the highlighting shows (`CodeHighlighter`'s `highlightAfter`). */
  shouldHighlight?: boolean;
  /** How far outside the viewport a frame starts rendering highlighted. */
  hydrateMargin?: string;
  fallback?: FallbackNode[];
  /** Line metadata for a source whose decoded tree is not in hand yet. */
  fallbackLineCounts?: SourceLineCounts | null;
  /**
   * Collapse the block to an empty window until expanded: every collapsed-visible frame type
   * becomes its hidden equivalent and the focused-line count is 0.
   */
  collapseToEmpty?: boolean;
}

export function Pre(props: PreProps): JSX.Element {
  const collapseToEmpty = () => props.collapseToEmpty ?? false;
  // When the first paint's fallback is already highlighted (`highlightAfter: 'init'`), paint it
  // and decode the full tree once mounted; otherwise decode right away, so a plain fallback never
  // flashes before the highlighted tree.
  const deferInitialDecode = untrack(
    () =>
      props.shouldHighlight === true &&
      !!props.fallback &&
      fallbackIsHighlighted(props.fallback) &&
      typeof props.children !== 'string',
  );
  const [decodeAllowed, setDecodeAllowed] = createSignal(!deferInitialDecode);
  const hast = createMemo<HastRoot | null>(() => {
    if (!props.children || typeof props.children === 'string' || !decodeAllowed()) {
      return null;
    }
    return decodeHastSource(props.children, props.fallback) ?? null;
  });

  const [visibleFrames, setVisibleFrames] = createSignal<VisibleFrames>(
    untrack(() => getInitialVisibleFrames(hast(), collapseToEmpty())),
  );
  // A new tree adds its initially visible frames to those already shown (never drops any).
  createEffect(
    () => getInitialVisibleFrames(hast(), collapseToEmpty()),
    (initial) => {
      setVisibleFrames((previous) => {
        let merged: VisibleFrames | undefined;
        for (const key of Object.keys(initial)) {
          const index = Number(key);
          if (previous[index] !== true) {
            merged ??= { ...previous };
            merged[index] = true;
          }
        }
        return merged ?? previous;
      });
    },
  );

  let pre: HTMLPreElement | undefined;
  const frameIndices = new WeakMap<Element, number>();
  const observedFrames = new Set<Element>();
  let observer: IntersectionObserver | null = null;

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    setVisibleFrames((previous) => {
      let next: VisibleFrames | undefined;
      for (const entry of entries) {
        const index = frameIndices.get(entry.target);
        if (index === undefined) {
          continue;
        }
        // Frames hidden by a CSS collapse can report intersecting with a zero-area rect.
        const rect = entry.intersectionRect;
        const visible = entry.isIntersecting && rect.width > 0 && rect.height > 0;
        if (visible && previous[index] !== true) {
          next ??= { ...previous };
          next[index] = true;
        } else if (!visible && previous[index]) {
          next ??= { ...previous };
          delete next[index];
        }
      }
      return next ?? previous;
    });
  };

  // Re-observe every frame so the observer re-evaluates clipping after a layout change it does
  // not see itself (a collapse animation, a <details> toggle, a tab swap).
  const nudgeFrameObserver = () => {
    for (const frame of Array.from(observedFrames)) {
      if (!frame.isConnected) {
        observedFrames.delete(frame);
        observer?.unobserve(frame);
        continue;
      }
      observer?.unobserve(frame);
      observer?.observe(frame);
    }
  };

  // React reads a frame's index from its position among the `.frame` siblings; Solid runs a ref
  // before the element is inserted, so the index comes from the decoded tree instead.
  const observeFrame = (node: HTMLSpanElement, index: number) => {
    frameIndices.set(node, index);
    observedFrames.add(node);
    observer?.observe(node);
  };
  const unobserveFrame = (node: HTMLSpanElement) => {
    observedFrames.delete(node);
    observer?.unobserve(node);
  };

  onSettled(() => {
    if (deferInitialDecode) {
      setDecodeAllowed(true);
    }
    if (!pre || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const element = pre;
    const io = new IntersectionObserver(handleIntersection, {
      rootMargin: untrack(() => props.hydrateMargin ?? '200px 0px 200px 0px'),
    });
    observer = io;
    observedFrames.forEach((frame) => io.observe(frame));
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(nudgeFrameObserver);
    ro?.observe(element);
    const unsubscribeToggle = subscribeToggleNudge(element, nudgeFrameObserver);
    return () => {
      io.disconnect();
      observer = null;
      ro?.disconnect();
      unsubscribeToggle();
    };
  });

  // The decoded tree's children, with each frame's index (data only: the elements render below).
  const children = createMemo(() => {
    let frameIndex = 0;
    return (hast()?.children ?? []).map((child) => ({
      child,
      frameIndex: child.type === 'element' && isFrameSpan(child) ? frameIndex++ : -1,
    }));
  });

  // The fallback, while the decoded tree is not in hand: a string source (highlighted later) or a
  // deferred decode. For `init` its visible frames are already highlighted.
  const fallbackRoot = createMemo<HastRoot | null>(() => {
    const frameNodes: FallbackNode[] | null =
      props.fallback ??
      (typeof props.children === 'string'
        ? [['span', 'frame', { dataFrameType: 'focus' }, props.children]]
        : null);
    if (!frameNodes) {
      return null;
    }
    const root = fallbackToHast(frameNodes);
    if (collapseToEmpty()) {
      for (const child of root.children) {
        if (child.type !== 'element' || !isFrameSpan(child)) {
          continue;
        }
        const frameType =
          typeof child.properties.dataFrameType === 'string'
            ? child.properties.dataFrameType
            : undefined;
        const resolved = resolveFrameTypeAttribute(frameType, true);
        if (resolved !== frameType) {
          if (resolved) {
            child.properties.dataFrameType = resolved;
          } else {
            delete child.properties.dataFrameType;
          }
        }
      }
    }
    return root;
  });

  const lineCounts = createMemo(() => {
    const decoded = hast();
    if (decoded) {
      return getSourceLineCounts(decoded);
    }
    return props.fallbackLineCounts ?? getSourceLineCounts(props.children);
  });
  const collapsible = createMemo(() => {
    const decoded = hast();
    return (
      (decoded
        ? getSourceLineCounts(decoded).collapsible
        : props.fallbackLineCounts?.collapsible === true) || collapseToEmpty()
    );
  });

  const renderChild = (entry: { child: RootContent; frameIndex: number }) => {
    const { child, frameIndex } = entry;
    if (child.type === 'text') {
      return child.value;
    }
    if (child.type !== 'element') {
      return null;
    }
    if (frameIndex < 0) {
      return props.shouldHighlight
        ? renderHast(child)
        : renderHast(stripHighlightingSpans({ type: 'root', children: [child] }));
    }
    const highlighted = () => Boolean(props.shouldHighlight && visibleFrames()[frameIndex]);
    const properties = child.properties;
    // A ref runs without an owner, so the frame's scope stops observing it.
    let frameNode: HTMLSpanElement | undefined;
    onCleanup(() => {
      if (frameNode) {
        unobserveFrame(frameNode);
      }
    });
    return (
      <span
        class="frame"
        data-lined={highlighted() ? '' : undefined}
        data-frame-type={resolveFrameTypeAttribute(
          properties.dataFrameType ? String(properties.dataFrameType) : undefined,
          collapseToEmpty(),
        )}
        data-frame-indent={
          properties.dataFrameIndent != null ? String(properties.dataFrameIndent) : undefined
        }
        data-frame-truncated={
          properties.dataFrameTruncated ? String(properties.dataFrameTruncated) : undefined
        }
        data-frame-description={
          properties.dataFrameDescription ? String(properties.dataFrameDescription) : undefined
        }
        data-frame-focus-target={properties.dataFrameFocusTarget != null ? '' : undefined}
        ref={(node: HTMLSpanElement) => {
          frameNode = node;
          observeFrame(node, frameIndex);
        }}
      >
        <Show when={highlighted()} fallback={renderFrameCode(child, false)}>
          {renderFrameCode(child, true)}
        </Show>
      </span>
    );
  };

  return (
    <pre ref={pre} class={props.class} spellcheck={false}>
      <code
        class={props.language ? `language-${props.language}` : undefined}
        data-collapsible={collapsible() ? '' : undefined}
        data-total-lines={lineCounts().totalLines}
        data-focused-lines={collapseToEmpty() ? 0 : lineCounts().focusedLines}
      >
        <Show when={hast()} fallback={fallbackRoot() ? renderHast(fallbackRoot()!) : null}>
          <For each={children()}>{(entry) => renderChild(entry)}</For>
        </Show>
      </code>
    </pre>
  );
}
