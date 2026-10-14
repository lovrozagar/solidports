import { children, createRenderEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';

/**
 * React's `<Activity>` as the DOM sees it: in `hidden` mode its top-level elements get
 * `display: none !important`, and revealing removes it. Solid keeps a hidden subtree's state and
 * effects (React tears the effects down until the reveal), so the hidden content stays live.
 */
export function Activity(props: { mode: 'visible' | 'hidden'; children: JSX.Element }) {
  const resolved = children(() => props.children);
  createRenderEffect(
    () => [props.mode, resolved.toArray()] as const,
    ([mode, nodes]) => {
      for (const node of nodes) {
        if (node instanceof HTMLElement) {
          if (mode === 'hidden') {
            node.style.setProperty('display', 'none', 'important');
          } else {
            node.style.removeProperty('display');
          }
        }
      }
    },
  );
  return <>{resolved()}</>;
}
