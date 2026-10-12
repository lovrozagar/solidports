import { expect, test, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { act, flushMicrotasks } from '#test-utils';
import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStoreV2';
import type { UseFloatingReturn, VirtualElement } from '../types';
import { useBaseUIFloating } from './useFloating';

function Test(props: { rootContext: FloatingRootStore; onRender(value: UseFloatingReturn): void }) {
  props.onRender(
    useBaseUIFloating({
      get rootContext() {
        return props.rootContext;
      },
    }),
  );
  return null;
}

// Solid: refs and elements are accessors rather than ref objects and values.
test('uses the supplied root store while preserving DOM and position references', async () => {
  const referenceElement = document.createElement('button');
  const floatingElement = document.createElement('div');
  document.body.append(referenceElement, floatingElement);

  try {
    const store = FloatingRootStore({
      open: true,
      transitionStatus: undefined,
      referenceElement,
      floatingElement,
      triggerElements: new PopupTriggerMap(),
      floatingId: undefined,
      syncOnly: false,
      nested: false,
      onOpenChange: vi.fn(),
    });
    let floating: UseFloatingReturn | undefined;

    render(() => (
      <Test
        rootContext={store}
        onRender={(value) => {
          floating = value;
        }}
      />
    ));
    await flushMicrotasks();

    expect(floating?.context.rootStore).toBe(store);
    expect(floating?.context.dataRef).toBe(store.context.dataRef);
    expect(floating?.context.events).toBe(store.context.events);
    expect(floating?.refs.floating()).toBe(floatingElement);
    expect(floating?.refs.domReference()).toBe(referenceElement);

    const positionReference: VirtualElement = {
      getBoundingClientRect: () => new DOMRect(1, 2, 3, 4),
    };

    await act(async () => {
      floating?.refs.setPositionReference(positionReference);
    });

    expect(floating?.refs.reference()).toBe(positionReference);
    expect(floating?.elements.reference()).toBe(positionReference);
    expect(store.state.domReferenceElement).toBe(referenceElement);
    expect(floating?.refs.domReference()).toBe(referenceElement);
  } finally {
    referenceElement.remove();
    floatingElement.remove();
  }
});
