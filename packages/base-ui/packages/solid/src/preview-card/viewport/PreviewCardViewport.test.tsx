import {
  act,
  createRenderer,
  describeConformance,
  isJSDOM,
  viewportConformanceTests,
} from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { For, omit } from 'solid-js';

describe('<PreviewCard.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node(props!)}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'focus',
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        {(data) => (
          <>
            <For each={props.triggers}>
              {(trigger) => <PreviewCard.Trigger href="#" delay={0} {...omit(trigger, 'key')} />}
            </For>
            <PreviewCard.Portal {...props.portal}>
              <PreviewCard.Positioner {...props.positioner}>
                <PreviewCard.Popup {...props.popup}>
                  <PreviewCard.Viewport {...props.viewport}>
                    {props.renderContent(() => data.payload)}
                  </PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </>
        )}
      </PreviewCard.Root>
    ),
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <PreviewCard.Root open>
            <PreviewCard.Portal>
              <PreviewCard.Viewport />
            </PreviewCard.Portal>
          </PreviewCard.Root>
        )),
      ).to.throw(
        'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
