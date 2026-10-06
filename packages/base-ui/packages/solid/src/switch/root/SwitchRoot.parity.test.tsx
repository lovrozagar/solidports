/*
 * Parity (plan 8 step 3.1): `Switch.Root` rendered through its Solid-native fast path and through
 * the `useRenderElement` slow path (`render="span"`, the same tag) must produce identical DOM for
 * the root, the thumb and the hidden input, the same handler order and the same Field wiring.
 */
import { createRenderer } from '#test-utils';
import { Switch } from '@solidports/base-ui/switch';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { fireEvent } from '@solidjs/testing-library';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { canRenderNative } from '../../utils/native';

type Props = Record<string, unknown>;

function normalized(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attributes = Array.from(el.attributes)
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .sort()
    .join(' ');
  const children = Array.from(el.childNodes)
    .map((node) => (node instanceof Element ? normalized(node) : node.textContent))
    .join('');
  const input = el instanceof HTMLInputElement ? ` checked=${el.checked}` : '';
  return `<${tag} ${attributes}${input}>${children}</${tag}>`;
}

const stripIds = (container: Element) =>
  normalized(container).replace(/(base-ui|mui)-[A-Za-z0-9-]+/g, 'ID');

/** `props` plus a thumb as a lazy child (created inside the root's context). */
function withThumb(props: Props): Props {
  return Object.defineProperties(props, {
    children: {
      configurable: true,
      enumerable: true,
      get: () => <Switch.Thumb data-part="thumb" />,
    },
  });
}

describe('native parity: Switch', () => {
  const { render } = createRenderer();

  function renderBoth(make: () => Props, wrap?: (ui: () => JSX.Element) => JSX.Element) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'span';
    expect(canRenderNative(fast, ['nativeButton', 'inputRef']), 'fast props qualify').toBe(true);
    const ui = (props: Props) => () =>
      createComponent(Switch.Root, props as Switch.Root.Props) as unknown as JSX.Element;
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return {
      fast: fastResult.container,
      slow: slowResult.container,
      fastEl: fastResult.container.querySelector('[role="switch"]')!,
      slowEl: slowResult.container.querySelector('[role="switch"]')!,
    };
  }

  it('renders the same root, thumb and hidden input for the props matrix', () => {
    const cases: Array<() => Props> = [
      () => ({}),
      () => ({ defaultChecked: true }),
      () => ({ checked: true, disabled: true, readOnly: true, required: true }),
      () => ({ name: 'on', value: 'yes', form: 'f1', id: 'sw-id' }),
      () => ({ name: 'on', uncheckedValue: 'no' }),
      () => ({ class: 'a b', style: { color: 'red' } }),
      () => ({
        checked: true,
        class: (state: Switch.Root.State) => (state.checked ? 'on' : 'off'),
        style: (state: Switch.Root.State) => ({ opacity: state.disabled ? '0.5' : '1' }),
      }),
      () => ({ 'aria-labelledby': 'lbl', 'aria-describedby': 'desc' }),
      () => ({ tabindex: 3, 'aria-checked': 'x', 'data-checked': 'y' }),
      () => ({ lang: 'fr', 'data-foo': 'bar', title: 't', hidden: true, title2: undefined }),
      () => ({ onClick: () => {}, onKeyDown: () => {}, onFocus: () => {} }),
    ];
    for (const make of cases) {
      const { fast, slow } = renderBoth(() => withThumb(make()));
      expect(stripIds(fast)).toBe(stripIds(slow));
    }
  });

  it('follows reactive props the same way', () => {
    const [checked, setChecked] = createSignal(false);
    const [disabled, setDisabled] = createSignal(false);
    const [title, setTitle] = createSignal<string | undefined>('t1');
    const make = () =>
      withThumb({
        get checked() {
          return checked();
        },
        get disabled() {
          return disabled();
        },
        get title() {
          return title();
        },
        class: (state: Switch.Root.State) => (state.checked ? 'on' : 'off'),
      });
    const { fast, slow, fastEl } = renderBoth(make);
    expect(stripIds(fast)).toBe(stripIds(slow));
    setChecked(true);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'true');
    expect(fast.querySelector('[data-part="thumb"]')).to.have.attribute('data-checked');
    setDisabled(true);
    setTitle(undefined);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('tabindex', '-1');
    expect(fastEl).not.to.have.attribute('title');
    setDisabled(false);
    setChecked(false);
    setTitle('t2');
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('toggles identically on click, Space and Enter with the same handler order', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const make = () => ({
        onCheckedChange: (next: boolean) => calls.push(`change:${next}`),
        onClick: (event: MouseEvent & { preventBaseUIHandler?: () => void }) =>
          calls.push(`click:${typeof event.preventBaseUIHandler}`),
        onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
        onKeyUp: [(data: string, event: KeyboardEvent) => calls.push(`keyup:${data}:${event.key}`), 'd'],
        onPointerDown: () => calls.push('pointerdown'),
        onMouseDown: () => calls.push('mousedown'),
        onfocus: () => calls.push('focus'),
        onBlur: () => calls.push('blur'),
      });
      const { fastEl, slowEl } = renderBoth(make);
      const el = variant === 'fast' ? fastEl : slowEl;
      calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
      calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
      calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
      calls.push(`keydown-space:${fireEvent.keyDown(el, { key: ' ' })}`);
      calls.push(`keyup-space:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
      calls.push(`keydown-enter:${fireEvent.keyDown(el, { key: 'Enter' })}:${el.getAttribute('aria-checked')}`);
      calls.push(`focus:${fireEvent.focus(el)}`);
      calls.push(`blur:${fireEvent.blur(el)}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('change:true');
    expect(fast).toContain('keyup:d: ');
    expect(fast).toEqual(run('slow'));
  });

  it('stays inert identically when disabled or read-only, and honors preventBaseUIHandler', () => {
    for (const props of [{ disabled: true }, { readOnly: true }, {}]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const prevent = Object.keys(props).length === 0;
        const make = () => ({
          ...props,
          onCheckedChange: (next: boolean) => calls.push(`change:${next}`),
          onClick: (event: { preventBaseUIHandler: () => void }) => {
            calls.push('click');
            if (prevent) {
              event.preventBaseUIHandler();
            }
          },
          onKeyDown: () => calls.push('keydown'),
          onKeyUp: (event: { preventBaseUIHandler: () => void }) => {
            calls.push('keyup');
            if (prevent) {
              event.preventBaseUIHandler();
            }
          },
          onPointerDown: () => calls.push('pointerdown'),
          onMouseDown: () => calls.push('mousedown'),
        });
        const { fastEl, slowEl } = renderBoth(make);
        const el = variant === 'fast' ? fastEl : slowEl;
        calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
        calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
        calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
        calls.push(`keydown:${fireEvent.keyDown(el, { key: ' ' })}`);
        calls.push(`keyup:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
        return calls;
      };
      expect(run('fast')).toEqual(run('slow'));
    }
  });

  it('applies refs the same way (consumer callback ref, inputRef)', () => {
    const run = (variant: 'fast' | 'slow') => {
      const ref = vi.fn();
      const inputRef = { current: null as HTMLInputElement | null };
      const { fastEl, slowEl } = renderBoth(() => ({ ref, inputRef }));
      const el = variant === 'fast' ? fastEl : slowEl;
      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref.mock.calls.some((call) => call[0] === el)).toBe(true);
      expect(inputRef.current?.type).toBe('checkbox');
      return el.tagName;
    };
    expect(run('fast')).toBe(run('slow'));
  });

  it('wires a Field identically (label, description, validity, touched/dirty/filled/focused)', () => {
    const wrap = (ui: () => JSX.Element) => (
      <Form errors={{ on: 'required' }}>
        <Field.Root name="on" invalid>
          <Field.Label>On</Field.Label>
          {ui()}
          <Field.Description>Why</Field.Description>
          <Field.Error match>Error</Field.Error>
        </Field.Root>
      </Form>
    );
    const { fast, slow, fastEl, slowEl } = renderBoth(() => withThumb({}), wrap);
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-invalid', 'true');
    expect(fastEl).to.have.attribute('data-invalid');
    fireEvent.focus(fastEl);
    fireEvent.focus(slowEl);
    flush();
    expect(fastEl).to.have.attribute('data-focused');
    expect(stripIds(fast)).toBe(stripIds(slow));
    fireEvent.click(fastEl);
    fireEvent.click(slowEl);
    fireEvent.blur(fastEl);
    fireEvent.blur(slowEl);
    flush();
    expect(fastEl).to.have.attribute('data-dirty');
    expect(fastEl).to.have.attribute('data-touched');
    expect(fastEl).to.have.attribute('data-filled');
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('names itself from a wrapping or sibling label identically', () => {
    const wrapped = (ui: () => JSX.Element) => (
      <label>
        {ui()}
        Wrapped
      </label>
    );
    const a = renderBoth(() => ({}), wrapped);
    expect(a.fastEl.getAttribute('aria-labelledby')).toMatch(/-label$/);
    expect(stripIds(a.fast)).toBe(stripIds(a.slow));
    const sibling = (ui: () => JSX.Element) => (
      <div>
        {ui()}
        <label for="sw">Sibling</label>
      </div>
    );
    const b = renderBoth(() => ({ id: 'sw' }), sibling);
    expect(b.fastEl.getAttribute('aria-labelledby')).toBe(b.slowEl.getAttribute('aria-labelledby'));
    expect(b.fastEl.getAttribute('aria-labelledby')).toBe('sw-label');
  });

  it('keeps the slow path for render, spread and a native button', () => {
    expect(canRenderNative({ render: 'span' }, ['nativeButton'])).toBe(false);
    const { container } = render(() => <Switch.Root nativeButton render="button" />);
    expect(container.querySelector('button[role="switch"]')).not.toBe(null);
  });
});
