/*
 * Conditional rendering for native parts: the part returns an accessor the
 * parent's insert tracks, so the condition costs no node of its own (`<Show>` is a condition memo
 * plus a children memo). The branch lives in a root owned by the part, created when the condition
 * turns true and disposed when it turns false (the branch's cleanups run then, as a `Show`
 * branch's do) or with the part.
 */
import { createMemo, createRoot, runWithOwner, untrack } from 'solid-js';
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
        branch = runWithOwner(owner, () => createRoot((dispose) => ({ dispose, value: render() })));
      } else {
        branch?.dispose();
        branch = undefined;
      }
    }
    return branch?.value;
  };
}

/**
 * `createNativeConditional` for a part that is a class: the part extends this, keeps its inputs
 * as fields and implements `shouldRender` and `render`, and returns `accessor()`. A closed part
 * then holds one object and the one accessor its parent tracks, not a closure per input and the
 * scope they keep.
 */
export abstract class NativeConditional<T> {
  declare protected readonly owner: Owner | null;
  declare private shown: boolean;
  declare private branch: { dispose: () => void; value: T } | undefined;

  constructor(owner: Owner | null) {
    this.owner = owner;
    this.shown = false;
    this.branch = undefined;
  }

  /** Whether the branch renders; read by the parent's insert, so it tracks what it reads. */
  abstract shouldRender(): boolean;

  /** The branch, created in a root of its own owned by the part. */
  abstract render(): T;

  /** The accessor the parent's insert tracks. */
  accessor(): () => T | undefined {
    return this.read.bind(this);
  }

  private read(): T | undefined {
    const show = this.shouldRender();
    if (show !== this.shown) {
      this.shown = show;
      if (show) {
        this.branch = runWithOwner(this.owner, () =>
          createRoot((dispose) => ({ dispose, value: this.render() })),
        );
      } else {
        this.branch?.dispose();
        this.branch = undefined;
      }
    }
    return this.branch?.value;
  }
}

/**
 * A branch that renders nothing (hooks only, such as a popup root's interactions), created in one
 * memo when `when` turns true and disposed when it turns false. Unlike `createNativeConditional`,
 * the branch is created in the memo phase, where a `Show` creates its children, not by the parent's
 * insert in the render-effect phase: its effects and listeners then exist in the same flush as
 * before. One node, where a `Show` takes four. The branch lives in a root owned by `owner`.
 */
export function createConditionalBranch(
  owner: Owner | null,
  when: () => boolean,
  render: () => unknown,
): () => undefined {
  let dispose: (() => void) | undefined;
  return createMemo(() => {
    if (when()) {
      dispose ??= runWithOwner(owner, () =>
        createRoot((disposeRoot) => {
          untrack(render);
          return disposeRoot;
        }),
      );
    } else if (dispose) {
      dispose();
      dispose = undefined;
    }
    return undefined;
  });
}
