/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Native vs slow path parity for Collapsible: the same tree through the native
 * fast paths and through `useRenderElement` (a reactive `render` on every part) must produce
 * identical DOM after mount and after every interaction, call handlers in the same order and
 * apply refs the same way.
 */
import { createRenderer } from '#test-utils';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush, omit } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, mountParity } from '../../test/parityHarness';

describe('native parity: Collapsible', () => {
  const { render } = createRenderer();

  const trigger = (root: HTMLElement) => root.querySelector('button')!;

  it('renders and toggles identically (uncontrolled)', () => {
    const pair = mountParity(render, (slow) =>
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
    const pair = mountParity(render, (slow) =>
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
    expect(pair.fast.querySelector('button')).toHaveAttribute('aria-controls', 'my-panel');
    pair.both(() => setOpen(false));
    expect(pair.fast.querySelector('#my-panel')).not.toBe(null);
    pair.both(() => setDisabled(true));
    pair.same();
    expect(pair.fast.querySelector('button')).toHaveAttribute('disabled');
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.both(() => setDisabled(false));
    pair.both(() => setOpen(true));
    pair.unmount();
  });

  it('keeps a hidden-until-found panel mounted identically', () => {
    const pair = mountParity(render, (slow) =>
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
    expect(pair.fast.querySelector('[hidden]')).toHaveAttribute('hidden', 'until-found');
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.both((root) => fireEvent.click(trigger(root)));
    pair.unmount();
  });

  it('calls consumer handlers in the same order and honors preventBaseUIHandler', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const view = render(() =>
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
      const button = view.container.querySelector('button')!;
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`p:${fireEvent.keyDown(button, { key: 'Enter' })}`);
      calls.push(`p:${fireEvent.pointerDown(button)}`);
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`expanded:${button.getAttribute('aria-expanded')}`);
      view.unmount();
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
      const view = render(() =>
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
      const button = view.container.querySelector('button')!;
      calls.push(`click:${fireEvent.click(button)}`);
      calls.push(`tab:${fireEvent.keyDown(button, { key: 'Tab' })}`);
      calls.push(`space:${fireEvent.keyDown(button, { key: ' ' })}`);
      calls.push(`keyup:${fireEvent.keyUp(button, { key: ' ' })}`);
      calls.push(`mousedown:${fireEvent.mouseDown(button)}`);
      calls.push(`pointerdown:${fireEvent.pointerDown(button)}`);
      flush();
      view.unmount();
      return calls;
    };
    expect(run(false)).toEqual(run(true));
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const rootRef = vi.fn();
      const triggerRef = { current: null as Element | null };
      const panelRef = vi.fn();
      const view = render(() =>
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
      view.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'BUTTON', 'DIV']);
    expect(run(false)).toEqual(run(true));
  });

  /** A consumer component in `render`: forwards every prop, the ref included, to a tag. */
  const AppButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => <button {...props} />;
  const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;

  // The static `render` values the port takes (plan 3 leaf 5.1.2): the native side gets them as
  // written, the slow side the same value behind a getter. The config carries props of its own
  // and the consumer passes the same keys, so the merge order shows in the DOM.
  const forms = {
    tag: { trigger: 'button', panel: 'section' },
    config: {
      trigger: { component: 'button', class: 'from-config', 'data-source': 'config' },
      panel: { component: 'section', id: 'config-panel', 'data-source': 'config' },
    },
    component: {
      trigger: { component: AppButton },
      panel: { component: AppSection },
    },
    function: {
      trigger: (props: object, state: Collapsible.Trigger.State) => (
        <button {...props} data-render-open={String(state.open)} />
      ),
      panel: (props: object, state: Collapsible.Panel.State) => (
        <section {...props} data-render-open={String(state.open)} />
      ),
    },
  } as const;

  for (const [name, form] of Object.entries(forms)) {
    describe(`with a ${name} as render`, () => {
      it('renders and toggles identically, with consumer props', () => {
        const pair = mountParity(render, (slow) =>
          part(Collapsible.Root, slow, 'div', {
            get children() {
              return [
                part(Collapsible.Trigger, slow, 'button', {
                  render: form.trigger,
                  children: 'Toggle',
                  class: 'from-consumer',
                  'data-source': 'consumer',
                }),
                part(Collapsible.Panel, slow, 'div', {
                  render: form.panel,
                  children: 'Content',
                  'data-source': 'consumer',
                }),
              ];
            },
          }),
        );
        pair.same();
        expect(pair.fast.querySelector('section')).toBe(null);
        pair.both((root) => fireEvent.click(trigger(root)));
        expect(pair.fast.querySelector('section')).not.toBe(null);
        // The panel registers its own `id` prop, so a config's `id` names the element but not
        // `aria-controls`, as upstream (the element's props merge after the part's).
        expect(trigger(pair.fast)).toHaveAttribute('aria-controls');
        pair.both((root) => fireEvent.click(trigger(root)));
        pair.unmount();
      });

      it('keeps a mounted panel and its state identical while disabled toggles', () => {
        const [disabled, setDisabled] = createSignal(false);
        const pair = mountParity(render, (slow) =>
          part(Collapsible.Root, slow, 'div', {
            defaultOpen: true,
            get disabled() {
              return disabled();
            },
            get children() {
              return [
                part(Collapsible.Trigger, slow, 'button', {
                  render: form.trigger,
                  children: 'Toggle',
                }),
                part(Collapsible.Panel, slow, 'div', {
                  render: form.panel,
                  children: 'Content',
                  keepMounted: true,
                }),
              ];
            },
          }),
        );
        pair.same();
        pair.both(() => setDisabled(true));
        expect(trigger(pair.fast)).toHaveAttribute('data-disabled');
        pair.both((root) => fireEvent.click(trigger(root)));
        pair.both(() => setDisabled(false));
        pair.both((root) => fireEvent.click(trigger(root)));
        expect(pair.fast.querySelector('section')).toHaveAttribute('data-closed');
        pair.unmount();
      });

      it('applies refs to the rendered element the same way', () => {
        const run = (slow: boolean) => {
          const triggerRef = vi.fn();
          const panelRef = vi.fn();
          const view = render(() =>
            part(Collapsible.Root, slow, 'div', {
              defaultOpen: true,
              get children() {
                return [
                  part(Collapsible.Trigger, slow, 'button', {
                    render: form.trigger,
                    children: 'Toggle',
                    ref: triggerRef,
                  }),
                  part(Collapsible.Panel, slow, 'div', {
                    render: form.panel,
                    children: 'Content',
                    ref: panelRef,
                  }),
                ];
              },
            }),
          );
          const elements = [
            view.container.querySelector('button'),
            view.container.querySelector('section'),
          ];
          const refs = [
            triggerRef.mock.calls.map((call) => call[0] === elements[0]).join(),
            panelRef.mock.calls.map((call) => call[0] === elements[1]).join(),
          ];
          view.unmount();
          return refs;
        };
        expect(run(false)).toEqual(['true', 'true']);
        expect(run(false)).toEqual(run(true));
      });
    });
  }

  // A consumer component that drops the ref: the part cannot reach the element through it, so a
  // native path must fall back for it, and both paths still render and toggle the same DOM.
  it('renders and toggles a component that drops the ref identically', () => {
    const NoRefButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => (
      <button {...omit(props, 'ref')} />
    );
    const NoRefSection = (props: JSX.HTMLAttributes<HTMLElement>) => (
      <section {...omit(props, 'ref')} />
    );
    const pair = mountParity(render, (slow) =>
      part(Collapsible.Root, slow, 'div', {
        get children() {
          return [
            part(Collapsible.Trigger, slow, 'button', {
              render: { component: NoRefButton },
              children: 'Toggle',
            }),
            part(Collapsible.Panel, slow, 'div', {
              render: { component: NoRefSection },
              children: 'Content',
            }),
          ];
        },
      }),
    );
    pair.same();
    pair.both((root) => fireEvent.click(trigger(root)));
    expect(trigger(pair.fast)).toHaveAttribute('aria-expanded', 'true');
    expect(pair.fast.querySelector('section')).toHaveAttribute('data-open');
    pair.both((root) => fireEvent.click(trigger(root)));
    expect(trigger(pair.fast)).toHaveAttribute('aria-expanded', 'false');
    pair.unmount();
  });
});
