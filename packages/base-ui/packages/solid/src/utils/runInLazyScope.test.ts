import { createOwner, createRoot, getNextChildId, getOwner, runWithOwner } from 'solid-js';
import type { Owner } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { runInLazyScope } from './runInLazyScope';

function childIds(owner: Owner, count: number) {
  return Array.from({ length: count }, () => runWithOwner(owner, () => createOwner()).id!);
}

describe('runInLazyScope', () => {
  it('leaves the owner its next hydration id', () => {
    const ids = [false, true].map((withScope) =>
      createRoot(
        () => {
          const owner = getOwner()!;
          childIds(owner, 1);
          if (withScope) {
            runInLazyScope(owner, () => childIds(getOwner()!, 3));
          }
          childIds(owner, 1);
          return getNextChildId(owner);
        },
        { id: 't' },
      ),
    );

    expect(ids[1]).toBe(ids[0]);
  });

  it('gives scopes ids that no child of the owner or of another scope takes', () => {
    const ids = createRoot(
      () => {
        const owner = getOwner()!;
        // Enough of each for multi-digit and length-prefixed child ids.
        const all = childIds(owner, 40);
        for (let index = 0; index < 40; index += 1) {
          runInLazyScope(owner, () => {
            all.push(getOwner()!.id!, ...childIds(getOwner()!, 40));
          });
        }
        return all;
      },
      { id: 't' },
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('runs under the owner itself when it has no hydration id', () => {
    createRoot(() => {
      const owner = getOwner()!;
      expect(owner.id).toBe(undefined);
      expect(runInLazyScope(owner, getOwner)).toBe(owner);
    });
  });
});
