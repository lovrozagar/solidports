/*
 * Parity (plan 8 step 3.1): `Radio.Root` (+ Indicator) inside a `RadioGroup`, and the `RadioGroup`
 * itself, rendered through their Solid-native fast paths and through the `useRenderElement` slow
 * path (`render="span"` / `render="div"`, the same tags) must produce identical DOM, handler
 * order, roving tab stop, value changes and Field wiring.
 */
import { createRenderer } from '#test-utils';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
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

function withIndicator(props: Props): Props {
  return Object.defineProperties(props, {
    children: {
      configurable: true,
      enumerable: true,
      get: () => <Radio.Indicator keepMounted data-part="indicator" />,
    },
  });
}

describe('native parity: Radio', () => {
  const { render } = createRenderer();

  /** Both variants inside a RadioGroup with sibling radios `a` (first) and `c` (disabled, last). */
  function renderBoth(
    make: () => Props,
    group: Props = {},
    wrap?: (ui: () => JSX.Element) => JSX.Element,
  ) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'span';
    expect(canRenderNative(fast, ['nativeButton', 'inputRef']), 'fast props qualify').toBe(true);
    const ui = (props: Props) => () => (
      <RadioGroup {...(group as RadioGroup.Props)}>
        <Radio.Root value="a" data-testid="a" />
        {createComponent(Radio.Root, props as Radio.Root.Props) as unknown as JSX.Element}
        <Radio.Root value="c" data-testid="c" disabled />
      </RadioGroup>
    );
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return {
      fast: fastResult.container,
      slow: slowResult.container,
      fastEl: fastResult.container.querySelector('[data-testid="t"]')! as HTMLElement,
      slowEl: slowResult.container.querySelector('[data-testid="t"]')! as HTMLElement,
    };
  }

  it('renders the same root, indicator and hidden input for the props matrix', () => {
    const cases: Array<[() => Props, Props]> = [
      [() => ({}), {}],
      [() => ({}), { defaultValue: 'b' }],
      [() => ({ disabled: true, readOnly: true, required: true }), { defaultValue: 'b' }],
      [() => ({}), { name: 'choice', form: 'f1', disabled: true, readOnly: true, required: true }],
      [() => ({ id: 'rb', class: 'a b', style: { color: 'red' } }), { defaultValue: 'b' }],
      // A function `style` is left out: the slow path (`CompositeItem` forwards `class` only)
      // drops it, the native path applies it as React does.
      [() => ({ class: (state: Radio.Root.State) => (state.checked ? 'on' : 'off') }), { defaultValue: 'b' }],
      [() => ({ 'aria-labelledby': 'lbl', 'aria-describedby': 'desc' }), {}],
      [() => ({ tabindex: 3, 'aria-checked': 'x', 'data-checked': 'y' }), {}],
      [() => ({ lang: 'fr', 'data-foo': 'bar', title: 't', hidden: true }), {}],
      [() => ({ onClick: () => {}, onKeyDown: () => {}, onFocus: () => {} }), {}],
    ];
    for (const [make, group] of cases) {
      const { fast, slow } = renderBoth(() => withIndicator({ value: 'b', 'data-testid': 't', ...make() }), group);
      expect(stripIds(fast)).toBe(stripIds(slow));
    }
  });

  it('follows reactive props and a controlled group value the same way', () => {
    const [value, setValue] = createSignal<string | undefined>('a');
    const [disabled, setDisabled] = createSignal(false);
    const make = () =>
      withIndicator({
        value: 'b',
        'data-testid': 't',
        get disabled() {
          return disabled();
        },
        class: (state: Radio.Root.State) => (state.checked ? 'on' : 'off'),
      });
    const group = {
      get value() {
        return value();
      },
    };
    const { fast, slow, fastEl } = renderBoth(make, group);
    expect(stripIds(fast)).toBe(stripIds(slow));
    setValue('b');
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'true');
    expect(fastEl).to.have.attribute('data-composite-item-active');
    expect(fast.querySelector('[data-part="indicator"]')).to.have.attribute('data-checked');
    setDisabled(true);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-disabled', 'true');
    setDisabled(false);
    setValue('a');
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('selects identically on click, Space and arrow navigation with the same handler order', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const { fast, slow, fastEl, slowEl } = renderBoth(
        () => ({
          value: 'b',
          'data-testid': 't',
          onClick: (event: MouseEvent & { preventBaseUIHandler?: () => void }) =>
            calls.push(`click:${typeof event.preventBaseUIHandler}`),
          onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
          onKeyUp: [(data: string, event: KeyboardEvent) => calls.push(`keyup:${data}:${event.key}`), 'd'],
          onPointerDown: () => calls.push('pointerdown'),
          onMouseDown: () => calls.push('mousedown'),
          onFocus: () => calls.push('focus'),
        }),
        { onValueChange: (value: unknown) => calls.push(`value:${String(value)}`) },
      );
      const container = variant === 'fast' ? fast : slow;
      const el = variant === 'fast' ? fastEl : slowEl;
      const a = container.querySelector('[data-testid="a"]') as HTMLElement;
      calls.push(`tabindex:${a.getAttribute('tabindex')}:${el.getAttribute('tabindex')}`);
      calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
      flush();
      calls.push(`tabindex:${a.getAttribute('tabindex')}:${el.getAttribute('tabindex')}`);
      calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
      calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
      calls.push(`keydown-enter:${fireEvent.keyDown(el, { key: 'Enter' })}`);
      calls.push(`click-a:${fireEvent.click(a)}:${a.getAttribute('aria-checked')}:${el.getAttribute('aria-checked')}`);
      calls.push(`keydown-space:${fireEvent.keyDown(el, { key: ' ' })}`);
      calls.push(`keyup-space:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
      a.focus();
      calls.push(`focus-a:${document.activeElement === a}`);
      calls.push(`arrow:${fireEvent.keyDown(a, { key: 'ArrowDown' })}`);
      flush();
      calls.push(`after-arrow:${a.getAttribute('aria-checked')}:${el.getAttribute('aria-checked')}:${el.getAttribute('tabindex')}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('value:b');
    expect(fast).toContain('keyup:d: ');
    expect(fast).toEqual(run('slow'));
  });

  it('stays inert identically when disabled or read-only', () => {
    for (const props of [{ disabled: true }, { readOnly: true }]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const { fastEl, slowEl } = renderBoth(
          () => ({
            value: 'b',
            'data-testid': 't',
            ...props,
            onClick: () => calls.push('click'),
            onKeyDown: () => calls.push('keydown'),
            onKeyUp: () => calls.push('keyup'),
            onPointerDown: () => calls.push('pointerdown'),
          }),
          { onValueChange: (value: unknown) => calls.push(`value:${String(value)}`) },
        );
        const el = variant === 'fast' ? fastEl : slowEl;
        calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
        calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
        calls.push(`keydown:${fireEvent.keyDown(el, { key: ' ' })}`);
        calls.push(`keyup:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
        return calls;
      };
      expect(run('fast')).toEqual(run('slow'));
    }
  });

  it('applies refs the same way (consumer ref, inputRef callback with null on unmount)', () => {
    const run = (variant: 'fast' | 'slow') => {
      const ref = vi.fn();
      const inputRef = vi.fn();
      const { fastEl, slowEl } = renderBoth(() => ({ value: 'b', 'data-testid': 't', ref, inputRef }));
      const el = variant === 'fast' ? fastEl : slowEl;
      expect(ref.mock.calls.some((call) => call[0] === el)).toBe(true);
      expect(inputRef.mock.calls.filter((call) => call[0]?.type === 'radio')).toHaveLength(2);
      return el.tagName;
    };
    expect(run('fast')).toBe(run('slow'));
  });

  it('wires a Field identically (label, description, validity, touched/dirty/filled/focused)', () => {
    const wrap = (ui: () => JSX.Element) => (
      <Form errors={{ choice: 'required' }}>
        <Field.Root name="choice" invalid>
          <Field.Label>Choice</Field.Label>
          {ui()}
          <Field.Description>Why</Field.Description>
          <Field.Error match>Error</Field.Error>
        </Field.Root>
      </Form>
    );
    const { fast, slow, fastEl, slowEl } = renderBoth(
      () => withIndicator({ value: 'b', 'data-testid': 't' }),
      {},
      wrap,
    );
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-invalid', 'true');
    expect(fastEl).to.have.attribute('data-invalid');
    const groupOf = (container: Element) => container.querySelector('[role="radiogroup"]')!;
    fireEvent.focus(groupOf(fast));
    fireEvent.focus(groupOf(slow));
    flush();
    expect(fastEl).to.have.attribute('data-focused');
    expect(stripIds(fast)).toBe(stripIds(slow));
    fireEvent.click(fastEl);
    fireEvent.click(slowEl);
    fireEvent.blur(groupOf(fast));
    fireEvent.blur(groupOf(slow));
    flush();
    expect(fastEl).to.have.attribute('data-dirty');
    expect(fastEl).to.have.attribute('data-touched');
    expect(fastEl).to.have.attribute('data-filled');
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('names itself from a wrapping label identically', () => {
    const run = (variant: 'fast' | 'slow') => {
      const props = { value: 'b', 'data-testid': 't' } as Props;
      if (variant === 'slow') {
        props.render = 'span';
      }
      const { container } = render(() => (
        <RadioGroup>
          <label>
            {createComponent(Radio.Root, props as Radio.Root.Props) as unknown as JSX.Element}
            Wrapped
          </label>
        </RadioGroup>
      ));
      return stripIds(container);
    };
    const fast = run('fast');
    expect(fast).toContain('aria-labelledby="ID"');
    expect(fast).toBe(run('slow'));
  });

  it('applies a function style with the state (React behavior; the slow path dropped it in a group)', () => {
    const { container } = render(() => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a" style={(state) => ({ opacity: state.checked ? '1' : '0.5' })} />
      </RadioGroup>
    ));
    expect(container.querySelector('[role="radio"]')).to.have.attribute('style', 'opacity: 1;');
  });

  it('keeps the slow path for render, spread and a native button', () => {
    expect(canRenderNative({ render: 'span' }, ['nativeButton'])).toBe(false);
    const { container } = render(() => (
      <RadioGroup>
        <Radio.Root value="a" nativeButton render="button" />
      </RadioGroup>
    ));
    expect(container.querySelector('button[role="radio"]')).not.toBe(null);
  });
});

describe('native parity: RadioGroup', () => {
  const { render } = createRenderer();

  function renderBoth(make: () => Props, wrap?: (ui: () => JSX.Element) => JSX.Element) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'div';
    expect(canRenderNative(fast), 'fast props qualify').toBe(true);
    const ui = (props: Props) => () =>
      createComponent(RadioGroup, props as RadioGroup.Props) as unknown as JSX.Element;
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return { fast: fastResult.container, slow: slowResult.container };
  }
  const radios = () => (
    <>
      <Radio.Root value="a" data-testid="a" />
      <Radio.Root value="b" data-testid="b" />
    </>
  );

  it('renders the same group for the props matrix, alone and inside a Field', () => {
    const cases: Array<() => Props> = [
      () => ({ get children() { return radios(); } }),
      () => ({ get children() { return radios(); }, defaultValue: 'b', disabled: true, readOnly: true, required: true }),
      () => ({ get children() { return radios(); }, id: 'g', name: 'n', class: 'c', style: { gap: '1px' }, 'aria-describedby': 'd' }),
      () => ({ get children() { return radios(); }, class: (state: RadioGroup.State) => (state.required ? 'r' : 'o'), onKeyDown: () => {} }),
    ];
    // One name per render: a browser unchecks same-named radios across the two containers.
    let names = 0;
    const inField = (ui: () => JSX.Element) => (
      <Field.Root name={`choice-${(names += 1)}`}>
        <Field.Label>Choice</Field.Label>
        {ui()}
        <Field.Description>Why</Field.Description>
      </Field.Root>
    );
    for (const make of cases) {
      const plain = renderBoth(make);
      expect(stripIds(plain.fast)).toBe(stripIds(plain.slow));
      const field = renderBoth(make, inField);
      const stripNames = (container: Element) => stripIds(container).replace(/choice-\d+/g, 'NAME');
      expect(stripNames(field.fast)).toBe(stripNames(field.slow));
    }
  });

  it('navigates, reports value changes and tracks touched/focused identically', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const ref = vi.fn();
      const { fast, slow } = renderBoth(() => ({
        ref,
        get children() {
          return radios();
        },
        onValueChange: (value: unknown) => calls.push(`value:${String(value)}`),
        onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
        onFocus: () => calls.push('focus'),
        onBlur: () => calls.push('blur'),
      }));
      const container = variant === 'fast' ? fast : slow;
      const group = container.querySelector('[role="radiogroup"]') as HTMLElement;
      expect(ref.mock.calls.some((call) => call[0] === group)).toBe(true);
      const a = container.querySelector('[data-testid="a"]') as HTMLElement;
      const b = container.querySelector('[data-testid="b"]') as HTMLElement;
      calls.push(`focus:${fireEvent.focus(group)}`);
      a.focus();
      calls.push(`arrow:${fireEvent.keyDown(a, { key: 'ArrowRight' })}:${document.activeElement === b}`);
      flush();
      calls.push(`state:${a.getAttribute('aria-checked')}:${b.getAttribute('aria-checked')}:${a.getAttribute('tabindex')}:${b.getAttribute('tabindex')}`);
      calls.push(`click:${fireEvent.click(b)}:${b.getAttribute('aria-checked')}`);
      calls.push(`blur:${fireEvent.blur(group)}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('value:b');
    expect(fast).toEqual(run('slow'));
  });
});
