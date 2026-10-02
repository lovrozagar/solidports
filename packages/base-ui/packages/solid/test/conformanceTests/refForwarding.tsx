import { expect } from 'vitest';
import type { Component } from 'solid-js';
import type {
  BaseUiConformanceTestsOptions,
  ConformantComponentProps,
} from '../describeConformance';

async function verifyRef(
  element: Component<ConformantComponentProps>,
  render: BaseUiConformanceTestsOptions['render'],
  onRef: (instance: unknown, element: HTMLElement | null) => void,
) {
  // Solid compiles `let el; <Part ref={el} />` to a ref callback, so parts receive a function.
  let instance: unknown = null;
  const props = {
    ref: (el: unknown) => {
      instance = el;
    },
  };

  const { container } = render(element, props);

  onRef(instance, container);
}

export function testRefForwarding(
  element: Component<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  describe('ref', () => {
    it(`attaches the ref`, async () => {
      const { render, refInstanceof } = getOptions();

      await verifyRef(element, render, (instance) => {
        expect(instance).to.be.instanceof(refInstanceof);
      });
    });
  });
}
