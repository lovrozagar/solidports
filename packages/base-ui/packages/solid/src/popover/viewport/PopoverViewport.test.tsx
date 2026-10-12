import {
  act,
  createRenderer,
  describeConformance,
  isJSDOM,
  viewportConformanceTests,
} from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { For, omit } from 'solid-js';

describe('<Popover.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node(props!)}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'click',
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        {(data) => (
          <>
            <For each={props.triggers}>
              {(trigger) => <Popover.Trigger {...omit(trigger, 'key')} />}
            </For>
            <Popover.Portal {...props.portal}>
              <Popover.Positioner {...props.positioner}>
                <Popover.Popup {...props.popup}>
                  <Popover.Viewport {...props.viewport}>
                    {props.renderContent(() => data.payload)}
                  </Popover.Viewport>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </>
        )}
      </Popover.Root>
    ),
  });
});
