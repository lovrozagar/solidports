/*
 * Id registration for native parts (plan 8 step 3.2): a panel or trigger publishes its `id` prop
 * to its root (`setPanelIdState`, `setTriggerId`) and clears it on unmount, as the slow path's
 * `createDepsRenderEffect(registeredId, …)`. A static id is written from the element's ref (the
 * root reads the registration only while the element is rendered) and cleared from the part's
 * cleanup: no reactive node. A reactive id keeps the memo + render effect.
 */
import { createMemo, isDisposed, isStatic, onCleanup, untrack } from 'solid-js';
import type { Owner, Setter } from 'solid-js';
import { createLayoutEffect, shallowEqual } from '../../solid-helpers';

type IdSetter = Setter<string | null | undefined>;

function apply(setId: IdSetter, registered: string | undefined) {
  setId((currentId) => registered ?? (currentId === null ? undefined : currentId));
  return () => {
    setId((currentId) => (currentId === registered ? null : currentId));
  };
}

/**
 * Registers `props[key]` (an empty string counts as absent) with `setId` for the part's lifetime.
 * Returns the ref that performs a static registration (to attach to the element), or `undefined`
 * when a reactive id is registered from an effect.
 */
export function createIdRegistration(
  props: object,
  key: string,
  setId: IdSetter,
  /** The registry's owner: when it is disposed with the part, the unmount write has no reader. */
  registryOwner?: Owner | null,
): ((element: Element | null) => void) | undefined {
  const read = () => ((props as Record<string, string | undefined>)[key] || undefined) as
    | string
    | undefined;
  if (!(key in props) || isStatic(props, key)) {
    const registered = untrack(read);
    onCleanup(() => {
      if (registryOwner && isDisposed(registryOwner)) {
        return;
      }
      setId((currentId) => (currentId === registered ? null : currentId));
    });
    return (element) => {
      if (element) {
        setId((currentId) => registered ?? (currentId === null ? undefined : currentId));
      }
    };
  }
  createLayoutEffect(createMemo(read, { equals: shallowEqual }), (value) => apply(setId, value));
  return undefined;
}
