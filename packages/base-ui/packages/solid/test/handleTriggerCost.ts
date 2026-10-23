/*
 * Whole-tree cost of detached-handle triggers (regate c): a popup root with `n` triggers sharing
 * its handle, counted at mount and then after the last trigger's first intent. A per-trigger count
 * misses work a change moves between the root and its triggers (closed roots that build their
 * open-only effects on the first open read as a trigger regression there), so the cost tests hold
 * both whole-tree counts at base's.
 */
import { DEV, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

export interface HandleTreeCost {
  /** Reactive nodes the root and its triggers create at mount. */
  mount: number;
  /** `mount` plus the nodes the last trigger's first intent creates. */
  total: number;
}

/**
 * Renders `tree`, flushes, then runs `intent` on the last element `[data-testid="handle-trigger"]`
 * matches; returns the dev runtime's reactive nodes at mount and in all.
 */
export async function handleTreeCost(
  render: (ui: () => JSX.Element) => { unmount: () => void },
  tree: () => JSX.Element,
  intent: (trigger: HTMLElement) => void,
): Promise<HandleTreeCost> {
  let count = 0;
  hooks.onOwner = (owner) => {
    count += owner ? 1 : 0;
  };
  try {
    const view = render(tree);
    flush();
    const mount = count;
    const triggers = document.querySelectorAll<HTMLElement>('[data-testid="handle-trigger"]');
    intent(triggers[triggers.length - 1]);
    await Promise.resolve();
    flush();
    const total = count;
    view.unmount();
    return { mount, total };
  } finally {
    hooks.onOwner = undefined;
  }
}
