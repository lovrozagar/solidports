/*
 * Native vs slow path parity for Collapsible (plan 8 step 3.2): the same tree through the native
 * fast paths and through `useRenderElement` (`render="<tag>"` on every part) must produce
 * identical DOM after mount and after every interaction, call handlers in the same order and
 * apply refs the same way.
 */
import { createRenderer } from '#test-utils';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, renderParity } from '../../test/parityHarness';

describe('native parity: Collapsible', () => {
  const { render } = createRenderer();

  const trigger = (root: HTMLElement) => root.querySelector('button')!;

  it('renders and toggles identically (uncontrolled)', () => {
    const pair = renderParity(render, (slow) =>
      part(Collapsible.Root, slow, 'div', {
        get children() {
          return [
            part(Collapsible.Trigger, slow, 'button', { children: 'Toggle' }),
            part(Collapsible.Panel, slow, 'div', { children: 'Content' }),
          ];
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelector('[data-closed]')).not.toBe(null);
    pair.both((root) => fireEvent.click(trigger(root)));
    expect(pair.fast.querySelector('[aria-expanded="true"]')).not.toBe(null);
    expect(pair.fast.querySelector('[aria-controls]')).not.toBe(null);
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.unmount();
  });

  it('renders identically with every prop form', () => {
    const [open, setOpen] = createSignal(true);
    const [disabled, setDisabled] = createSignal(false);
    const pair = renderParity(render, (slow) =>
      part(Collapsible.Root, slow, 'div', {
        get open() {
          return open();
        },
        get disabled() {
          return disabled();
        },
        class: (state: Collapsible.Root.State) => (state.open ? 'is-open' : 'is-closed'),
        style: { color: 'red' },
        'data-foo': 'bar',
        get children() {
          return [
            part(Collapsible.Trigger, slow, 'button', {
              children: 'Toggle',
              class: 'trigger',
              style: (state: Collapsible.Trigger.State) => ({
                opacity: state.disabled ? '0.5' : '1',
              }),
              'aria-label': 'label',
              get title() {
                return disabled() ? 'off' : 'on';
              },
            }),
            part(Collapsible.Panel, slow, 'div', {
              children: 'Content',
              keepMounted: true,
              id: 'my-panel',
              class: 'panel',
              // A string style (typed as an object on the panel): the native effect must not re-write
              // an unchanged string style, which would wipe the measured CSS variables.
              style: 'margin: 1px' as unknown as JSX.CSSProperties,
              lang: 'fr',
            }),
          ];
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelector('button')).to.have.attribute('aria-controls', 'my-panel');
    pair.both(() => setOpen(false));
    expect(pair.fast.querySelector('#my-panel')).not.toBe(null);
    pair.both(() => setDisabled(true));
    expect(pair.fast.querySelector('button')).to.have.attribute('aria-disabled', 'true');
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.both(() => setDisabled(false));
    pair.both(() => setOpen(true));
    pair.unmount();
  });

  it('keeps a hidden-until-found panel mounted identically', () => {
    const pair = renderParity(render, (slow) =>
      part(Collapsible.Root, slow, 'div', {
        get children() {
          return [
            part(Collapsible.Trigger, slow, 'button', { children: 'Toggle' }),
            part(Collapsible.Panel, slow, 'div', { children: 'Content', hiddenUntilFound: true }),
          ];
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelector('[hidden]')).to.have.attribute('hidden', 'until-found');
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.unmount();
  });

  it('calls consumer handlers in the same order and honors preventBaseUIHandler', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const result = render(() =>
        part(Collapsible.Root, slow, 'div', {
          onOpenChange: (open: boolean) => calls.push(`open:${open}`),
          get children() {
            return [
              part(Collapsible.Trigger, slow, 'button', {
                children: 'Toggle',
                onClick: (event: MouseEvent & { preventBaseUIHandler: () => void }) => {
                  calls.push(`click:${typeof event.preventBaseUIHandler}`);
                  if (calls.length > 3) {
                    event.preventBaseUIHandler();
                  }
                },
                onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
                onPointerDown: () => calls.push('pointerdown'),
              }),
              part(Collapsible.Panel, slow, 'div', { children: 'Content' }),
            ];
          },
        }),
      );
      const button = result.container.querySelector('button')!;
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`p:${fireEvent.keyDown(button, { key: 'Enter' })}`);
      calls.push(`p:${fireEvent.pointerDown(button)}`);
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`expanded:${button.getAttribute('aria-expanded')}`);
      result.unmount();
      return calls;
    };
    const fast = run(false);
    expect(fast).toContain('open:true');
    expect(fast[fast.length - 1]).toBe('expanded:true');
    expect(fast).toEqual(run(true));
  });

  it('suppresses interactions identically when disabled', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const result = render(() =>
        part(Collapsible.Root, slow, 'div', {
          disabled: true,
          onOpenChange: (open: boolean) => calls.push(`open:${open}`),
          get children() {
            return [
              part(Collapsible.Trigger, slow, 'button', {
                children: 'Toggle',
                onClick: () => calls.push('click'),
                onKeyDown: () => calls.push('keydown'),
                onKeyUp: () => calls.push('keyup'),
                onMouseDown: () => calls.push('mousedown'),
                onPointerDown: () => calls.push('pointerdown'),
              }),
              part(Collapsible.Panel, slow, 'div', { children: 'Content' }),
            ];
          },
        }),
      );
      const button = result.container.querySelector('button')!;
      calls.push(`click:${fireEvent.click(button)}`);
      calls.push(`tab:${fireEvent.keyDown(button, { key: 'Tab' })}`);
      calls.push(`space:${fireEvent.keyDown(button, { key: ' ' })}`);
      calls.push(`keyup:${fireEvent.keyUp(button, { key: ' ' })}`);
      calls.push(`mousedown:${fireEvent.mouseDown(button)}`);
      calls.push(`pointerdown:${fireEvent.pointerDown(button)}`);
      flush();
      result.unmount();
      return calls;
    };
    expect(run(false)).toEqual(run(true));
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const rootRef = vi.fn();
      const triggerRef = { current: null as Element | null };
      const panelRef = vi.fn();
      const result = render(() =>
        part(Collapsible.Root, slow, 'div', {
          ref: rootRef,
          defaultOpen: true,
          get children() {
            return [
              part(Collapsible.Trigger, slow, 'button', { children: 'Toggle', ref: triggerRef }),
              part(Collapsible.Panel, slow, 'div', { children: 'Content', ref: panelRef }),
            ];
          },
        }),
      );
      const tags = [
        rootRef.mock.calls.map((call) => (call[0] as Element).tagName).join(),
        triggerRef.current?.tagName,
        panelRef.mock.calls.map((call) => (call[0] as Element).tagName).join(),
      ];
      result.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'BUTTON', 'DIV']);
    expect(run(false)).toEqual(run(true));
  });
});
