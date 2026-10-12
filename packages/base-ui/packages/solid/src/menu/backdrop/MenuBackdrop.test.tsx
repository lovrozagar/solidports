import { createEffect } from 'solid-js';
import { createRenderer, describeConformance } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen, waitFor } from '@solidjs/testing-library';

describe('<Menu.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.Backdrop, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Menu.Root open>{node(props!)}</Menu.Root>),
  }));

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger delay={0} openOnHover>
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.hover(screen.getByText('Open'));

    expect(screen.getByTestId('backdrop').style.pointerEvents).to.equal('none');
  });

  it('does not set `pointer-events: none` style on backdrop if opened by click', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger delay={0}>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).not.to.equal('none');
    });
  });

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    async (controlled) => {
      const statuses = new Set<Menu.Backdrop.State['transitionStatus']>();

      // Solid: an effect over the state records each committed value, as React's layout effect.
      function RecordState(props: { state: Menu.Backdrop.State }) {
        createEffect(
          () => props.state.transitionStatus,
          (status) => {
            statuses.add(status);
          },
        );
        return null;
      }

      await render(() => (
        <Menu.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Menu.Backdrop
            render={(props: Record<string, unknown>, state: Menu.Backdrop.State) => (
              <div {...props}>
                <RecordState state={state} />
              </div>
            )}
          />
        </Menu.Root>
      ));

      expect(statuses).toEqual(new Set([undefined]));
    },
  );
});
