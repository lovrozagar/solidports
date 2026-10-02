import { expect, test, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { act, flushMicrotasks } from '#test-utils';
import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStoreV2';
import type { UseFloatingReturn, VirtualElement } from '../types';
import { useBaseUIFloating, useFloating } from './useFloating';

function createRootStore(floatingElement: HTMLElement) {
  return FloatingRootStore({
    open: true,
    transitionStatus: undefined,
    referenceElement: document.createElement('button'),
    floatingElement,
    triggerElements: new PopupTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

function Test(props: { rootContext: FloatingRootStore }) {
  useFloating({
    get rootContext() {
      return props.rootContext;
    },
  });
  return null;
}

function BaseUITest(props: {
  rootContext: FloatingRootStore;
  onRender(value: UseFloatingReturn): void;
}) {
  const floating = useBaseUIFloating({
    get rootContext() {
      return props.rootContext;
    },
  });
  props.onRender(floating);

  return (
    <>
      <button data-testid="reference" ref={floating.refs.setReference} />
      <div data-testid="floating" ref={floating.refs.setFloating} />
    </>
  );
}

test('preserves an externally synced floating element when the root context changes', async () => {
  const firstFloatingElement = document.createElement('div');
  const secondFloatingElement = document.createElement('div');
  const firstStore = createRootStore(firstFloatingElement);
  const secondStore = createRootStore(secondFloatingElement);
  const [rootContext, setRootContext] = createSignal(firstStore);

  render(() => <Test rootContext={rootContext()} />);
  await flushMicrotasks();

  expect(firstStore.state.floatingElement).toBe(firstFloatingElement);

  act(() => setRootContext(secondStore));
  await flushMicrotasks();

  expect(secondStore.state.floatingElement).toBe(secondFloatingElement);
});

// Solid: refs and elements are accessors rather than ref objects and values.
test('uses the supplied root store while preserving DOM and position references', async () => {
  const store = createRootStore(document.createElement('div'));
  let floating: UseFloatingReturn | undefined;

  render(() => (
    <BaseUITest
      rootContext={store}
      onRender={(value) => {
        floating = value;
      }}
    />
  ));

  const referenceElement = screen.getByTestId('reference');
  const floatingElement = screen.getByTestId('floating');

  expect(floating?.refs.floating()).toBe(floatingElement);
  expect(floating?.context.rootStore).toBe(store);
  expect(floating?.context.dataRef).toBe(store.context.dataRef);
  expect(floating?.context.events).toBe(store.context.events);

  await flushMicrotasks();

  expect(store.state.referenceElement).toBe(referenceElement);
  expect(store.state.domReferenceElement).toBe(referenceElement);
  expect(store.state.floatingElement).toBe(floatingElement);

  const positionReference: VirtualElement = {
    getBoundingClientRect: () => new DOMRect(1, 2, 3, 4),
  };

  act(() => {
    floating?.refs.setPositionReference(positionReference);
  });

  expect(floating?.refs.reference()).toBe(positionReference);
  expect(floating?.elements.reference()).toBe(positionReference);
  expect(store.state.referenceElement).toBe(referenceElement);
  expect(store.state.domReferenceElement).toBe(referenceElement);
  expect(floating?.refs.domReference()).toBe(referenceElement);
});
