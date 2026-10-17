/*
 * The parent of a list of slow-path parts tracks one source per row (plan 3, leaf 4.3d). The parent
 * resolves each row's output through every accessor layer it returns, subscribing to each: a
 * render-function Toggle returned its own `<Show>`, the `enabled` `<Show>` and the branch memo (3
 * per row), a part whose `render` can change rendered its tag through `<Dynamic>` (2), and a part
 * returning `<>{element()}</>` added a memo (a grouped Toggle's CompositeItem: 3). 1000 rows made
 * the dev build's HUGE_FAN_IN warning fire.
 */
import { DEV, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Button } from '@solidports/base-ui/button';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { useRender } from '@solidports/base-ui/use-render';
import { createRenderer } from '#test-utils';

type Node = object;
const dev = DEV as unknown as {
  hooks: { onOwner?: ((owner: Node) => void) | undefined };
  getSources: (node: Node) => Node[];
};

const ROWS = 100;
const rows = Array.from({ length: ROWS }, (_, index) => index);

/** The most sources any computation created by `run` tracks. */
function widestFanIn(run: () => void) {
  const owners: Node[] = [];
  dev.hooks.onOwner = (owner) => owners.push(owner);
  try {
    run();
  } finally {
    dev.hooks.onOwner = undefined;
  }
  return Math.max(0, ...owners.map((owner) => dev.getSources(owner).length));
}

describe('useRenderElement: a list parent tracks one source per row', () => {
  const { render } = createRenderer();

  const list = (row: () => JSX.Element) => () => (
    <div>
      <For each={rows}>{() => row()}</For>
    </div>
  );

  it('render-function Toggles', () => {
    const fanIn = widestFanIn(() =>
      render(
        list(() => (
          <Toggle
            render={(props, state) => (
              <button type="button" data-testid="toggle" {...props}>
                {state.pressed ? 'on' : 'off'}
              </button>
            )}
          />
        )),
      ),
    );
    expect(fanIn).toBeLessThanOrEqual(ROWS + 1);
    expect(screen.getAllByTestId('toggle')).toHaveLength(ROWS);
  });

  it('parts whose render prop can change', () => {
    const fanIn = widestFanIn(() =>
      render(
        list(() =>
          useRender({
            defaultTagName: 'button',
            get render() {
              return undefined;
            },
            props: { type: 'button', 'data-testid': 'part', children: 'part' },
          })(),
        ),
      ),
    );
    expect(fanIn).toBeLessThanOrEqual(ROWS + 1);
    expect(screen.getAllByTestId('part')).toHaveLength(ROWS);
  });

  it('render-function Buttons', () => {
    const fanIn = widestFanIn(() =>
      render(
        list(() => (
          <Button nativeButton={false} render={(props) => <span data-testid="button" {...props} />}>
            B
          </Button>
        )),
      ),
    );
    expect(fanIn).toBeLessThanOrEqual(ROWS + 1);
    expect(screen.getAllByTestId('button')).toHaveLength(ROWS);
  });

  it('render-function Toggles in a ToggleGroup', () => {
    const fanIn = widestFanIn(() =>
      render(() => (
        <ToggleGroup>
          <For each={rows}>
            {(index) => (
              <Toggle
                value={String(index)}
                render={(props) => <button type="button" data-testid="grouped" {...props} />}
              />
            )}
          </For>
        </ToggleGroup>
      )),
    );
    expect(fanIn).toBeLessThanOrEqual(ROWS + 1);
    expect(screen.getAllByTestId('grouped')).toHaveLength(ROWS);
  });
});
