import { createMemo, createUniqueId } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';

/**
 *
 * @example
 * const id = useId();
 * return <div id={id()} />;
 *
 * @param idOverride
 * @returns {string}
 */
export function useId(
  idOverride?: MaybeAccessor<string | false | undefined>,
  prefix: string = 'mui',
): Accessor<string> {
  // Generated once, as React's `useId`; an explicit string override (even `''`) wins, as `??`.
  const generatedId = `${prefix}-${createUniqueId()}`;
  // No override, or a static one: a constant accessor (no memo per part).
  if (typeof idOverride !== 'function') {
    const id = typeof idOverride === 'string' ? idOverride : generatedId;
    return () => id;
  }
  return createMemo(() => {
    const override = access(idOverride);
    return typeof override === 'string' ? override : generatedId;
  });
}
