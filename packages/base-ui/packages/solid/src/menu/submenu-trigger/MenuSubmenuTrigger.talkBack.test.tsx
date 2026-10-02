import { act, createRenderer, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

// Kept in a separate file so the module mock doesn't leak into `MenuSubmenuTrigger.test.tsx`.
// `isVirtualPointerEvent` only recognizes the TalkBack press shape when the platform reports
// Android, which desktop Chromium does not.
// Solid: React mocks `platform.os.android`; the Solid port reads `isAndroid`.
vi.mock('../../utils/detectBrowser', async () => {
  const actual = await vi.importActual<typeof import('../../utils/detectBrowser')>(
    '../../utils/detectBrowser',
  );

  return {
    ...actual,
    isAndroid: true,
  };
});

function Test(props: { submenuTriggerProps?: Partial<Menu.SubmenuTrigger.Props> }) {
  return (
    <Menu.Root>
      <Menu.Trigger>Open menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger data-testid="submenu-trigger" {...props.submenuTriggerProps}>
                More
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="submenu">
                    <Menu.Item>Alpha</Menu.Item>
                    <Menu.Item>Beta</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function fireTalkBackMouseDown(element: Element) {
  fireEvent.pointerDown(element, {
    pointerType: 'mouse',
    width: 1,
    height: 1,
    pressure: 0,
    detail: 0,
  });
  fireEvent.mouseDown(element, { detail: 0 });
}

// TalkBack in Chrome activates elements with a synthetic mouse press: a zero-pressure 1x1
// `pointerdown` followed by `mousedown` and a `detail: 0` click.
function fireTalkBackPress(element: Element) {
  fireTalkBackMouseDown(element);
  fireEvent.click(element, { detail: 0 });
}

async function waitForFrames(count = 2) {
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  }
}

// `isVirtualPointerEvent` returns `false` under jsdom, so the virtual press cannot be detected there.
describe.skipIf(isJSDOM)('<Menu.SubmenuTrigger /> with TalkBack', () => {
  const { render } = createRenderer();

  it('opens the submenu on a TalkBack press with the default `openOnHover`', async () => {
    const { user } = render(() => <Test />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    fireTalkBackPress(submenuTrigger);

    // The mousedown open path defers through a rAF.
    expect(await screen.findByTestId('submenu')).not.toBe(null);
  });

  it('keeps the submenu open on a TalkBack press with `openOnHover={false}`', async () => {
    const { user } = render(() => <Test submenuTriggerProps={{ openOnHover: false }} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    fireTalkBackMouseDown(submenuTrigger);

    await screen.findByTestId('submenu');

    // The trailing click must not toggle the freshly opened submenu closed.
    fireEvent.click(submenuTrigger, { detail: 0 });
    await waitForFrames();

    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it('ignores an ordinary mouse press with the default `openOnHover`', async () => {
    const { user } = render(() => <Test />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const submenuTrigger = await screen.findByTestId('submenu-trigger');

    // A real pressed mouse reports non-zero pressure, so it is not a virtual press.
    fireEvent.pointerDown(submenuTrigger, {
      pointerType: 'mouse',
      width: 1,
      height: 1,
      pressure: 0.5,
      detail: 0,
    });
    fireEvent.mouseDown(submenuTrigger);
    fireEvent.click(submenuTrigger, { detail: 1 });

    await waitForFrames();

    expect(screen.queryByTestId('submenu')).toBe(null);
  });
});
