import { expect, vi } from 'vitest';
import { createSignal, Show } from 'solid-js';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  waitForPositioned,
  positionerConformanceTests,
} from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';

// Solid: local copy of React's `#test-utils` helper.
function Trigger(props: Tooltip.Trigger.Props) {
  return <Tooltip.Trigger {...props} ref={props.ref} render="div" />;
}

describe('<Tooltip.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Positioner, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>{node(props!)}</Tooltip.Portal>
        </Tooltip.Root>
      ));
    },
  }));

  it('throws a descriptive error when rendered outside <Tooltip.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Positioner />)).to.throw(
        'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <Tooltip.Portal>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tooltip.Root open>
            <Tooltip.Positioner />
          </Tooltip.Root>
        )),
      ).to.throw('Base UI: <Tooltip.Portal> is missing.');
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  positionerConformanceTests({
    render,
    viewport: true,
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Trigger {...props.trigger}>Trigger</Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner {...props.positioner}>
            <Tooltip.Popup {...props.popup}>
              {props.viewport ? <Tooltip.Viewport>Popup</Tooltip.Viewport> : 'Popup'}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
  });
});
