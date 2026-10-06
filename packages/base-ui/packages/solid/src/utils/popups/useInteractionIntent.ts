import { createOwner, createSignal, flush, getOwner, runWithOwner, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { createLayoutEffect } from '../../solid-helpers';
import type { PopupStoreContext } from './store';

// Every event a popup's interactions handle on a trigger.
const INTENT_EVENTS = [
  'pointerenter',
  'pointerdown',
  'mouseenter',
  'mousedown',
  'mousemove',
  'mouseleave',
  'click',
  'keydown',
  'focus',
  'blur',
  'touchstart',
] as const;
const INTENT_OPTIONS = { capture: true, passive: true };

// One capture listener per event type and document, shared by every trigger waiting for its first
// intent: a trigger registers a callback instead of adding 11 listeners of its own. The document's
// capture phase runs before the trigger's own listeners, so the interactions an intent creates
// still receive the event that created them.
const intentCallbacks = new WeakMap<EventTarget, Set<() => void>>();
const listeningDocuments = new WeakSet<Document>();
let pendingTargets = 0;

function onDocumentIntent(event: Event) {
  if (pendingTargets === 0) {
    return;
  }
  for (const node of event.composedPath()) {
    const callbacks = intentCallbacks.get(node);
    if (callbacks) {
      for (const callback of [...callbacks]) {
        callback();
      }
    }
  }
}

function listenForIntent(target: Element, onIntent: () => void) {
  const doc = target.ownerDocument;
  if (!listeningDocuments.has(doc)) {
    listeningDocuments.add(doc);
    for (const type of INTENT_EVENTS) {
      doc.addEventListener(type, onDocumentIntent, INTENT_OPTIONS);
    }
  }
  let callbacks = intentCallbacks.get(target);
  if (!callbacks) {
    callbacks = new Set();
    intentCallbacks.set(target, callbacks);
    pendingTargets += 1;
  }
  callbacks.add(onIntent);
  return () => {
    const current = intentCallbacks.get(target);
    if (current?.delete(onIntent) && current.size === 0) {
      intentCallbacks.delete(target);
      pendingTargets -= 1;
    }
  };
}

/**
 * Defers a closed popup's interactions (hooks whose closed-state output is handlers and
 * listeners): `create` runs once, when `needed` turns true or on the first intent that
 * `activate` is called for, and its result is kept afterwards. React mounts these hooks up front.
 */
export function useDeferredInteractions<T>(create: () => T, needed: Accessor<boolean>) {
  const owner = getOwner();
  const [interactions, setInteractions] = createSignal<T | undefined>(undefined, {
    ownedWrite: true,
  });

  function activate() {
    if (untrack(interactions) !== undefined) {
      return;
    }
    // The server never creates these, so they live in a scope with its own id: the owner's other
    // children keep the hydration ids the server assigned.
    const scope = runWithOwner(owner, () =>
      createOwner({ id: owner?.id == null ? undefined : `${owner.id}-interactions` }),
    );
    const created = runWithOwner(scope, create);
    setInteractions(() => created);
  }

  createLayoutEffect(needed, (isNeeded) => {
    if (isNeeded) {
      activate();
    }
  });

  return {
    interactions,
    /** Creates the interactions for an intent event and applies them before the event continues. */
    activateOnIntent() {
      activate();
      if (getOwner() === null) {
        flush();
      }
    },
  };
}

/**
 * Creates a trigger's deferred interactions on its first intent. The listeners run in the capture
 * phase at the trigger, before its own listeners, so the handlers and listeners the interactions
 * add still receive the event that created them. They are removed once the interactions exist.
 */
export function useTriggerInteractions<T>(
  create: () => T,
  element: Accessor<Element | null | undefined>,
  needed: Accessor<boolean>,
): Accessor<T | undefined> {
  const { interactions, activateOnIntent } = useDeferredInteractions(create, needed);
  createLayoutEffect(
    () => (interactions() === undefined ? element() : null),
    (target) => (target ? listenForIntent(target, activateOnIntent) : undefined),
  );
  return interactions;
}

/**
 * The trigger side of a root's deferred interactions: the trigger's first intent creates them
 * through `store.context.activateInteractions`.
 */
export function useInteractionIntent(
  store: () => { context: PopupStoreContext<any> },
  element: Accessor<Element | null | undefined>,
) {
  createLayoutEffect(element, (target) =>
    target ? listenForIntent(target, () => store().context.activateInteractions?.()) : undefined,
  );
}
