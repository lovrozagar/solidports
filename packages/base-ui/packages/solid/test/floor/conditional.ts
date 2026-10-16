/*
 * The floors' conditional rendering: the part returns an accessor the parent's insert tracks, and
 * the branch lives in a root owned by the part, created when the condition turns true and disposed
 * when it turns false. The root is what puts the branch's hydration keys at the same place on the
 * server and the client. The least plain Solid needs: no condition or children memo, as `<Show>`
 * has.
 */
import { createRoot, getOwner, runWithOwner } from 'solid-js';

export function conditional<T>(when: () => boolean, render: () => T): () => T | undefined {
  const owner = getOwner();
  let shown = false;
  let branch: { dispose: () => void; value: T } | undefined;
  return () => {
    const show = when();
    if (show !== shown) {
      shown = show;
      if (show) {
        branch = runWithOwner(owner, () => createRoot((dispose) => ({ dispose, value: render() })));
      } else {
        branch?.dispose();
        branch = undefined;
      }
    }
    return branch?.value;
  };
}
