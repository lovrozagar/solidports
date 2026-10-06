/*
 * Native vs slow path parity for Accordion (plan 8 step 3.2): the same tree through the native
 * fast paths and through `useRenderElement` (`render="<tag>"` on every part) must produce
 * identical DOM after mount and after every interaction, and call handlers in the same order.
 */
import { createRenderer } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { part, renderParity } from '../../test/parityHarness';

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
    const pair = renderParity(render, (slow) =>
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
    const pair = renderParity(render, (slow) =>
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
    const pair = renderParity(render, (slow) =>
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
    expect(pair.fast.querySelector('button')).to.have.attribute('aria-controls', 'my-panel');
    expect(pair.fast.querySelector('[role="region"]')).to.have.attribute(
      'aria-labelledby',
      'my-trigger',
    );
    pair.both((root) => fireEvent.click(triggers(root)[0]));
    expect(pair.fast.querySelector('[hidden]')).to.have.attribute('hidden', 'until-found');
    pair.unmount();
  });

  it('calls consumer handlers in the same order and honors preventBaseUIHandler', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const result = render(() =>
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
      const button = result.container.querySelector('button')!;
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`p:${fireEvent.keyDown(button, { key: 'ArrowDown' })}`);
      calls.push(`p:${fireEvent.click(button)}`);
      flush();
      calls.push(`expanded:${button.getAttribute('aria-expanded')}`);
      result.unmount();
      return calls;
    };
    const fast = run(false);
    expect(fast).toContain('value:a');
    expect(fast[fast.length - 1]).toBe('expanded:true');
    expect(fast).toEqual(run(true));
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const refs = { root: vi.fn(), item: vi.fn(), header: vi.fn(), trigger: vi.fn(), panel: vi.fn() };
      const result = render(() =>
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
      result.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'DIV', 'H3', 'BUTTON', 'DIV']);
    expect(run(false)).toEqual(run(true));
  });
});
