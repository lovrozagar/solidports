import { createUniqueId } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { MaybeAccessor } from '../solid-helpers';
import { useId } from './useId';

/**
 * Wraps `useId` and prefixes generated `id`s with `base-ui-`
 * @param {string | undefined} idOverride overrides the generated id when provided
 * @returns {string | undefined}
 */
export function useBaseUiId(
  idOverride?: MaybeAccessor<string | false | undefined>,
): Accessor<string | undefined> {
  const id = useId(idOverride, 'base-ui');
  return id;
}

/**
 * `useBaseUiId()`'s generated id as a string, for a model that keeps it in a field: the same id,
 * taken in the same order (hydration ids stay aligned), with no accessor to allocate.
 */
export function createBaseUiId(): string {
  return `base-ui-${createUniqueId()}`;
}
