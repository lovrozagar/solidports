import { createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { useTriggerSwitchTransition } from './useTriggerSwitchTransition';

describe('useTriggerSwitchTransition', () => {
  const { render } = createRenderer();

  it('animates a move between triggers and cancels it when the popup closes', async () => {
    const element = document.createElement('div');
    const store = createStore(true);
    const triggers = [document.createElement('button'), document.createElement('button')];
    const [open, setOpenSignal] = createSignal(true);
    const [trigger, setTrigger] = createSignal<Element | null>(null);
    const setOpen = (next: boolean) => {
      store.open = next;
      setOpenSignal(next);
    };

    render(() => {
      useTriggerSwitchTransition({
        store,
        open,
        domReference: trigger,
        positionerElement: () => element,
      });
      return null;
    });
    flush();

    setTrigger(triggers[0]!);
    flush();
    expect(store.state.instantType).toBeUndefined();

    setTrigger(triggers[0]!);
    flush();
    expect(store.sets).toEqual([]);

    setTrigger(triggers[1]!);
    flush();
    expect(store.sets).toContain(undefined);
    expect(store.state.instantType).toBe('trigger-change');

    store.state.instantType = 'dismiss';
    setOpen(true);
    flush();
    setOpen(false);
    flush();
    expect(store.state.instantType).toBe('dismiss');

    setOpen(true);
    flush();
    store.state.instantType = 'trigger-change';
    setOpen(false);
    flush();
    expect(store.state.instantType).toBeUndefined();

    store.open = true;
    store.set = (_key, value) => {
      store.sets.push(value);
      store.state.instantType = value;
      if (value === undefined) {
        store.open = false;
      }
    };
    setTrigger(triggers[0]!);
    flush();
    expect(store.state.instantType).not.toBe('trigger-change');
  });

  it('does not animate a trigger change while the popup is closed, and ignores a missing positioner', () => {
    const store = createStore(false);
    let setTrigger: (trigger: Element | null) => void = () => {};

    render(() => {
      const [trigger, setTriggerSignal] = createSignal<Element | null>(null, { ownedWrite: true });
      setTrigger = setTriggerSignal;
      useTriggerSwitchTransition({
        store,
        open: () => true,
        domReference: trigger,
        positionerElement: () => null,
      });
      return null;
    });
    flush();

    store.state.instantType = 'dismiss';
    setTrigger(document.createElement('button'));
    flush();
    setTrigger(null);
    flush();
    setTrigger(document.createElement('button'));
    flush();
    expect(store.state.instantType).toBe('dismiss');
  });
});

// Mutable on purpose: the tests write `state.instantType` directly. It still satisfies
// `TriggerSwitchStore` where the hook receives it.
function createStore(open: boolean) {
  const store = {
    open,
    sets: [] as Array<string | undefined>,
    state: { instantType: undefined as string | undefined },
    set(_key: 'instantType', value: 'trigger-change' | undefined) {
      store.sets.push(value);
      store.state.instantType = value;
    },
    select(key: 'open') {
      expect(key).toBe('open');
      return store.open;
    },
  };
  return store;
}
