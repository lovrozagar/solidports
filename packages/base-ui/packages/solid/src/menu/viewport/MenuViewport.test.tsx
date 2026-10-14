import {
  act,
  createRenderer,
  describeConformance,
  isJSDOM,
  viewportConformanceTests,
} from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect, vi, describe } from 'vitest';
import { For, omit } from 'solid-js';

describe('<Menu.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Menu.Root open>
          <Menu.Trigger>Trigger</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>{node(props!)}</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
    },
  }));

  viewportConformanceTests({
    render,
    openOn: 'click',
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        {(data) => (
          <>
            <For each={props.triggers}>
              {(trigger) => <Menu.Trigger {...omit(trigger, 'key')} />}
            </For>
            <Menu.Portal {...props.portal}>
              <Menu.Positioner {...props.positioner}>
                <Menu.Popup {...props.popup}>
                  <Menu.Viewport {...props.viewport}>
                    {props.renderContent(() => data.payload)}
                  </Menu.Viewport>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </>
        )}
      </Menu.Root>
    ),
  });
});
