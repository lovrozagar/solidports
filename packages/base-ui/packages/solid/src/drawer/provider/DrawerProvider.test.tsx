import { describe, expect, it, vi } from 'vitest';
import { createRenderEffect, createSignal, Show } from 'solid-js';
import { Drawer } from '@solidports/base-ui/drawer';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { useDrawerProviderContext } from './DrawerProviderContext';

const manualDrawer = {};
const missingDrawer = {};

function ProviderControls() {
  const context = useDrawerProviderContext();

  if (!context) {
    return null;
  }

  return (
    <>
      <button onClick={() => context.setDrawerOpen(manualDrawer, true)}>Register open</button>
      <button onClick={() => context.setDrawerOpen(manualDrawer, false)}>Register closed</button>
      <button onClick={() => context.removeDrawer(manualDrawer)}>Remove registered</button>
      <button onClick={() => context.removeDrawer(missingDrawer)}>Remove missing</button>
      <button
        onClick={() => context.visualStateStore.set({ swipeProgress: 0.5, frontmostHeight: 120 })}
      >
        Set visual state
      </button>
      <button onClick={() => context.visualStateStore.set({ swipeProgress: 0 })}>
        Clear progress
      </button>
      <button onClick={() => context.visualStateStore.set({ frontmostHeight: 0 })}>
        Clear height
      </button>
      <button
        onClick={() =>
          context.visualStateStore.set({ swipeProgress: Number.NaN, frontmostHeight: Infinity })
        }
      >
        Set invalid visual state
      </button>
    </>
  );
}

// Solid: stands in for `React.Profiler`; it re-runs whenever the provider's registry notifies.
function ProviderRenderProbe(props: { onRender: () => void }) {
  const context = useDrawerProviderContext();

  createRenderEffect(
    () => {
      props.onRender();
      return context?.active();
    },
    () => {},
  );

  return null;
}

function MultipleDrawers(props: { firstOpen: boolean; secondOpen: boolean; showSecond: boolean }) {
  return (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="background" />
      <Drawer.Root open={props.firstOpen}>First drawer</Drawer.Root>
      <Show when={props.showSecond}>
        <Drawer.Root open={props.secondOpen}>Second drawer</Drawer.Root>
      </Show>
    </Drawer.Provider>
  );
}

function VisualStateCase(props: { showIndent: boolean }) {
  return (
    <Drawer.Provider>
      <Show when={props.showIndent}>
        <Drawer.Indent data-testid="indent" />
      </Show>
      <ProviderControls />
    </Drawer.Provider>
  );
}

describe('<Drawer.Provider />', () => {
  const { render } = createRenderer();

  it('stays active until every open drawer is closed or removed', async () => {
    const [props, setProps] = createSignal({
      firstOpen: false,
      secondOpen: false,
      showSecond: true,
    });
    render(() => (
      <MultipleDrawers
        firstOpen={props().firstOpen}
        secondOpen={props().secondOpen}
        showSecond={props().showSecond}
      />
    ));
    const background = screen.getByTestId('background');

    expect(background).toHaveAttribute('data-inactive', '');

    await act(() => setProps({ firstOpen: true, secondOpen: false, showSecond: true }));
    expect(background).toHaveAttribute('data-active', '');

    await act(() => setProps({ firstOpen: false, secondOpen: true, showSecond: true }));
    expect(background).toHaveAttribute('data-active', '');

    await act(() => setProps({ firstOpen: false, secondOpen: true, showSecond: false }));
    expect(background).toHaveAttribute('data-inactive', '');
  });

  it('ignores redundant registry updates without disturbing active state', async () => {
    const { user } = render(() => (
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="background" />
        <ProviderControls />
      </Drawer.Provider>
    ));
    const background = screen.getByTestId('background');

    await user.click(screen.getByRole('button', { name: 'Register open' }));
    expect(background).toHaveAttribute('data-active', '');

    await user.click(screen.getByRole('button', { name: 'Register open' }));
    await user.click(screen.getByRole('button', { name: 'Remove missing' }));
    expect(background).toHaveAttribute('data-active', '');

    await user.click(screen.getByRole('button', { name: 'Register closed' }));
    expect(background).toHaveAttribute('data-inactive', '');

    await user.click(screen.getByRole('button', { name: 'Remove registered' }));
    await user.click(screen.getByRole('button', { name: 'Remove registered' }));
    expect(background).toHaveAttribute('data-inactive', '');
  });

  it('does not retain closed drawer registrations', async () => {
    const onRender = vi.fn();
    const { user } = render(() => (
      <Drawer.Provider>
        <ProviderRenderProbe onRender={onRender} />
        <ProviderControls />
      </Drawer.Provider>
    ));

    onRender.mockClear();
    await user.click(screen.getByRole('button', { name: 'Register closed' }));

    expect(onRender).not.toHaveBeenCalled();
  });

  it('synchronizes and restores visual state on Drawer.Indent', async () => {
    const [showIndent, setShowIndent] = createSignal(true);
    const { user } = render(() => <VisualStateCase showIndent={showIndent()} />);
    const indent = screen.getByTestId('indent');

    await user.click(screen.getByRole('button', { name: 'Set visual state' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('120px');

    await user.click(screen.getByRole('button', { name: 'Clear progress' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('120px');

    await user.click(screen.getByRole('button', { name: 'Clear height' }));
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

    await user.click(screen.getByRole('button', { name: 'Set invalid visual state' }));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');

    await user.click(screen.getByRole('button', { name: 'Set visual state' }));
    await act(() => setShowIndent(false));
    expect(indent.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(indent.style.getPropertyValue('--drawer-height')).toBe('');
  });

  it('allows indent parts to render without a provider', async () => {
    render(() => (
      <>
        <Drawer.Indent data-testid="indent" />
        <Drawer.IndentBackground data-testid="background" />
      </>
    ));

    expect(screen.getByTestId('indent')).toHaveAttribute('data-inactive', '');
    expect(screen.getByTestId('background')).toHaveAttribute('data-inactive', '');
  });
});
