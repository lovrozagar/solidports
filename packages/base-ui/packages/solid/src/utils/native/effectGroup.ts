/*
 * Several dependency-gated effects on one reactive node (plan 8 step 3.2). Each part keeps the
 * semantics of its own `createDepsEffect`: its apply runs on the first pass and whenever one of
 * its dependency values changes (`shallowEqual`), its previous cleanup runs before the next apply
 * and once more when the group is disposed. Parts apply in order, in the same effect pass they
 * would as separate effects created in that order, and every part's dependencies are computed in
 * the same render pass. What changes is the cost: one effect node instead of one per part.
 */
import { createEffect, onCleanup } from 'solid-js';
import { shallowEqual } from '../../solid-helpers';

export interface EffectGroupPart<T> {
  /** Reads the part's dependencies (tracked). */
  deps: () => T;
  /** Runs when the dependencies changed; may return a cleanup. */
  apply: (deps: T) => (() => void) | void | undefined;
}

export function createEffectGroup(parts: readonly EffectGroupPart<any>[]): void {
  const count = parts.length;
  const previous: unknown[] = new Array(count);
  const cleanups: Array<(() => void) | void | undefined> = new Array(count);
  let applied = false;
  // The group's node: a fresh array per pass so the apply always runs; each part gates itself.
  createEffect(
    () => {
      const values: unknown[] = new Array(count);
      for (let i = 0; i < count; i += 1) {
        values[i] = parts[i].deps();
      }
      return values;
    },
    (values) => {
      for (let i = 0; i < count; i += 1) {
        const next = values[i];
        if (applied && shallowEqual(previous[i], next)) {
          continue;
        }
        previous[i] = next;
        const cleanup = cleanups[i];
        cleanups[i] = undefined;
        cleanup?.();
        cleanups[i] = parts[i].apply(next);
      }
      applied = true;
    },
  );
  onCleanup(() => {
    for (let i = 0; i < count; i += 1) {
      const cleanup = cleanups[i];
      cleanups[i] = undefined;
      cleanup?.();
    }
  });
}
