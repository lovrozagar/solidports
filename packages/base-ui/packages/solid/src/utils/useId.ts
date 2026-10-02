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
  const id = createMemo(() => {
    const override = access(idOverride);
    return (typeof override === 'string' && override) || `${prefix}-${createUniqueId()}`;
  });
  return id;
}
