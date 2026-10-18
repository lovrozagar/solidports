/*
 * A disclosure trigger's disabled gates (plan 3 leaf 5.1.6, hydration allocation): its keydown and
 * pointerdown handlers only act while the trigger is disabled, so a trigger that can never be
 * disabled (its own, its item's and its root's `disabled` static and falsy) binds only its click.
 * Any reactive or true `disabled` binds them, as `useButton` does. (Solid's delegation runs no
 * handler of a disabled element, so on a native button they act only in the slow path's terms.)
 */
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';

// Solid's delegated handler slot on the element (`@solidjs/web`'s `addEvent`).
const bound = (el: Element, event: string) =>
  typeof (el as unknown as Record<string, unknown>)[`_$$${event}`] === 'function';

const gates = (el: Element) => ({
  click: bound(el, 'click'),
  keydown: bound(el, 'keydown'),
  pointerdown: bound(el, 'pointerdown'),
});

describe('disclosure trigger disabled gates', () => {
  const { render } = createRenderer();

  it('binds only the click of a Collapsible trigger that can never be disabled', () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger data-testid="trigger">Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    expect(gates(screen.getByTestId('trigger'))).toEqual({
      click: true,
      keydown: false,
      pointerdown: false,
    });
  });

  it('binds only the click of an Accordion trigger whose item and root are never disabled', () => {
    render(() => (
      <Accordion.Root disabled={false}>
        <Accordion.Item value="a" disabled={false}>
          <Accordion.Header>
            <Accordion.Trigger data-testid="trigger" disabled={false}>
              A
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(gates(screen.getByTestId('trigger'))).toEqual({
      click: true,
      keydown: false,
      pointerdown: false,
    });
  });

  it("binds the gates of a consumer's handlers whatever the trigger's disabled", () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger data-testid="trigger" onKeyDown={() => {}}>
          Toggle
        </Collapsible.Trigger>
      </Collapsible.Root>
    ));
    expect(bound(screen.getByTestId('trigger'), 'keydown')).toBe(true);
  });

  it.each([
    ['the trigger', 'trigger'],
    ['the root', 'root'],
  ] as const)(
    'binds the gates when %s is disabled reactively, and runs nothing once it is',
    (_, level) => {
      const [disabled, setDisabled] = createSignal(false);
      const onKeyDown = vi.fn();
      render(() => (
        <Collapsible.Root disabled={level === 'root' ? disabled() : undefined}>
          <Collapsible.Trigger
            data-testid="trigger"
            disabled={level === 'trigger' ? disabled() : undefined}
            onKeyDown={onKeyDown}
          >
            Toggle
          </Collapsible.Trigger>
          <Collapsible.Panel keepMounted data-testid="panel">
            Content
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      const trigger = screen.getByTestId('trigger');
      expect(gates(trigger)).toEqual({ click: true, keydown: true, pointerdown: true });
      setDisabled(true);
      flush();
      // Solid's delegation runs no handler of a disabled element: the gates are the slow path's
      // contract for the same state (`useButton`), and nothing reaches the consumer or the root.
      fireEvent.keyDown(trigger, { key: 'Enter' });
      fireEvent.click(trigger);
      flush();
      expect(onKeyDown).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    },
  );

  it.each([
    ['Collapsible', 'collapsible'],
    ['Accordion', 'accordion'],
  ] as const)(
    'runs the gates of a non-button %s trigger once a reactive disabled is true',
    (_, family) => {
      // A `<span>` has no `disabled`, so Solid's delegation runs its handlers: the gates act.
      const [disabled, setDisabled] = createSignal(false);
      const onKeyDown = vi.fn();
      render(() =>
        family === 'collapsible' ? (
          <Collapsible.Root>
            <Collapsible.Trigger
              data-testid="trigger"
              nativeButton={false}
              render="span"
              disabled={disabled()}
              onKeyDown={onKeyDown}
            >
              Toggle
            </Collapsible.Trigger>
          </Collapsible.Root>
        ) : (
          <Accordion.Root>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger
                  data-testid="trigger"
                  nativeButton={false}
                  render="span"
                  disabled={disabled()}
                  onKeyDown={onKeyDown}
                >
                  A
                </Accordion.Trigger>
              </Accordion.Header>
            </Accordion.Item>
          </Accordion.Root>
        ),
      );
      const trigger = screen.getByTestId('trigger');
      setDisabled(true);
      flush();
      const keydown = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      fireEvent(trigger, keydown);
      // `useButton`: a disabled non-button stops the consumer's keydown, and prevents its
      // pointerdown.
      expect(onKeyDown).not.toHaveBeenCalled();
      const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true });
      fireEvent(trigger, pointerdown);
      expect(pointerdown.defaultPrevented).toBe(true);
    },
  );

  it('binds the gates of an Accordion trigger whose root is disabled reactively', () => {
    const [disabled] = createSignal(false);
    render(() => (
      <Accordion.Root disabled={disabled()}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger data-testid="trigger">A</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    expect(gates(screen.getByTestId('trigger'))).toEqual({
      click: true,
      keydown: true,
      pointerdown: true,
    });
  });
});
