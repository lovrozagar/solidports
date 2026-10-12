import { isElement } from '@floating-ui/utils/dom';
import { createMemo, createSignal, untrack } from 'solid-js';
import { createDepsEffect, live } from '../../src/solid-helpers';
import { mergeProps as solidMergeProps } from '../../src/solid-1-compat';
import { useBaseUIFloating } from '../../src/floating-ui-solid/hooks/useFloating';
import { useFloatingRootContext } from '../../src/floating-ui-solid/hooks/useFloatingRootContext';
import type {
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
} from '../../src/floating-ui-solid/types';

/**
 * Floating UI's public `useFloating`: `refs.setReference` and `refs.setFloating` also register the
 * elements in the root store. Base UI components hand their elements to the store directly, so
 * only the ported Floating UI tests use this.
 */
export function useFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
  const internalStore = useFloatingRootContext(options);
  const rootContext = live(createMemo(() => options.rootContext || internalStore));

  const [localDomReference, setLocalDomReference] = createSignal<
    NarrowedElement<ReferenceType> | null | undefined
  >(undefined);
  // `undefined` keeps the store's floating element, as in React.
  const [localFloatingElement, setLocalFloatingElement] = createSignal<
    HTMLElement | null | undefined
  >(undefined);

  // React's three `useSyncedValue` calls: each key is written only when its own value changes.
  // A store swapped in keeps its own reference until this hook has one: writing `null` over it
  // only discards the reference the new store's owner synced.
  createDepsEffect(
    () => ({ store: rootContext(), local: localDomReference() }),
    ({ store, local }, prev) => {
      if (local === undefined && prev !== undefined && prev.store !== store) {
        return;
      }
      store.set('referenceElement', local ?? null);
    },
  );

  // With no local reference, React writes the store's own value back (a no-op). Solid would write
  // the value committed when the effect computed, over a newer one written in the same flush.
  createDepsEffect(
    () => ({ store: rootContext(), local: localDomReference() }),
    ({ store, local }) => {
      if (local !== undefined) {
        store.set('domReferenceElement', isElement(local) ? (local as Element) : null);
      }
    },
  );

  createDepsEffect(
    () => ({ store: rootContext(), value: localFloatingElement() }),
    ({ store, value }) => {
      if (value !== undefined) {
        store.set('floatingElement', value);
      }
    },
  );

  const floating = useBaseUIFloating(
    solidMergeProps(options, {
      get rootContext() {
        return rootContext();
      },
    }),
  );
  const baseRefs = floating.refs;

  const setReference = (node: ReferenceType | null | undefined) => {
    if (isElement(node) || node == null) {
      setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
    }

    // Backwards-compatibility for passing a virtual element to `reference`
    // after it has set the DOM reference.
    // A ref setter: read the current reference without subscribing.
    const reference = untrack(baseRefs.reference);
    if (
      isElement(reference) ||
      reference == null ||
      // Don't allow setting virtual elements using the old technique back to
      // `null` to support `positionReference` + an unstable `reference`
      // callback ref.
      (node != null && !isElement(node))
    ) {
      baseRefs.setReference(node);
    }
  };

  const setFloating = (node: HTMLElement | null | undefined) => {
    setLocalFloatingElement(node);
    baseRefs.setFloating(node);
  };

  const refs = solidMergeProps(baseRefs, { setReference, setFloating });
  const context = solidMergeProps(floating.context, { refs });

  return solidMergeProps(floating, { refs, context }) as UseFloatingReturn;
}
