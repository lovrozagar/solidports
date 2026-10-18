/*
 * Id registration for native parts: a panel or trigger publishes its `id` prop
 * to its root (`setPanelIdState`, `setTriggerId`) and clears it on unmount, as the slow path's
 * `createDepsRenderEffect(registeredId, …)`. A static id is written from the element's ref (the
 * root reads the registration only while the element is rendered) and cleared from the part's
 * cleanup: no reactive node. A reactive id keeps the memo + render effect, on the server too: they
 * take hydration ids, which the client's must match.
 */
import { createMemo, createSignal, isDisposed, onCleanup } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import { isServer } from '@solidjs/web';
import { isStaticKey } from './consumer';
import { createLayoutEffect, shallowEqual } from '../../solid-helpers';

type IdSetter = Setter<string | null | undefined>;

type IdRegistry = [Accessor<string | null | undefined>, IdSetter];

const SERVER_ID_REGISTRY: IdRegistry = [() => undefined, (() => undefined) as unknown as IdSetter];

/**
 * The id a part registers with its root through `createIdRegistration`: `undefined` until one
 * registers, `null` once it unmounts. Solid: the part clears its registration from an unmount
 * cleanup, so the signal allows owned writes. The server never registers (refs, cleanups and layout
 * applies do not run there) and a signal takes no hydration id, so the server shares one constant
 * pair.
 */
export function createIdRegistry(): IdRegistry {
  if (isServer) {
    return SERVER_ID_REGISTRY;
  }
  return createSignal<string | null | undefined>(undefined, { ownedWrite: true });
}

function apply(setId: IdSetter, registered: string | undefined) {
  setId((currentId) => registered ?? (currentId === null ? undefined : currentId));
  return () => {
    setId((currentId) => (currentId === registered ? null : currentId));
  };
}

/** The registration updaters of an absent id: module-level, as they capture nothing. */
const keepUnregistered = (currentId: string | null | undefined) =>
  currentId === null ? undefined : currentId;
const clearUnregistered = (currentId: string | null | undefined) =>
  currentId === undefined ? null : currentId;

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
  const fixed = !(key in props) || isStaticKey(props, key);
  // The server never calls refs and never unmounts: a static id has nothing to register.
  if (fixed && isServer) {
    return undefined;
  }
  if (fixed) {
    // A static value: read once, with nothing to track.
    const registered = ((props as Record<string, string | undefined>)[key] || undefined) as
      string | undefined;
    return registerStaticId(setId, registered, registryOwner);
  }
  registerReactiveId(props, key, setId);
  return undefined;
}

/**
 * A static id's registration: the ref registers it and the part's cleanup clears it. Its own
 * function, so only the two callbacks share a context, of these three values.
 */
function registerStaticId(
  setId: IdSetter,
  registered: string | undefined,
  registryOwner: Owner | null | undefined,
): (element: Element | null) => void {
  void onCleanup(() => {
    if (registryOwner && isDisposed(registryOwner)) {
      return;
    }
    setId(
      registered === undefined
        ? clearUnregistered
        : (currentId) => (currentId === registered ? null : currentId),
    );
  });
  return (element) => {
    if (element) {
      setId(registered === undefined ? keepUnregistered : () => registered);
    }
  };
}

function registerReactiveId(props: object, key: string, setId: IdSetter) {
  const read = () =>
    ((props as Record<string, string | undefined>)[key] || undefined) as string | undefined;
  createLayoutEffect(createMemo(read, { equals: shallowEqual }), (value) => apply(setId, value));
}
