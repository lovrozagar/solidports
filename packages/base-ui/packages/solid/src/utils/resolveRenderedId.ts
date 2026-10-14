import { createEffect, createMemo, onCleanup, untrack } from 'solid-js';
import { access } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
import { isDomNode } from './isDomNode';

interface ResolveRenderedIdProps {
  id?: string | undefined;
  render?: unknown;
}

function renderedOwnId(render: unknown): string | undefined | false {
  if (render == null || typeof render !== 'object' || isDomNode(render)) {
    return false;
  }
  if (!Object.hasOwn(render, 'id')) {
    return false;
  }
  return (render as { id?: string | undefined }).id ?? '';
}

/**
 * Resolves an element's id using the same precedence as `useRenderElement`.
 * Returns `''` when the element renders with an explicitly empty id, which consumers must treat
 * as "no id" rather than falling back to the generated one. Render callbacks are opaque and are
 * expected to use the id passed to them.
 */
export function resolveRenderedId(props: ResolveRenderedIdProps, fallbackId: string | undefined) {
  const renderedId = renderedOwnId(props.render);
  if (renderedId !== false) {
    return renderedId;
  }
  return props.id ?? fallbackId;
}

/**
 * Resolves the element's id and returns a ref that publishes it to the owner while mounted.
 * A generated fallback is never published as an override, so removing an explicit id lets the
 * element return to the generated one.
 */
export function useRenderedId(
  props: ResolveRenderedIdProps,
  defaultId: MaybeAccessor<string | undefined>,
  setId: ((id: string | undefined) => void) | undefined,
) {
  const id = () => resolveRenderedId(props, access(defaultId));
  const registeredId = createMemo(() => {
    const fallback = access(defaultId);
    const resolved = resolveRenderedId(props, fallback);
    return resolved === fallback ? undefined : resolved;
  });

  let element: HTMLElement | null = null;
  if (setId) {
    // Solid: React re-runs the ref callback when the registered id changes; Solid calls a ref
    // once, so a changed id is republished here and released when the element's owner disposes.
    createEffect(registeredId, (registered) => {
      if (element) {
        setId(registered);
      }
    });
    void onCleanup(() => {
      if (element) {
        element = null;
        setId(undefined);
      }
    });
  }

  const ref = (nextElement: HTMLElement | null | undefined) => {
    element = nextElement ?? null;
    setId?.(element ? untrack(registeredId) : undefined);
  };

  return [id, ref] as const;
}
