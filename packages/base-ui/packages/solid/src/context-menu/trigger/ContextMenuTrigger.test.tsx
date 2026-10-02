import { createSignal, Show } from 'solid-js';
import { expect, vi } from 'vitest';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { ContextMenu } from '@solidports/base-ui/context-menu';
import { fireEvent, screen } from '@solidjs/testing-library';
import { spy } from 'sinon';

describe('<ContextMenu.Trigger />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(ContextMenu.Trigger, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <ContextMenu.Root>{node(props!)}</ContextMenu.Root>),
  }));

  it('throws when rendered outside ContextMenu.Root', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <ContextMenu.Trigger />)).to.throw(
        'Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('should open menu on right click (context menu event)', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(screen.queryByRole('menu')).not.to.equal(null);
  });

  it('adds open state attributes', async () => {
    const { user } = render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    expect(trigger).to.have.attribute('data-popup-open', '');

    await user.keyboard('{Escape}');
    expect(trigger).to.not.have.attribute('data-popup-open');
  });

  it('should call onOpenChange when menu is opened via right click', async () => {
    const onOpenChange = spy();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.contextMenu(trigger);
    await flushMicrotasks();

    expect(onOpenChange.lastCall.args[0]).to.equal(true);
  });

  it('does not cancel opening menu on mouseup after mousedown outside before 500ms', async () => {
    const onOpenChange = spy();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseDown(trigger);
    fireEvent.contextMenu(trigger);

    clock.tick(499);

    expect(onOpenChange.callCount).to.equal(1);
    expect(onOpenChange.lastCall.args[0]).to.equal(true);

    fireEvent.mouseUp(document.body);

    clock.tick(1);

    expect(onOpenChange.callCount).to.equal(1);
  });

  it('cancels opening menu on mouseup after mousedown outside after 500ms', async () => {
    const onOpenChange = spy();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.mouseDown(trigger);
    fireEvent.contextMenu(trigger);

    clock.tick(501);

    fireEvent.mouseUp(document.body);

    expect(onOpenChange.callCount).to.equal(2);
    expect(onOpenChange.lastCall.args[0]).to.equal(false);
  });

  it('keeps the menu open when the context-menu gesture ends inside its positioner', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner data-testid="positioner">
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    fireEvent.contextMenu(screen.getByTestId('trigger'));
    clock.tick(501);
    fireEvent.mouseUp(screen.getByTestId('positioner'));

    expect(onOpenChange.mock.calls).to.have.length(1);
    expect(screen.queryByRole('menu')).not.to.equal(null);
  });

  it('keeps the root menu open when the context-menu gesture ends in a portaled submenu', async () => {
    const onOpenChange = vi.fn();

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup>
              <ContextMenu.SubmenuRoot defaultOpen>
                <ContextMenu.SubmenuTrigger>More</ContextMenu.SubmenuTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.Positioner>
                    <ContextMenu.Popup data-testid="submenu-popup" />
                  </ContextMenu.Positioner>
                </ContextMenu.Portal>
              </ContextMenu.SubmenuRoot>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    fireEvent.contextMenu(screen.getByTestId('trigger'));
    clock.tick(501);
    fireEvent.mouseUp(screen.getByTestId('submenu-popup'));

    expect(onOpenChange.mock.calls).to.have.length(1);
    expect(screen.queryByTestId('submenu-popup')).not.to.equal(null);
  });

  it('aborts the pending document mouseup listener when the trigger unmounts', async () => {
    const onOpenChange = vi.fn();
    const [showTrigger, setShowTrigger] = createSignal(true);

    render(() => (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <Show when={showTrigger()}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
        </Show>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));
    fireEvent.contextMenu(screen.getByTestId('trigger'));

    await act(async () => {
      setShowTrigger(false);
    });

    clock.tick(501);
    fireEvent.mouseUp(document.body);

    expect(onOpenChange.mock.calls).to.have.length(1);
    expect(screen.queryByRole('menu')).not.to.equal(null);
  });

  describe('prop: disabled', () => {
    it('does not open on right-click when disabled', async () => {
      const onOpenChange = spy();

      render(() => (
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.contextMenu(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).to.equal(null);
      expect(onOpenChange.callCount).to.equal(0);
    });

    it('does not block the native context menu when disabled', async () => {
      render(() => (
        <ContextMenu.Root disabled>
          <ContextMenu.Trigger data-testid="trigger">Right click me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      let defaultPrevented = false;
      trigger.addEventListener(
        'contextmenu',
        (event) => {
          defaultPrevented = event.defaultPrevented;
        },
        { capture: false },
      );

      fireEvent.contextMenu(trigger);
      await flushMicrotasks();

      expect(defaultPrevented).to.equal(false);
    });
  });

  it('blocks native context menus on both internal and external backdrops', async () => {
    render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>Right click me</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Backdrop data-testid="backdrop" />
          <ContextMenu.Positioner>
            <ContextMenu.Popup />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    await flushMicrotasks();

    const internalBackdrop = document.querySelector(
      '[data-base-ui-portal] > [data-base-ui-inert][role="presentation"]',
    )!;
    const externalBackdrop = screen.getByTestId('backdrop');
    const internalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const externalEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const outsideEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    internalBackdrop.dispatchEvent(internalEvent);
    externalBackdrop.dispatchEvent(externalEvent);
    document.body.dispatchEvent(outsideEvent);

    expect(internalEvent.defaultPrevented).to.equal(true);
    expect(externalEvent.defaultPrevented).to.equal(true);
    expect(outsideEvent.defaultPrevented).to.equal(false);
  });

  it('blocks native context menus in a portal mounted inside the trigger DOM subtree', async () => {
    const [portalContainer, setPortalContainer] = createSignal<HTMLDivElement | null>(null);

    render(() => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger>
          Right click me
          <div ref={setPortalContainer} />
        </ContextMenu.Trigger>
        <ContextMenu.Portal container={portalContainer()}>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="popup" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    (await screen.findByTestId('popup')).dispatchEvent(event);

    expect(event.defaultPrevented).to.equal(true);
  });

  it('blocks the native context menu when onContextMenu skips the Base UI handler', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger
          data-testid="trigger"
          onContextMenu={(event) => event.preventBaseUIHandler()}
        >
          Right click me
        </ContextMenu.Trigger>
      </ContextMenu.Root>
    ));

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByTestId('trigger').dispatchEvent(event);

    expect(event.defaultPrevented).to.equal(true);
  });

  describe.skipIf(isJSDOM)('long press', () => {
    it('should open menu on long press on touchscreen devices', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      const touchObj = new Touch({
        clientX: 100,
        clientY: 100,
        identifier: 0,
        target: trigger,
      });

      fireEvent.touchStart(trigger, {
        touches: [touchObj],
      });

      clock.tick(500);

      expect(screen.queryByRole('menu')).not.to.equal(null);
    });

    it('should cancel long press when touch moves beyond threshold', async () => {
      const onOpenChange = spy();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      const touchStartObj = new Touch({
        clientX: 100,
        clientY: 100,
        identifier: 0,
        target: trigger,
      });

      fireEvent.touchStart(trigger, {
        touches: [touchStartObj],
      });

      // Simulate touch move (more than 10px movement)
      // This should cancel the long press
      const touchMoveObj = new Touch({
        clientX: 120,
        clientY: 100,
        identifier: 0,
        target: trigger,
      });

      fireEvent.touchMove(trigger, {
        touches: [touchMoveObj],
      });

      clock.tick(500);

      expect(screen.queryByRole('menu')).to.equal(null);
      expect(onOpenChange.callCount).to.equal(0);
    });

    it('keeps a pending long press when touch movement stays within the threshold', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, {
        touches: [new Touch({ identifier: 0, target: trigger, clientX: 100, clientY: 100 })],
      });
      fireEvent.touchMove(trigger, {
        touches: [new Touch({ identifier: 0, target: trigger, clientX: 105, clientY: 105 })],
      });

      clock.tick(500);

      expect(screen.queryByRole('menu')).not.to.equal(null);
    });

    it('cancels a pending long press when the touch ends', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, {
        touches: [new Touch({ identifier: 0, target: trigger, clientX: 100, clientY: 100 })],
      });
      fireEvent.touchEnd(trigger);
      clock.tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).to.equal(null);
    });

    it('cancels a pending long press when the gesture becomes multi-touch', async () => {
      const onOpenChange = vi.fn();

      render(() => (
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const firstTouch = new Touch({ identifier: 0, target: trigger, clientX: 100, clientY: 100 });
      const touches = [
        firstTouch,
        new Touch({ identifier: 1, target: trigger, clientX: 120, clientY: 100 }),
      ];

      fireEvent.touchStart(trigger, { touches: [firstTouch] });
      fireEvent.touchMove(trigger, { touches });
      fireEvent.touchMove(trigger, { touches: [firstTouch] });
      clock.tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).to.equal(null);

      fireEvent.touchEnd(trigger);
      fireEvent.touchStart(trigger, { touches: [firstTouch] });
      fireEvent.touchStart(trigger, { touches });
      clock.tick(500);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).to.equal(null);
    });

    it('delays outside-press dismissal after opening from a long press', async () => {
      render(() => (
        <ContextMenu.Root>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.touchStart(trigger, {
        touches: [new Touch({ identifier: 0, target: trigger, clientX: 100, clientY: 100 })],
      });
      clock.tick(500);

      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).not.to.equal(null);

      clock.tick(500);
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).to.equal(null);
    });

    it('does not open on long press when disabled', async () => {
      const onOpenChange = spy();

      render(() => (
        <ContextMenu.Root disabled onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="trigger">Long press me</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup data-testid="popup" />
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      const touchObj = new Touch({
        clientX: 100,
        clientY: 100,
        identifier: 0,
        target: trigger,
      });

      fireEvent.touchStart(trigger, {
        touches: [touchObj],
      });

      clock.tick(500);

      expect(screen.queryByTestId('popup')).to.equal(null);
      expect(onOpenChange.callCount).to.equal(0);
    });
  });

  it('should handle nested context menus correctly', async () => {
    render(() => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="outer-trigger">
          outer
          <ContextMenu.Root>
            <ContextMenu.Trigger>inner</ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup data-testid="inner-menu" />
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup data-testid="outer-menu" />
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ));

    const innerTrigger = screen.getByText('inner');
    const outerTrigger = screen.getByText('outer');

    fireEvent.contextMenu(innerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).not.to.equal(null);
    expect(screen.queryByTestId('outer-menu')).to.equal(null);

    fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-menu')).to.equal(null);

    fireEvent.contextMenu(outerTrigger);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-menu')).not.to.equal(null);
    expect(screen.queryByTestId('inner-menu')).to.equal(null);
  });
});
