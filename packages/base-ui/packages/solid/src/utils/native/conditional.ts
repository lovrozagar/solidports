/*
 * Conditional rendering for native parts (plan 8 step 3.2): the part returns an accessor the
 * parent's insert tracks, so the condition costs no node of its own (`<Show>` is a condition memo
 * plus a children memo). The branch lives in a root owned by the part, created when the condition
 * turns true and disposed when it turns false (the branch's cleanups run then, as a `Show`
 * branch's do) or with the part.
 */
import { createRoot, runWithOwner } from 'solid-js';
import type { Owner } from 'solid-js';

export function createNativeConditional<T>(
  owner: Owner | null,
  when: () => boolean,
  render: () => T,
): () => T | undefined {
  let shown = false;
  let branch: { dispose: () => void; value: T } | undefined;
  return () => {
    const show = when();
    if (show !== shown) {
      shown = show;
      if (show) {
        branch = runWithOwner(owner, () =>
          createRoot((dispose) => ({ dispose, value: render() })),
        );
      } else {
        branch?.dispose();
        branch = undefined;
      }
    }
    return branch?.value;
  };
}
