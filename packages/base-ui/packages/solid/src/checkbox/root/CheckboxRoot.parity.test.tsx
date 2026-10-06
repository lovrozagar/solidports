/*
 * Parity (plan 8 step 3.1): `Checkbox.Root` rendered through its Solid-native fast path and through
 * the `useRenderElement` slow path (`render="span"`, the same tag) must produce identical DOM for
 * the root, the hidden input and the indicator, the same handler order and the same Field wiring.
 */
import { createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { fireEvent } from '@solidjs/testing-library';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { canRenderNative } from '../../utils/native';

type Props = Record<string, unknown>;

/** `props` plus a kept-mounted indicator as a lazy child (created inside the root's context). */
function withIndicator(props: Props): Props {
  return Object.defineProperties(props, {
    children: {
      configurable: true,
      enumerable: true,
      get: () => <Checkbox.Indicator keepMounted>✓</Checkbox.Indicator>,
    },
  });
}

const stripIds = (container: Element) =>
  normalized(container).replace(/(base-ui|mui)-[A-Za-z0-9-]+/g, 'ID');

/** The subtree with every element's attributes sorted by name (attribute order is not part of the contract). */
function normalized(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attributes = Array.from(el.attributes)
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .sort()
    .join(' ');
  const children = Array.from(el.childNodes)
    .map((node) => (node instanceof Element ? normalized(node) : node.textContent))
    .join('');
  const input = el instanceof HTMLInputElement ? ` checked=${el.checked} indeterminate=${el.indeterminate}` : '';
  return `<${tag} ${attributes}${input}>${children}</${tag}>`;
}

describe('native parity: Checkbox', () => {
  const { render } = createRenderer();

  function renderBoth(make: () => Props, wrap?: (ui: () => JSX.Element) => JSX.Element) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'span';
    expect(canRenderNative(fast, ['nativeButton', 'parent', 'inputRef']), 'fast props qualify').toBe(
      true,
    );
    const ui = (props: Props) => () =>
      createComponent(Checkbox.Root, props as Checkbox.Root.Props) as unknown as JSX.Element;
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return {
      fast: fastResult.container,
      slow: slowResult.container,
      fastEl: fastResult.container.querySelector('[role="checkbox"]')!,
      slowEl: slowResult.container.querySelector('[role="checkbox"]')!,
    };
  }

  const same = (a: Element, b: Element) => expect(normalized(a)).toBe(normalized(b));

  it('renders the same root, hidden input and indicator for the props matrix', () => {
    const cases: Array<() => Props> = [
      () => ({}),
      () => ({ defaultChecked: true }),
      () => ({ checked: true, indeterminate: true }),
      () => ({ disabled: true, readOnly: true, required: true }),
      () => ({ name: 'agree', value: 'yes', form: 'f1', id: 'cb-id' }),
      () => ({ name: 'agree', uncheckedValue: 'no' }),
      () => ({ class: 'a b', style: { color: 'red' } }),
      () => ({
        checked: true,
        class: (state: Checkbox.Root.State) => (state.checked ? 'on' : 'off'),
        style: (state: Checkbox.Root.State) => ({ opacity: state.disabled ? '0.5' : '1' }),
      }),
      () => ({ 'aria-labelledby': 'lbl', 'aria-describedby': 'desc' }),
      () => ({ tabindex: 3, 'aria-checked': 'x', 'data-checked': 'y' }),
      () => ({ lang: 'fr', 'data-foo': 'bar', title: 't', hidden: true }),
      () => ({ title: undefined }),
      () => ({ onClick: () => {}, onKeyDown: () => {}, onFocus: () => {} }),
    ];
    for (const make of cases) {
      const { fast, slow } = renderBoth(() => withIndicator(make()));
      expect(stripIds(fast)).toBe(stripIds(slow));
    }
  });

  it('follows reactive props the same way', () => {
    const [checked, setChecked] = createSignal(false);
    const [disabled, setDisabled] = createSignal(false);
    const [indeterminate, setIndeterminate] = createSignal(false);
    const [title, setTitle] = createSignal<string | undefined>('t1');
    const make = () => ({
      get children() {
        return <Checkbox.Indicator keepMounted>✓</Checkbox.Indicator>;
      },
      get checked() {
        return checked();
      },
      get disabled() {
        return disabled();
      },
      get indeterminate() {
        return indeterminate();
      },
      get title() {
        return title();
      },
      class: (state: Checkbox.Root.State) => (state.checked ? 'on' : 'off'),
    });
    const { fast, slow, fastEl } = renderBoth(make);
    expect(stripIds(fast)).toBe(stripIds(slow));
    setChecked(true);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'true');
    expect(fastEl).to.have.attribute('data-checked');
    setIndeterminate(true);
    setDisabled(true);
    setTitle(undefined);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'mixed');
    expect(fastEl).to.have.attribute('tabindex', '-1');
    expect(fastEl).not.to.have.attribute('title');
    setIndeterminate(false);
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
        get children() {
          return <Checkbox.Indicator>✓</Checkbox.Indicator>;
        },
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
      const { fastEl, slowEl, fast, slow } = renderBoth(make);
      const el = variant === 'fast' ? fastEl : slowEl;
      const container = variant === 'fast' ? fast : slow;
      calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
      calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
      calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
      calls.push(`keydown-space:${fireEvent.keyDown(el, { key: ' ' })}`);
      calls.push(`keyup-space:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
      calls.push(`keydown-enter:${fireEvent.keyDown(el, { key: 'Enter' })}`);
      calls.push(`focus:${fireEvent.focus(el)}`);
      calls.push(`blur:${fireEvent.blur(el)}`);
      calls.push(`indicator:${container.querySelector('[data-checked] span') != null}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('change:true');
    expect(fast).toContain('keyup:d: ');
    expect(fast).toEqual(run('slow'));
  });

  it('stays inert identically when disabled or read-only', () => {
    for (const props of [{ disabled: true }, { readOnly: true }]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const make = () => ({
          ...props,
          onCheckedChange: (next: boolean) => calls.push(`change:${next}`),
          onClick: () => calls.push('click'),
          onKeyDown: () => calls.push('keydown'),
          onKeyUp: () => calls.push('keyup'),
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

  it('honors preventBaseUIHandler identically', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const make = () => ({
        onCheckedChange: (next: boolean) => calls.push(`change:${next}`),
        onClick: (event: { preventBaseUIHandler: () => void }) => {
          calls.push('click');
          event.preventBaseUIHandler();
        },
        onKeyUp: (event: { preventBaseUIHandler: () => void }) => {
          calls.push('keyup');
          event.preventBaseUIHandler();
        },
      });
      const { fastEl, slowEl } = renderBoth(make);
      const el = variant === 'fast' ? fastEl : slowEl;
      calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-checked')}`);
      calls.push(`keyup:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-checked')}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toEqual(['click', 'click:true:false', 'keyup', 'keyup:true:false']);
    expect(fast).toEqual(run('slow'));
  });

  it('applies refs the same way (consumer callback and object refs, inputRef)', () => {
    const run = (variant: 'fast' | 'slow') => {
      const ref = vi.fn();
      const inputRef = { current: null as HTMLInputElement | null };
      const inputRefFn = vi.fn();
      const { fastEl, slowEl } = renderBoth(() => ({ ref, inputRef: variant === 'fast' ? inputRef : inputRefFn }));
      const el = variant === 'fast' ? fastEl : slowEl;
      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref.mock.calls.some((call) => call[0] === el)).toBe(true);
      if (variant === 'fast') {
        expect(inputRef.current?.type).toBe('checkbox');
      } else {
        expect(inputRefFn.mock.calls[0][0].type).toBe('checkbox');
      }
      return el.tagName;
    };
    expect(run('fast')).toBe(run('slow'));
  });

  it('wires a Field identically (label, description, validity, touched/dirty/filled/focused)', () => {
    const wrap = (ui: () => JSX.Element) => (
      <Form errors={{ agree: 'required' }}>
        <Field.Root name="agree" invalid>
          <Field.Label>Agree</Field.Label>
          {ui()}
          <Field.Description>Why</Field.Description>
          <Field.Error match>Error</Field.Error>
        </Field.Root>
      </Form>
    );
    const { fast, slow, fastEl, slowEl } = renderBoth(() => withIndicator({}), wrap);
    const strip = stripIds;
    expect(strip(fast)).toBe(strip(slow));
    expect(fastEl).to.have.attribute('aria-invalid', 'true');
    expect(fastEl).to.have.attribute('data-invalid');
    fireEvent.focus(fastEl);
    fireEvent.focus(slowEl);
    flush();
    expect(fastEl).to.have.attribute('data-focused');
    expect(strip(fast)).toBe(strip(slow));
    fireEvent.click(fastEl);
    fireEvent.click(slowEl);
    fireEvent.blur(fastEl);
    fireEvent.blur(slowEl);
    flush();
    expect(fastEl).to.have.attribute('data-dirty');
    expect(fastEl).to.have.attribute('data-touched');
    expect(fastEl).to.have.attribute('data-filled');
    expect(strip(fast)).toBe(strip(slow));
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
        <label for="box">Sibling</label>
      </div>
    );
    const b = renderBoth(() => ({ id: 'box' }), sibling);
    expect(b.fastEl.getAttribute('aria-labelledby')).toBe(b.slowEl.getAttribute('aria-labelledby'));
    expect(b.fastEl.getAttribute('aria-labelledby')).toBe('box-label');
  });

  it('renders identically inside a CheckboxGroup with a parent checkbox', () => {
    const all = ['a', 'b'];
    const wrap = (ui: () => JSX.Element) => (
      <CheckboxGroup allValues={all} defaultValue={['a']}>
        <Checkbox.Root parent data-testid="parent">
          <Checkbox.Indicator keepMounted />
        </Checkbox.Root>
        {ui()}
        <Checkbox.Root value="b">
          <Checkbox.Indicator keepMounted />
        </Checkbox.Root>
      </CheckboxGroup>
    );
    const { fast, slow } = renderBoth(
      () => withIndicator({ value: 'a', 'data-testid': 'child' }),
      wrap,
    );
    const fastEl = fast.querySelector('[data-testid="child"]')!;
    const slowEl = slow.querySelector('[data-testid="child"]')!;
    const parentOf = (container: Element) => container.querySelector('[data-testid="parent"]')!;
    const strip = stripIds;
    expect(strip(fast)).toBe(strip(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'true');
    expect(parentOf(fast)).to.have.attribute('aria-checked', 'mixed');
    fireEvent.click(fastEl);
    fireEvent.click(slowEl);
    flush();
    expect(strip(fast)).toBe(strip(slow));
    expect(parentOf(fast)).to.have.attribute('aria-checked', 'false');
    fireEvent.click(parentOf(fast));
    fireEvent.click(parentOf(slow));
    flush();
    expect(strip(fast)).toBe(strip(slow));
    expect(fastEl).to.have.attribute('aria-checked', 'true');
    expect(parentOf(fast)).to.have.attribute('aria-checked', 'true');
  });

  it('keeps the slow path for render, spread, a native button and a reactive parent', () => {
    expect(canRenderNative({ render: 'span' }, ['nativeButton', 'parent'])).toBe(false);
    const [parent] = createSignal(false);
    expect(
      canRenderNative(
        {
          get parent() {
            return parent();
          },
        },
        ['nativeButton', 'parent'],
      ),
    ).toBe(false);
    const { container } = render(() => <Checkbox.Root nativeButton render="button" />);
    expect(container.querySelector('button[role="checkbox"]')).not.toBe(null);
  });
});
