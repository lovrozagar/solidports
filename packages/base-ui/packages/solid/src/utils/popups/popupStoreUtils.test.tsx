import { describe, expect, it, vi } from 'vitest';
import { createEffect, createSignal, Show, untrack, type Setter } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { act, flushMicrotasks } from '#test-utils';
import { SolidStore } from '../store/SolidStoreV2';
import { createDepsRenderEffect } from '../../solid-helpers';
import {
  applyPopupOpenChange,
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  createPopupOpenState,
  PopupStoreContext,
  PopupStoreState,
  PopupStoreSelectors,
  PopupTriggerMap,
  popupStoreSelectors,
  useImplicitActiveTrigger,
  usePopupInteractionProps,
  useTriggerDataForwarding,
  useTriggerRegistration,
} from './';
import { useSyncedFloatingRootContext } from '../../floating-ui-solid/hooks/useSyncedFloatingRootContext';
import { createChangeEventDetails } from '../createBaseUIEventDetails';
import { REASONS } from '../reasons';
import type { BaseUIChangeEventDetails } from '../../types';

type BaseStore = SolidStore<
  PopupStoreState<unknown>,
  PopupStoreContext<unknown>,
  PopupStoreSelectors
>;

type TestStore = BaseStore & {
  setOpen: (open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void;
};

// Solid: `createInitialPopupStoreState` returns a store; tests that mutate state use a plain
// snapshot of it.
function createInitialState() {
  const [state] = createInitialPopupStoreState<unknown, PopupStoreState<unknown>>();
  return untrack(() => ({ ...state }));
}

function createStore() {
  const triggerElements = new PopupTriggerMap();
  // Solid: the floating root lives on the store context (React keeps it in state).
  const store = SolidStore<
    PopupStoreState<unknown>,
    PopupStoreContext<unknown>,
    PopupStoreSelectors
  >(
    createInitialPopupStoreState(),
    {
      triggerElements,
      popupRef: { current: null },
      floatingRootContext: createPopupFloatingRootContext(triggerElements),
      onOpenChangeComplete: undefined,
    },
    popupStoreSelectors,
  ) as TestStore;

  store.setOpen = vi.fn((open) => {
    store.set('open', open);
  });

  return store;
}

function TestTrigger(props: {
  id: string;
  store: BaseStore;
  element: HTMLElement;
  repeat?: number;
}) {
  const register = useTriggerRegistration(
    () => props.id,
    () => props.store,
  );

  // `register` is stable, so the caller owns migration by keying this effect on `[store, id]`.
  createDepsRenderEffect(
    () => [props.repeat ?? 1, props.element, props.store, props.id] as const,
    ([repeat, element]) => {
      for (let i = 0; i < repeat; i += 1) {
        register(element);
      }
      return () => {
        register(null);
      };
    },
  );

  return null;
}

function TestForwardedTrigger(props: { id: string; store: BaseStore; element: HTMLElement }) {
  const elementRef: { current: Element | null } = { current: null };
  const { registerTrigger } = useTriggerDataForwarding(
    () => props.id,
    elementRef,
    () => props.store,
    {},
  );

  createDepsRenderEffect(
    () => props.element,
    (element) => {
      elementRef.current = element;
      registerTrigger(element);
      return () => {
        registerTrigger(null);
        elementRef.current = null;
      };
    },
  );

  return null;
}

function PopupIdTest(props: {
  store: BaseStore;
  floatingId: string | undefined;
  onOpenChange(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
}) {
  useSyncedFloatingRootContext({
    popupStore: props.store,
    floatingRootContext: props.store.context.floatingRootContext,
    floatingId: () => props.floatingId,
    nested: false,
    onOpenChange: props.onOpenChange,
  });

  props.store.useState('popupId');
  return null;
}

function ImplicitActiveTriggerTest(props: { store: TestStore }) {
  useImplicitActiveTrigger(props.store);
  return null;
}

function CloseOnActiveTriggerUnmountTest(props: { store: TestStore }) {
  useImplicitActiveTrigger(props.store, { closeOnActiveTriggerUnmount: true });
  return null;
}

function HideOnLayout(props: { setVisible: Setter<boolean> }) {
  // Solid: a render effect's mount-time apply may not write signals; a user effect runs after the
  // mount flush, still after the implicit-trigger claim.
  createEffect(
    () => props.setVisible,
    (setVisible) => {
      setVisible(false);
    },
  );
  return null;
}

function ImplicitTriggerUnmountTest(props: { store: TestStore; element: HTMLElement }) {
  const [triggerVisible, setTriggerVisible] = createSignal(true);
  useImplicitActiveTrigger(props.store, { closeOnActiveTriggerUnmount: true });

  return (
    <Show when={triggerVisible()}>
      <TestTrigger id="trigger" store={props.store} element={props.element} />
      <HideOnLayout setVisible={setTriggerVisible} />
    </Show>
  );
}

function PopupInteractionPropsTest(props: {
  store: BaseStore;
  activeTriggerProps: PopupStoreState<unknown>['activeTriggerProps'];
  inactiveTriggerProps: PopupStoreState<unknown>['inactiveTriggerProps'];
  popupProps: PopupStoreState<unknown>['popupProps'];
}) {
  usePopupInteractionProps(props.store, {
    get activeTriggerProps() {
      return props.activeTriggerProps;
    },
    get inactiveTriggerProps() {
      return props.inactiveTriggerProps;
    },
    get popupProps() {
      return props.popupProps;
    },
  });

  return null;
}

describe('PopupTriggerMap', () => {
  it('stores and retrieves elements by id', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);

    expect(map.getById('trigger')).toBe(button);
    expect(map.hasElement(button)).toBe(true);
    expect(map.hasMatchingElement((element) => element === button)).toBe(true);
  });

  it('replaces a registered element when the id is reused', () => {
    const map = new PopupTriggerMap();
    const first = document.createElement('button');
    const second = document.createElement('button');

    map.add('trigger', first);
    map.add('trigger', second);

    expect(map.getById('trigger')).toBe(second);
    expect(map.hasElement(first)).toBe(false);
    expect(map.hasElement(second)).toBe(true);
  });

  it('deletes an element and no longer matches it', () => {
    const map = new PopupTriggerMap();
    const button = document.createElement('button');

    map.add('trigger', button);
    map.delete('trigger');

    expect(map.getById('trigger')).toBeUndefined();
    expect(map.hasElement(button)).toBe(false);
    expect(map.hasMatchingElement((element) => element === button)).toBe(false);
  });
});

describe('useTriggerRegistration', () => {
  it('registers and unregisters closed triggers through the context map without notifying the store', () => {
    const store = createStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');

    const { unmount } = render(() => (
      <TestTrigger id="trigger" store={store} element={element} repeat={3} />
    ));

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.context.triggerElements.hasElement(element)).toBe(true);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('re-registers closed triggers when the trigger id changes without notifying the store', () => {
    const store = createStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');
    const [id, setId] = createSignal('first');

    const { unmount } = render(() => <TestTrigger id={id()} store={store} element={element} />);

    expect(store.context.triggerElements.getById('first')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    act(() => setId('second'));

    expect(store.context.triggerElements.getById('first')).toBeUndefined();
    expect(store.context.triggerElements.getById('second')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('second')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
    expect(store.state.triggerCount).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns a stable callback that unregisters from the store it registered in', () => {
    const first = createStore();
    const second = createStore();
    const element = document.createElement('button');
    let registerRef: ((element: Element | null) => void) | null = null;
    const [currentStore, setCurrentStore] = createSignal(first);

    function Probe(props: { store: ReturnType<typeof createStore> }) {
      const register = useTriggerRegistration('trigger', () => props.store);
      registerRef = register;

      createDepsRenderEffect(
        () => props.store,
        () => {
          register(element);
          return () => register(null);
        },
      );

      return null;
    }

    const { unmount } = render(() => <Probe store={currentStore()} />);
    const initialRegister = registerRef as unknown as (element: Element | null) => void;

    expect(first.context.triggerElements.getById('trigger')).toBe(element);

    act(() => setCurrentStore(second));

    expect(registerRef).toBe(initialRegister);
    expect(first.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(second.context.triggerElements.getById('trigger')).toBe(element);

    // A retained callback from before the migration must still act on the current store.
    const replacement = document.createElement('button');
    act(() => {
      initialRegister(null);
      initialRegister(replacement);
    });

    expect(first.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(second.context.triggerElements.getById('trigger')).toBe(replacement);

    unmount();
    expect(second.context.triggerElements.getById('trigger')).toBeUndefined();
  });

  describe('callers that pass the callback straight into a ref', () => {
    // Mirrors `Drawer.SwipeArea`: the callback is merged into the rendered element's ref, and the
    // migration effect is what re-registers it when the id changes.
    function RefOnlyTrigger(props: { id: string | undefined; store: TestStore }) {
      const register = useTriggerRegistration(
        () => props.id,
        () => props.store,
      );
      const elementRef: { current: HTMLButtonElement | null } = { current: null };

      createDepsRenderEffect(
        () => [props.id, props.store],
        () => {
          register(elementRef.current);
          return () => register(null);
        },
      );

      const handleRef = (element: HTMLButtonElement | null) => {
        elementRef.current = element;
        register(element);
      };

      return <button type="button" data-testid="trigger" ref={handleRef} />;
    }

    it('registers once the id resolves after the first commit', () => {
      const store = createStore();
      const [id, setId] = createSignal<string | undefined>(undefined);

      render(() => <RefOnlyTrigger id={id()} store={store} />);
      const element = screen.getByTestId('trigger');

      expect(store.context.triggerElements.size).toBe(0);

      // React 17's `useId` fallback returns `undefined` on the first render and a real id after an
      // effect commits.
      act(() => setId('trigger'));

      expect(store.context.triggerElements.getById('trigger')).toBe(element);
      expect(store.context.triggerElements.size).toBe(1);
    });

    it('follows an id change', () => {
      const store = createStore();
      const [id, setId] = createSignal<string | undefined>('first');

      const { unmount } = render(() => <RefOnlyTrigger id={id()} store={store} />);
      const element = screen.getByTestId('trigger');

      expect(store.context.triggerElements.getById('first')).toBe(element);

      act(() => setId('second'));

      expect(store.context.triggerElements.getById('first')).toBeUndefined();
      expect(store.context.triggerElements.getById('second')).toBe(element);
      expect(store.context.triggerElements.size).toBe(1);

      unmount();
      expect(store.context.triggerElements.size).toBe(0);
    });
  });

  it('keeps triggerCount reactive while the popup is open', () => {
    const store = createStore();
    const element = document.createElement('button');
    store.set('open', true);

    const { unmount } = render(() => <TestTrigger id="trigger" store={store} element={element} />);

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.state.triggerCount).toBe(1);

    unmount();
    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.state.triggerCount).toBe(0);
  });

  it('claims the only registered trigger when a closed popup opens', () => {
    const store = createStore();
    const element = document.createElement('button');

    render(() => (
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>
    ));

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.state.triggerCount).toBe(0);
    expect(store.state.activeTriggerId).toBe(null);

    act(() => {
      store.set('open', true);
    });

    expect(store.state.triggerCount).toBe(1);
    expect(store.state.activeTriggerId).toBe('trigger');
    expect(store.state.activeTriggerElement).toBe(element);
  });

  it('closes when an implicitly claimed trigger unmounts during the claim commit', async () => {
    const store = createStore();
    const element = document.createElement('button');
    store.set('open', true);

    render(() => <ImplicitTriggerUnmountTest store={store} element={element} />);

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
  });

  it('closes when the active trigger unregisters while open', async () => {
    const store = createStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const [showFirst, setShowFirst] = createSignal(true);

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    render(() => (
      <>
        <Show when={showFirst()}>
          <TestTrigger id="first" store={store} element={first} />
        </Show>
        <TestTrigger id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>
    ));

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    act(() => setShowFirst(false));

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.state.triggerCount).toBe(0);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
  });

  it.each([
    ['a different unresolved id', 'second'],
    ['no active trigger', null],
  ] as const)(
    'keeps the popup open when ownership returns to a pending trigger after %s',
    async (_description, pendingTriggerId) => {
      const store = createStore();
      const first = document.createElement('button');
      const replacement = document.createElement('button');
      const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(first);

      store.update({
        open: true,
        activeTriggerId: 'first',
        activeTriggerElement: first,
      });

      // Solid: a keyed `Show` remounts the trigger when its element changes, as React's `key`.
      render(() => (
        <>
          <Show when={triggerElement()} keyed>
            {(element) => <TestTrigger id="first" store={store} element={element} />}
          </Show>
          <CloseOnActiveTriggerUnmountTest store={store} />
        </>
      ));

      act(() => {
        store.context.triggerElements.delete('first');
        store.update({
          activeTriggerId: pendingTriggerId,
          activeTriggerElement: null,
          triggerCount: 0,
        });
      });

      act(() => setTriggerElement(null));

      act(() => {
        store.update({
          activeTriggerId: 'first',
          activeTriggerElement: null,
        });
      });

      await flushMicrotasks();

      expect(store.state.open).toBe(true);
      expect(store.setOpen).not.toHaveBeenCalled();

      act(() => setTriggerElement(replacement));

      expect(store.context.triggerElements.getById('first')).toBe(replacement);
      expect(store.state.open).toBe(true);
      expect(store.setOpen).not.toHaveBeenCalled();
    },
  );

  it('closes when the active trigger unmounts after registering in a count-neutral commit', async () => {
    const store = createStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const [renderedTrigger, setRenderedTrigger] = createSignal<'first' | 'second' | null>('first');

    store.update({
      open: true,
      // The `activeTriggerElement` selector resolves to null while unmounted, so reflect the
      // real open-popup state for the element subscription to observe registration.
      mounted: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    render(() => (
      <>
        <Show when={renderedTrigger() === 'first'}>
          <TestForwardedTrigger id="first" store={store} element={first} />
        </Show>
        <Show when={renderedTrigger() === 'second'}>
          <TestForwardedTrigger id="second" store={store} element={second} />
        </Show>
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>
    ));

    // Ownership moves to a trigger that has not registered yet: the popup stays open (pending).
    act(() => {
      store.update({ activeTriggerId: 'second', activeTriggerElement: null });
    });

    await flushMicrotasks();

    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();

    // Swap "first" out and "second" in within one commit, so the trigger count nets out
    // unchanged and only the forwarded active trigger element reruns the reconciliation.
    act(() => setRenderedTrigger('second'));

    await flushMicrotasks();

    expect(store.context.triggerElements.getById('second')).toBe(second);
    expect(store.state.activeTriggerElement).toBe(second);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();

    // The now-registered active trigger genuinely unmounts: the popup must close.
    act(() => setRenderedTrigger(null));

    await waitFor(() => {
      expect(store.setOpen).toHaveBeenCalledTimes(1);
    });

    expect(store.setOpen).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    expect(store.state.open).toBe(false);
    expect(store.state.activeTriggerId).toBe(null);
    expect(store.state.activeTriggerElement).toBe(null);
  });

  it('keeps the popup open when the active trigger is replaced with the same id', async () => {
    const store = createStore();
    const first = document.createElement('button');
    const replacement = document.createElement('button');
    const second = document.createElement('button');
    const [firstElement, setFirstElement] = createSignal<HTMLElement>(first);

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    // Solid: a keyed `Show` remounts the trigger when its element changes, as React's `key`.
    render(() => (
      <>
        <Show when={firstElement()} keyed>
          {(element) => <TestForwardedTrigger id="first" store={store} element={element} />}
        </Show>
        <TestForwardedTrigger id="second" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>
    ));

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    act(() => setFirstElement(replacement));

    await flushMicrotasks();

    expect(store.context.triggerElements.getById('first')).toBe(replacement);
    expect(store.context.triggerElements.getById('second')).toBe(second);
    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(replacement);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('keeps the popup open when the active trigger element is registered with another id', async () => {
    const store = createStore();
    const element = document.createElement('button');
    element.id = 'dom-id';

    store.update({
      open: true,
      activeTriggerId: 'dom-id',
      activeTriggerElement: element,
    });

    render(() => (
      <>
        <TestTrigger id="registered-id" store={store} element={element} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>
    ));

    await flushMicrotasks();

    expect(store.state.triggerCount).toBe(1);
    expect(store.state.activeTriggerId).toBe('registered-id');
    expect(store.state.activeTriggerElement).toBe(element);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('reassociates the active trigger when ownership moves to another rendered-id trigger while open', async () => {
    const store = createStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    second.id = 'dom-id-2';

    store.update({
      open: true,
      activeTriggerId: 'registered-1',
      activeTriggerElement: first,
    });

    render(() => (
      <>
        <TestTrigger id="registered-1" store={store} element={first} />
        <TestTrigger id="registered-2" store={store} element={second} />
        <CloseOnActiveTriggerUnmountTest store={store} />
      </>
    ));

    await flushMicrotasks();

    expect(store.state.activeTriggerId).toBe('registered-1');

    // A handoff to the second trigger updates the active id from its DOM id (as
    // `getPopupOpenState` does), without changing `open` or `triggerCount`.
    act(() => {
      store.update({ activeTriggerId: 'dom-id-2', activeTriggerElement: second });
    });

    await flushMicrotasks();

    expect(store.state.activeTriggerId).toBe('registered-2');
    expect(store.state.activeTriggerElement).toBe(second);
    expect(store.state.open).toBe(true);
    expect(store.setOpen).not.toHaveBeenCalled();
  });

  it('preserves active trigger ownership without closing by default', async () => {
    const store = createStore();
    const first = document.createElement('button');
    const second = document.createElement('button');
    const [showFirst, setShowFirst] = createSignal(true);

    store.update({
      open: true,
      activeTriggerId: 'first',
      activeTriggerElement: first,
    });

    render(() => (
      <>
        <Show when={showFirst()}>
          <TestTrigger id="first" store={store} element={first} />
        </Show>
        <TestTrigger id="second" store={store} element={second} />
        <ImplicitActiveTriggerTest store={store} />
      </>
    ));

    expect(store.state.triggerCount).toBe(2);
    expect(store.state.activeTriggerId).toBe('first');
    expect(store.state.activeTriggerElement).toBe(first);

    act(() => setShowFirst(false));

    await waitFor(() => {
      expect(store.context.triggerElements.getById('first')).toBeUndefined();
      expect(store.context.triggerElements.getById('second')).toBe(second);
      expect(store.state.triggerCount).toBe(1);
      expect(store.state.activeTriggerId).toBe('first');
      expect(store.state.activeTriggerElement).toBe(first);
      expect(store.state.open).toBe(true);
      expect(store.setOpen).not.toHaveBeenCalled();
    });
  });

  it('resets triggerCount when the popup closes', () => {
    const store = createStore();
    const element = document.createElement('button');

    store.set('open', true);

    render(() => (
      <>
        <ImplicitActiveTriggerTest store={store} />
        <TestTrigger id="trigger" store={store} element={element} />
      </>
    ));

    expect(store.state.triggerCount).toBe(1);

    act(() => {
      store.set('open', false);
    });

    expect(store.state.triggerCount).toBe(0);
  });
});

describe('popupId selector', () => {
  it('syncs the floating id into the popup store for trigger ownership selectors', () => {
    const store = createStore();

    render(() => <PopupIdTest store={store} floatingId="popup-id" onOpenChange={vi.fn()} />);

    expect(store.state.floatingId).toBe('popup-id');
    expect(store.select('popupId')).toBe('popup-id');
  });

  it('omits popup id when the floating id is empty', () => {
    const store = createStore();

    render(() => <PopupIdTest store={store} floatingId="" onOpenChange={vi.fn()} />);

    expect(store.state.floatingId).toBe('');
    expect(store.select('popupId')).toBeUndefined();
  });

  it('prefers an explicit popup element id over the generated floating id', () => {
    const store = createStore();
    const popupElement = document.createElement('div');
    popupElement.id = 'explicit-popup-id';

    store.update({
      open: true,
      activeTriggerId: 'trigger',
      floatingId: 'generated-popup-id',
      popupElement,
    });

    expect(store.select('popupId')).toBe('explicit-popup-id');
  });
});

describe('usePopupInteractionProps', () => {
  it('clears stored interaction props when unmounting', () => {
    const store = createStore();
    const activeTriggerProps = { onClick: vi.fn() };
    const inactiveTriggerProps = { onKeyDown: vi.fn() };
    const popupProps = { onPointerDown: vi.fn() };

    const { unmount } = render(() => (
      <PopupInteractionPropsTest
        store={store}
        activeTriggerProps={activeTriggerProps}
        inactiveTriggerProps={inactiveTriggerProps}
        popupProps={popupProps}
      />
    ));

    expect(store.state.activeTriggerProps).toBe(activeTriggerProps);
    expect(store.state.inactiveTriggerProps).toBe(inactiveTriggerProps);
    expect(store.state.popupProps).toBe(popupProps);

    unmount();

    expect(store.state.activeTriggerProps).not.toBe(activeTriggerProps);
    expect(store.state.activeTriggerProps).toEqual({});
    expect(store.state.inactiveTriggerProps).not.toBe(inactiveTriggerProps);
    expect(store.state.inactiveTriggerProps).toEqual({});
    expect(store.state.popupProps).not.toBe(popupProps);
    expect(store.state.popupProps).toEqual({});
  });
});

describe('getPopupOpenState', () => {
  it('clears a previous unmount-prevention request when opening', () => {
    const state = createInitialState();
    state.preventUnmountingOnClose = true;

    const nextState = createPopupOpenState(state, true, undefined);

    expect(nextState.preventUnmountingOnClose).toBe(false);
    expect(state.preventUnmountingOnClose).toBe(true);
  });

  it('sets the unmount-prevention request when closing', () => {
    const state = createInitialState();

    const nextState = createPopupOpenState(state, false, undefined, true);

    expect(nextState.preventUnmountingOnClose).toBe(true);
  });

  it('preserves the active trigger when closing without a trigger', () => {
    const state = createInitialState();
    const trigger = document.createElement('button');
    state.activeTriggerId = 'trigger-id';
    state.activeTriggerElement = trigger;

    const nextState = createPopupOpenState(state, false, undefined);

    expect(nextState.activeTriggerId).toBe('trigger-id');
    expect(nextState.activeTriggerElement).toBe(trigger);
  });
});

describe('applyPopupOpenChange', () => {
  type OpenChangeState = PopupStoreState<unknown> & {
    instantType?: 'delay' | 'dismiss' | 'focus' | undefined;
    openChangeReason?: string;
  };
  type OpenChangeDetails = BaseUIChangeEventDetails<string> & { preventUnmountOnClose(): void };

  function createOpenChangeStore() {
    const order: string[] = [];
    const state: OpenChangeState = {
      ...createInitialState(),
      instantType: undefined,
      openChangeReason: undefined,
    };
    // Solid: the floating root lives on the store context.
    const floatingRootContext = createPopupFloatingRootContext(new PopupTriggerMap());

    const dispatchOpenChange = vi
      .spyOn(floatingRootContext, 'dispatchOpenChange')
      .mockImplementation(() => {
        order.push('dispatchOpenChange');
      });
    const onOpenChange = vi.fn((_open: boolean, _details: BaseUIChangeEventDetails<string>) => {
      order.push('onOpenChange');
    });
    const update = vi.fn(
      <const Key extends keyof OpenChangeState>(_state: Pick<OpenChangeState, Key>) => {
        order.push('update');
      },
    );

    const store = {
      context: { onOpenChange, floatingRootContext },
      state,
      update,
    };

    return { store, order, onOpenChange, dispatchOpenChange, update };
  }

  function createDetails(reason: string) {
    return createChangeEventDetails(reason) as OpenChangeDetails;
  }

  it('runs the full sequence in order when the change is not canceled', () => {
    const { store, order, onOpenChange, dispatchOpenChange, update } = createOpenChangeStore();
    const details = createDetails(REASONS.triggerFocus);
    const onBeforeDispatch = vi.fn(() => {
      order.push('onBeforeDispatch');
    });

    applyPopupOpenChange(store, true, details, {
      onBeforeDispatch,
    });

    expect(onOpenChange).toHaveBeenCalledWith(true, details);
    expect(dispatchOpenChange).toHaveBeenCalledWith(true, details);
    expect(update).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['onOpenChange', 'onBeforeDispatch', 'dispatchOpenChange', 'update']);
  });

  it('notifies onOpenChange but short-circuits before dispatch when canceled', () => {
    const { store, onOpenChange, dispatchOpenChange, update } = createOpenChangeStore();
    onOpenChange.mockImplementation((_open, details) => {
      details.cancel();
    });
    const onBeforeDispatch = vi.fn();

    applyPopupOpenChange(store, true, createDetails(REASONS.triggerPress), { onBeforeDispatch });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onBeforeDispatch).not.toHaveBeenCalled();
    expect(dispatchOpenChange).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('merges extraState into the update with `open` always reflecting nextOpen', () => {
    const { store, update } = createOpenChangeStore();

    applyPopupOpenChange(store, true, createDetails(REASONS.triggerFocus), {
      // `open: false` here must be overridden by `nextOpen` (true).
      extraState: { open: false, openChangeReason: REASONS.triggerFocus },
    });

    const updatedState = update.mock.calls[0][0];
    expect(updatedState.open).toBe(true);
    expect(updatedState.openChangeReason).toBe(REASONS.triggerFocus);
  });

  it('maps the change reason to instantType', () => {
    const focusStore = createOpenChangeStore();
    applyPopupOpenChange(focusStore.store, true, createDetails(REASONS.triggerFocus));
    expect(focusStore.update.mock.calls[0][0].instantType).toBe('focus');

    const pressStore = createOpenChangeStore();
    applyPopupOpenChange(pressStore.store, false, createDetails(REASONS.triggerPress));
    expect(pressStore.update.mock.calls[0][0].instantType).toBe('dismiss');

    const escapeStore = createOpenChangeStore();
    applyPopupOpenChange(escapeStore.store, false, createDetails(REASONS.escapeKey));
    expect(escapeStore.update.mock.calls[0][0].instantType).toBe('dismiss');

    const hoverStore = createOpenChangeStore();
    applyPopupOpenChange(hoverStore.store, true, createDetails(REASONS.triggerHover));
    const hoverState = hoverStore.update.mock.calls[0][0];
    expect('instantType' in hoverState).toBe(true);
    expect(hoverState.instantType).toBeUndefined();

    const noneStore = createOpenChangeStore();
    applyPopupOpenChange(noneStore.store, true, createDetails(REASONS.none));
    expect('instantType' in noneStore.update.mock.calls[0][0]).toBe(false);
  });
});
