import { createRenderer } from '#test-utils';
import { Drawer } from '@solidports/base-ui/drawer';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { useDrawerVirtualKeyboardContext } from './DrawerVirtualKeyboardContext';

describe('<Drawer.VirtualKeyboardProvider />', () => {
  const { render } = createRenderer();

  function DirectVirtualKeyboardTouchTarget() {
    const virtualKeyboard = useDrawerVirtualKeyboardContext();

    return (
      <input
        data-testid="input"
        type="text"
        onTouchStart={virtualKeyboard?.onTouchStart}
        onTouchEnd={virtualKeyboard?.onTouchEnd}
      />
    );
  }

  it('provides touch handlers to descendants', () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <DirectVirtualKeyboardTouchTarget />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
    ));

    expect(screen.getByTestId('input')).to.exist;
  });

  it('exports VirtualKeyboardProvider on the public Drawer namespace', () => {
    expect(Drawer.VirtualKeyboardProvider).to.be.a('function');
  });
});
