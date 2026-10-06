/*
 * Parity harness (plan 8 step 1.1): a part rendered through its Solid-native fast path and through
 * the existing `useRenderElement` slow path, with the same props, must produce identical DOM
 * (attributes, values, children), the same ref calls and the same handler behavior. The slow path
 * is forced with `render="button"`, which renders the same tag through `useRenderElement`.
 */
import { createRenderer } from '#test-utils';
import { Button } from '@solidports/base-ui/button';
import { Field } from '@solidports/base-ui/field';
import { fireEvent } from '@solidjs/testing-library';
import { createComponent } from '@solidjs/web';
import { createSignal, flush, merge } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { canRenderNative } from './index';

type Props = Record<string, unknown>;

/** The element with its attributes sorted by name (attribute order is not part of the contract). */
function normalized(el: Element) {
  const tag = el.tagName.toLowerCase();
  const attributes = Array.from(el.attributes)
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .sort()
    .join(' ');
  return `<${tag} ${attributes}>${el.innerHTML}</${tag}>`;
}

describe('native parity: Button', () => {
  const { render } = createRenderer();

  /**
   * Renders `make()`'s props natively and `make()`'s props plus `render: 'button'` through the slow
   * path, in two separate trees, and returns both buttons with their props objects.
   */
  function renderBoth(make: () => Props, wrap?: (ui: () => unknown) => unknown) {
    const fastProps = make();
    const slowProps = { ...Object.getOwnPropertyDescriptors(make()) };
    const slow = Object.defineProperties({}, slowProps) as Props;
    (slow as { render?: string }).render = 'button';
    // Own-property getters stay getters: a reactive prop reads its signal on each read.
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(fastProps)) as Props;
    expect(canRenderNative(fast, ['nativeButton']), 'fast props qualify for the native path').toBe(
      true,
    );
    const ui = (props: Props) => () => createComponent(Button, props as Button.Props);
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    const fastEl = fastResult.container.querySelector('button')!;
    const slowEl = slowResult.container.querySelector('button')!;
    expect(fastEl, 'native button rendered').not.toBe(null);
    expect(slowEl, 'slow-path button rendered').not.toBe(null);
    return { fastEl, slowEl, fast, slow };
  }

  const same = (a: Element, b: Element) => expect(normalized(a)).toBe(normalized(b));

  it('renders the same element for the props matrix', () => {
    const cases: Array<() => Props> = [
      () => ({ children: 'Plain' }),
      () => ({ children: 'Disabled', disabled: true }),
      () => ({ children: 'Focusable', disabled: true, focusableWhenDisabled: true }),
      () => ({ children: 'Focusable enabled', disabled: false, focusableWhenDisabled: true }),
      () => ({ children: 'Classes', class: 'a b', style: { color: 'red' } }),
      () => ({ children: 'String style', style: 'color: blue; margin: 0px' }),
      () => ({
        children: 'Functions',
        disabled: true,
        class: (state: Button.State) => (state.disabled ? 'is-off' : 'is-on'),
        style: (state: Button.State) => ({ opacity: state.disabled ? '0.5' : '1' }),
      }),
      () => ({ children: 'Empty class', class: '' }),
      () => ({ children: 'Overrides', type: 'submit', tabindex: 3, 'data-disabled': 'x' }),
      () => ({ children: 'Consumer disabled attr', disabled: true, 'aria-disabled': 'false' }),
      () => ({
        children: 'Forwarded',
        lang: 'fr',
        'data-foo': 'bar',
        'aria-label': 'label',
        title: 'title',
        id: 'button-id',
        hidden: true,
      }),
      () => ({ children: 'Undefined wins', title: undefined, type: undefined }),
      () => ({ children: 'Handlers', onClick: () => {}, onMouseMove: () => {}, onclick: () => {} }),
    ];
    for (const make of cases) {
      const { fastEl, slowEl } = renderBoth(make);
      same(fastEl, slowEl);
    }
  });

  it('follows reactive props the same way (attributes added, changed and removed)', () => {
    const [disabled, setDisabled] = createSignal(false);
    const [focusable, setFocusable] = createSignal(false);
    const [title, setTitle] = createSignal<string | undefined>('t1');
    const make = () => ({
      children: 'Reactive',
      get disabled() {
        return disabled();
      },
      get focusableWhenDisabled() {
        return focusable();
      },
      get title() {
        return title();
      },
      class: (state: Button.State) => (state.disabled ? 'off' : 'on'),
      style: (state: Button.State) => ({ opacity: state.disabled ? '0.5' : '1' }),
    });
    const { fastEl, slowEl } = renderBoth(make);
    same(fastEl, slowEl);
    expect(fastEl).to.have.attribute('class', 'on');
    setDisabled(true);
    flush();
    same(fastEl, slowEl);
    expect(fastEl).to.have.attribute('disabled');
    expect(fastEl).to.have.attribute('class', 'off');
    setFocusable(true);
    flush();
    same(fastEl, slowEl);
    expect(fastEl).not.to.have.attribute('disabled');
    expect(fastEl).to.have.attribute('aria-disabled', 'true');
    setTitle(undefined);
    flush();
    same(fastEl, slowEl);
    expect(fastEl).not.to.have.attribute('title');
    setDisabled(false);
    setFocusable(false);
    setTitle('t2');
    flush();
    same(fastEl, slowEl);
    expect(fastEl).to.have.attribute('title', 't2');
    expect(fastEl).to.have.attribute('class', 'on');
  });

  it('calls the consumer handlers in the same order with preventable events', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const make = () => ({
        children: 'Handlers',
        onClick: (event: MouseEvent & { preventBaseUIHandler?: () => void }) => {
          calls.push(`click:${typeof event.preventBaseUIHandler}`);
        },
        onKeyDown: (event: KeyboardEvent & { preventBaseUIHandler: () => void }) => {
          calls.push(`keydown:${event.key}`);
          event.preventBaseUIHandler();
        },
        onKeyUp: [
          (data: string, event: KeyboardEvent) => calls.push(`keyup:${data}:${event.key}`),
          'bound',
        ],
        onMouseDown: () => calls.push('mousedown'),
        onPointerDown: () => calls.push('pointerdown'),
        onMouseMove: () => calls.push('mousemove'),
        onfocus: () => calls.push('focus-lowercase'),
      });
      const { fastEl, slowEl } = renderBoth(make);
      const el = variant === 'fast' ? fastEl : slowEl;
      calls.push(`prevented:${fireEvent.click(el)}`);
      calls.push(`prevented:${fireEvent.keyDown(el, { key: 'Enter' })}`);
      calls.push(`prevented:${fireEvent.keyUp(el, { key: ' ' })}`);
      calls.push(`prevented:${fireEvent.mouseDown(el)}`);
      calls.push(`prevented:${fireEvent.pointerDown(el)}`);
      calls.push(`prevented:${fireEvent.mouseMove(el)}`);
      calls.push(`prevented:${fireEvent.focus(el)}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('click:function');
    expect(fast).toContain('keydown:Enter');
    expect(fast).toContain('keyup:bound: ');
    expect(fast).toEqual(run('slow'));
  });

  it('suppresses interactions identically when disabled and when focusable while disabled', () => {
    for (const focusableWhenDisabled of [false, true]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const make = () => ({
          children: 'Disabled',
          disabled: true,
          focusableWhenDisabled,
          onClick: () => calls.push('click'),
          onKeyDown: () => calls.push('keydown'),
          onKeyUp: () => calls.push('keyup'),
          onMouseDown: () => calls.push('mousedown'),
          onPointerDown: () => calls.push('pointerdown'),
          onMouseMove: () => calls.push('mousemove'),
        });
        const { fastEl, slowEl } = renderBoth(make);
        const el = variant === 'fast' ? fastEl : slowEl;
        calls.push(`click:${fireEvent.click(el)}`);
        calls.push(`keydown-tab:${fireEvent.keyDown(el, { key: 'Tab' })}`);
        calls.push(`keydown-space:${fireEvent.keyDown(el, { key: ' ' })}`);
        calls.push(`keyup:${fireEvent.keyUp(el, { key: ' ' })}`);
        calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
        calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
        calls.push(`mousemove:${fireEvent.mouseMove(el)}`);
        return calls;
      };
      expect(run('fast')).toEqual(run('slow'));
    }
  });

  it('applies refs the same way: callback refs once with the element, object refs set', () => {
    const run = (variant: 'fast' | 'slow') => {
      const callback = vi.fn();
      const object = { current: null as Element | null };
      const make = () => ({ children: 'Refs', ref: callback });
      const { fastEl, slowEl } = renderBoth(make);
      const el = variant === 'fast' ? fastEl : slowEl;
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls.map((call) => (call[0] as Element).tagName)).toEqual([
        'BUTTON',
        'BUTTON',
      ]);
      expect(callback.mock.calls.some((call) => call[0] === el)).toBe(true);
      // Object refs.
      const makeObject = () => ({ children: 'Object ref', ref: object });
      const both = renderBoth(makeObject);
      const target = variant === 'fast' ? both.fastEl : both.slowEl;
      expect([both.fastEl, both.slowEl]).toContain(object.current);
      return target.tagName;
    };
    expect(run('fast')).toBe(run('slow'));
  });

  it('renders identically inside a Field', () => {
    const wrap = (ui: () => unknown) => (
      <Field.Root name="field">
        <Field.Label>Label</Field.Label>
        {ui() as never}
      </Field.Root>
    );
    const { fastEl, slowEl } = renderBoth(() => ({ children: 'In field', disabled: true }), wrap);
    same(fastEl, slowEl);
  });

  it('renders dynamic children identically', () => {
    const [count, setCount] = createSignal(1);
    const make = () => ({
      get children() {
        return `Count ${count()}`;
      },
    });
    const { fastEl, slowEl } = renderBoth(make);
    same(fastEl, slowEl);
    setCount(2);
    flush();
    same(fastEl, slowEl);
    expect(fastEl.textContent).toBe('Count 2');
  });

  it('keeps the slow path for spread props, a render prop and a reactive ref', () => {
    const [ref] = createSignal<(el: Element) => void>(() => {});
    const reactiveRef = {
      get ref() {
        return ref();
      },
    };
    expect(canRenderNative(reactiveRef)).toBe(false);
    expect(canRenderNative({ render: undefined })).toBe(false);
    expect(canRenderNative(merge({ a: 1 }, { b: 2 }))).toBe(false);
    expect(canRenderNative({ render: 'span' })).toBe(false);
    const [native] = createSignal(true);
    const reactiveStatic = {
      get nativeButton() {
        return native();
      },
    };
    expect(canRenderNative(reactiveStatic, ['nativeButton'])).toBe(false);
    expect(canRenderNative({ nativeButton: true }, ['nativeButton'])).toBe(true);
  });
});
