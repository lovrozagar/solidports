import { render } from '@solidjs/testing-library';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import { SolidStore } from '../store/SolidStoreV2';
import {
  createInitialPopupStoreState,
  PopupStoreContext,
  PopupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  useTriggerRegistration,
} from '.';

function createStore() {
  const [state, setState] = createInitialPopupStoreState();
  return SolidStore<PopupStoreState<unknown>, PopupStoreContext<unknown>, PopupStoreSelectors>(
    [state, setState],
    {
      floatingRootContext: getEmptyRootContext(),
      onOpenChangeComplete: undefined,
      popupRef: { current: null },
      triggerElements: new PopupTriggerMap(),
    },
  );
}

function TestTrigger(props: {
  id: string;
  store: SolidStore<PopupStoreState<unknown>, PopupStoreContext<unknown>, PopupStoreSelectors>;
  element: HTMLElement;
  repeat?: number;
}) {
  const repeat = () => props.repeat ?? 1;
  const register = useTriggerRegistration({
    get id() {
      return props.id;
    },
    get store() {
      return props.store;
    },
  });

  createEffect(() => {
    for (let i = 0; i < repeat(); i += 1) {
      register(props.element);
    }
    onCleanup(() => {
      register(null);
    });
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
  it('registers and unregisters triggers through the context map', () => {
    const store = createStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');

    const { unmount } = render(() => (
      <TestTrigger id="trigger" store={store} element={element} repeat={3} />
    ));

    expect(store.context.triggerElements.getById('trigger')).toBe(element);
    expect(store.context.triggerElements.hasElement(element)).toBe(true);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('trigger')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
  });

  it('re-registers when the trigger id changes without notifying the store', () => {
    const store = createStore();
    const spy = vi.spyOn(store, 'set');
    const element = document.createElement('button');

    const [id, setId] = createSignal('first');
    const { unmount } = render(() => <TestTrigger id={id()} store={store} element={element} />);

    expect(store.context.triggerElements.getById('first')).toBe(element);
    expect(spy).not.toHaveBeenCalled();

    setId('second');

    expect(store.context.triggerElements.getById('first')).toBeUndefined();
    expect(store.context.triggerElements.getById('second')).toBe(element);
    expect(spy).not.toHaveBeenCalled();

    unmount();
    expect(store.context.triggerElements.getById('second')).toBeUndefined();
    expect(store.context.triggerElements.hasElement(element)).toBe(false);
  });
});
