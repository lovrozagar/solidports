/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Native vs slow path parity for Accordion: the same tree through the native
 * fast paths and through `useRenderElement` (a reactive `render` on every part) must produce
 * identical DOM after mount and after every interaction, and call handlers in the same order.
 */
import { createRenderer } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush, omit } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import type { JSX } from '@solidjs/web';
import { part, mountParity } from '../../test/parityHarness';

describe('native parity: Accordion', () => {
  const { render } = createRenderer();

  const triggers = (root: HTMLElement) => Array.from(root.querySelectorAll('button'));

  function items(slow: boolean, extra: (index: number) => object = () => ({})) {
    return [0, 1, 2].map((index) =>
      part(Accordion.Item, slow, 'div', {
        value: `item-${index}`,
        ...extra(index),
        get children() {
          return [
            part(Accordion.Header, slow, 'h3', {
              get children() {
                return part(Accordion.Trigger, slow, 'button', { children: `Trigger ${index}` });
              },
            }),
            part(Accordion.Panel, slow, 'div', { children: `Content ${index}` }),
          ];
        },
      }),
    );
  }

  it('renders and toggles identically (uncontrolled, single)', () => {
    const pair = mountParity(render, (slow) =>
      part(Accordion.Root, slow, 'div', {
        get children() {
          return items(slow);
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelectorAll('[data-index]').length).toBeGreaterThan(0);
    pair.both((root) => fireEvent.click(triggers(root)[1]));
    expect(pair.fast.querySelector('[role="region"]')).not.toBe(null);
    pair.both((root) => fireEvent.click(triggers(root)[2]));
    pair.both((root) => fireEvent.click(triggers(root)[2]));
    pair.unmount();
  });

  it('renders identically with every prop form (controlled, multiple)', () => {
    const [value, setValue] = createSignal<string[]>(['item-0']);
    const [disabled, setDisabled] = createSignal(false);
    const pair = mountParity(render, (slow) =>
      part(Accordion.Root, slow, 'div', {
        multiple: true,
        keepMounted: true,
        get value() {
          return value();
        },
        get disabled() {
          return disabled();
        },
        class: (state: Accordion.Root.State) => (state.disabled ? 'off' : 'on'),
        'data-foo': 'bar',
        get children() {
          return items(slow, (index) => ({
            class: (state: Accordion.Item.State) => (state.open ? 'open' : 'closed'),
            style: { color: 'red' },
            disabled: index === 2,
            get title() {
              return `item ${index} ${disabled()}`;
            },
          }));
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelectorAll('[role="region"]').length).toBe(3);
    pair.both(() => setValue(['item-0', 'item-1']));
    pair.both(() => setDisabled(true));
    pair.both((root) => fireEvent.click(triggers(root)[1]));
    pair.both(() => setDisabled(false));
    pair.both(() => setValue([]));
    pair.unmount();
  });

  it('registers explicit trigger and panel ids identically', () => {
    const pair = mountParity(render, (slow) =>
      part(Accordion.Root, slow, 'div', {
        defaultValue: ['a'],
        hiddenUntilFound: true,
        get children() {
          return part(Accordion.Item, slow, 'div', {
            value: 'a',
            get children() {
              return [
                part(Accordion.Header, slow, 'h3', {
                  get children() {
                    return part(Accordion.Trigger, slow, 'button', {
                      children: 'Trigger',
                      id: 'my-trigger',
                    });
                  },
                }),
                part(Accordion.Panel, slow, 'div', { children: 'Content', id: 'my-panel' }),
              ];
            },
          });
        },
      }),
    );
    pair.same();
    expect(pair.fast.querySelector('button')).toHaveAttribute('aria-controls', 'my-panel');
    expect(pair.fast.querySelector('[role="region"]')).toHaveAttribute(
      'aria-labelledby',
      'my-trigger',
    );
    pair.both((root) => fireEvent.click(triggers(root)[0]));
    expect(pair.fast.querySelector('[hidden]')).toHaveAttribute('hidden', 'until-found');
    pair.unmount();
  });

  it('calls consumer handlers in the same order and honors preventBaseUIHandler', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const view = render(() =>
        part(Accordion.Root, slow, 'div', {
          onValueChange: (value: string[]) => calls.push(`value:${value.join(',')}`),
          get children() {
            return part(Accordion.Item, slow, 'div', {
              value: 'a',
              onOpenChange: (open: boolean) => calls.push(`open:${open}`),
              get children() {
                return [
                  part(Accordion.Header, slow, 'h3', {
                    get children() {
                      return part(Accordion.Trigger, slow, 'button', {
                        children: 'Trigger',
                        onClick: (event: MouseEvent & { preventBaseUIHandler: () => void }) => {
                          calls.push('click');
                          if (calls.length > 4) {
                            event.preventBaseUIHandler();
                          }
                        },
                        onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
                      });
                    },
                  }),
                  part(Accordion.Panel, slow, 'div', { children: 'Content' }),
                ];
              },
            });
          },
        }),
      );
      const button = view.container.querySelector('button')!;
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`p:${fireEvent.keyDown(button, { key: 'ArrowDown' })}`);
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`expanded:${button.getAttribute('aria-expanded')}`);
      view.unmount();
      return calls;
    };
    const fast = run(false);
    expect(fast).toContain('value:a');
    expect(fast[fast.length - 1]).toBe('expanded:true');
    expect(fast).toEqual(run(true));
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const refs = {
        root: vi.fn(),
        item: vi.fn(),
        header: vi.fn(),
        trigger: vi.fn(),
        panel: vi.fn(),
      };
      const view = render(() =>
        part(Accordion.Root, slow, 'div', {
          ref: refs.root,
          defaultValue: ['a'],
          get children() {
            return part(Accordion.Item, slow, 'div', {
              value: 'a',
              ref: refs.item,
              get children() {
                return [
                  part(Accordion.Header, slow, 'h3', {
                    ref: refs.header,
                    get children() {
                      return part(Accordion.Trigger, slow, 'button', {
                        children: 'Trigger',
                        ref: refs.trigger,
                      });
                    },
                  }),
                  part(Accordion.Panel, slow, 'div', { children: 'Content', ref: refs.panel }),
                ];
              },
            });
          },
        }),
      );
      const tags = Object.values(refs).map((ref) =>
        ref.mock.calls.map((call) => (call[0] as Element).tagName).join(),
      );
      view.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'DIV', 'H3', 'BUTTON', 'DIV']);
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
      trigger: (props: object, state: Accordion.Trigger.State) => (
        <button {...props} data-render-open={String(state.open)} />
      ),
      panel: (props: object, state: Accordion.Panel.State) => (
        <section {...props} data-render-open={String(state.open)} />
      ),
    },
  } as const;

  for (const [name, form] of Object.entries(forms)) {
    describe(`with a ${name} as render`, () => {
      const formItems = (slow: boolean, panelProps: object = {}) =>
        [0, 1].map((index) =>
          part(Accordion.Item, slow, 'div', {
            value: `item-${index}`,
            get children() {
              return [
                part(Accordion.Header, slow, 'h3', {
                  get children() {
                    return part(Accordion.Trigger, slow, 'button', {
                      render: form.trigger,
                      children: `Trigger ${index}`,
                      class: 'from-consumer',
                      'data-source': 'consumer',
                    });
                  },
                }),
                part(Accordion.Panel, slow, 'div', {
                  render: form.panel,
                  children: `Content ${index}`,
                  'data-source': 'consumer',
                  ...panelProps,
                }),
              ];
            },
          }),
        );

      it('renders and toggles identically, with consumer props', () => {
        const pair = mountParity(render, (slow) =>
          part(Accordion.Root, slow, 'div', {
            get children() {
              return formItems(slow);
            },
          }),
        );
        pair.same();
        expect(pair.fast.querySelector('section')).toBe(null);
        pair.both((root) => fireEvent.click(triggers(root)[1]));
        expect(pair.fast.querySelector('section[role="region"]')).not.toBe(null);
        pair.both((root) => fireEvent.click(triggers(root)[0]));
        pair.both((root) => fireEvent.click(triggers(root)[0]));
        pair.unmount();
      });

      it('keeps mounted panels and their state identical (controlled, multiple)', () => {
        const [value, setValue] = createSignal<string[]>(['item-0']);
        const pair = mountParity(render, (slow) =>
          part(Accordion.Root, slow, 'div', {
            multiple: true,
            get value() {
              return value();
            },
            onValueChange: (next: string[]) => setValue(next),
            get children() {
              return formItems(slow, { keepMounted: true });
            },
          }),
        );
        pair.same();
        expect(pair.fast.querySelectorAll('section').length).toBe(2);
        pair.both(() => setValue(['item-1']));
        pair.both(() => setValue(['item-0', 'item-1']));
        pair.both(() => setValue([]));
        pair.unmount();
      });

      it('applies refs to the rendered element the same way', () => {
        const run = (slow: boolean) => {
          const triggerRef = vi.fn();
          const panelRef = vi.fn();
          const view = render(() =>
            part(Accordion.Root, slow, 'div', {
              defaultValue: ['a'],
              get children() {
                return part(Accordion.Item, slow, 'div', {
                  value: 'a',
                  get children() {
                    return [
                      part(Accordion.Header, slow, 'h3', {
                        get children() {
                          return part(Accordion.Trigger, slow, 'button', {
                            render: form.trigger,
                            children: 'Trigger',
                            ref: triggerRef,
                          });
                        },
                      }),
                      part(Accordion.Panel, slow, 'div', {
                        render: form.panel,
                        children: 'Content',
                        ref: panelRef,
                      }),
                    ];
                  },
                });
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
      part(Accordion.Root, slow, 'div', {
        get children() {
          return part(Accordion.Item, slow, 'div', {
            value: 'a',
            get children() {
              return [
                part(Accordion.Header, slow, 'h3', {
                  get children() {
                    return part(Accordion.Trigger, slow, 'button', {
                      render: { component: NoRefButton },
                      children: 'Trigger',
                    });
                  },
                }),
                part(Accordion.Panel, slow, 'div', {
                  render: { component: NoRefSection },
                  children: 'Content',
                }),
              ];
            },
          });
        },
      }),
    );
    pair.same();
    pair.both((root) => fireEvent.click(triggers(root)[0]));
    expect(triggers(pair.fast)[0]).toHaveAttribute('aria-expanded', 'true');
    expect(pair.fast.querySelector('section')).toHaveAttribute('data-open');
    pair.both((root) => fireEvent.click(triggers(root)[0]));
    expect(triggers(pair.fast)[0]).toHaveAttribute('aria-expanded', 'false');
    pair.unmount();
  });
});
