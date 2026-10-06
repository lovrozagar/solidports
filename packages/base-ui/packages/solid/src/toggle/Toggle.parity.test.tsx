/*
 * Parity (plan 8 step 3.1): `Toggle` (alone, in a `ToggleGroup`, in a `Toolbar`) and
 * `ToggleGroup` rendered through their Solid-native fast paths and through the `useRenderElement`
 * slow path (`render="button"` / `render="div"`, the same tags) must produce identical DOM, the
 * same handler order, the same roving focus and the same group value changes.
 */
import { createRenderer } from '#test-utils';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { fireEvent } from '@solidjs/testing-library';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { canRenderNative } from '../utils/native';

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
  return `<${tag} ${attributes}>${children}</${tag}>`;
}
const stripIds = (container: Element) =>
  normalized(container).replace(/(base-ui|mui)-[A-Za-z0-9-]+/g, 'ID');

describe('native parity: Toggle', () => {
  const { render } = createRenderer();

  function renderBoth(make: () => Props, wrap?: (ui: () => JSX.Element) => JSX.Element) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'button';
    expect(canRenderNative(fast, ['nativeButton']), 'fast props qualify').toBe(true);
    const ui = (props: Props) => () =>
      createComponent(Toggle, props as Toggle.Props) as unknown as JSX.Element;
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return {
      fast: fastResult.container,
      slow: slowResult.container,
      fastEl: fastResult.container.querySelector('[data-testid="t"]')!,
      slowEl: slowResult.container.querySelector('[data-testid="t"]')!,
    };
  }

  it('renders the same element for the props matrix (alone)', () => {
    const cases: Array<() => Props> = [
      () => ({ children: 'Plain' }),
      () => ({ children: 'Pressed', defaultPressed: true }),
      () => ({ children: 'Controlled', pressed: true, disabled: true }),
      () => ({ children: 'Value', value: 'v', form: 'f', type: 'submit' }),
      () => ({ children: 'Classes', class: 'a b', style: { color: 'red' } }),
      () => ({
        children: 'Functions',
        pressed: true,
        class: (state: Toggle.State) => (state.pressed ? 'on' : 'off'),
        style: (state: Toggle.State) => ({ opacity: state.disabled ? '0.5' : '1' }),
      }),
      () => ({ children: 'Overrides', tabindex: 3, 'aria-pressed': 'x', 'data-pressed': 'y' }),
      () => ({ children: 'Forwarded', lang: 'fr', 'data-foo': 'bar', title: 't', id: 'id' }),
      () => ({ children: 'Handlers', onClick: () => {}, onKeyDown: () => {}, onFocus: () => {} }),
    ];
    for (const make of cases) {
      const { fast, slow } = renderBoth(() => ({ 'data-testid': 't', ...make() }));
      expect(stripIds(fast)).toBe(stripIds(slow));
    }
  });

  it('follows reactive props the same way', () => {
    const [pressed, setPressed] = createSignal(false);
    const [disabled, setDisabled] = createSignal(false);
    const make = () => ({
      'data-testid': 't',
      children: 'Reactive',
      get pressed() {
        return pressed();
      },
      get disabled() {
        return disabled();
      },
      class: (state: Toggle.State) => (state.pressed ? 'on' : 'off'),
    });
    const { fast, slow, fastEl } = renderBoth(make);
    expect(stripIds(fast)).toBe(stripIds(slow));
    setPressed(true);
    setDisabled(true);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-pressed', 'true');
    expect(fastEl).to.have.attribute('disabled');
    expect(fastEl).to.have.attribute('class', 'on');
    setPressed(false);
    setDisabled(false);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('toggles identically with the same handler order, and stays inert when disabled', () => {
    for (const disabled of [false, true]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const make = () => ({
          'data-testid': 't',
          children: 'T',
          disabled,
          onPressedChange: (next: boolean) => calls.push(`change:${next}`),
          onClick: (event: MouseEvent & { preventBaseUIHandler?: () => void }) =>
            calls.push(`click:${typeof event.preventBaseUIHandler}`),
          onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
          onKeyUp: [(data: string, event: KeyboardEvent) => calls.push(`keyup:${data}:${event.key}`), 'd'],
          onPointerDown: () => calls.push('pointerdown'),
          onMouseDown: () => calls.push('mousedown'),
        });
        const { fastEl, slowEl } = renderBoth(make);
        const el = variant === 'fast' ? fastEl : slowEl;
        calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-pressed')}`);
        calls.push(`pointerdown:${fireEvent.pointerDown(el)}`);
        calls.push(`mousedown:${fireEvent.mouseDown(el)}`);
        calls.push(`keydown-space:${fireEvent.keyDown(el, { key: ' ' })}`);
        calls.push(`keyup-space:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-pressed')}`);
        calls.push(`keydown-enter:${fireEvent.keyDown(el, { key: 'Enter' })}`);
        return calls;
      };
      const fast = run('fast');
      if (!disabled) {
        expect(fast).toContain('change:true');
        expect(fast).toContain('keyup:d: ');
      }
      expect(fast).toEqual(run('slow'));
    }
  });

  it('honors preventBaseUIHandler identically', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const { fastEl, slowEl } = renderBoth(() => ({
        'data-testid': 't',
        children: 'T',
        onPressedChange: (next: boolean) => calls.push(`change:${next}`),
        onClick: (event: { preventBaseUIHandler: () => void }) => {
          calls.push('click');
          event.preventBaseUIHandler();
        },
      }));
      const el = variant === 'fast' ? fastEl : slowEl;
      calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-pressed')}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toEqual(['click', 'click:true:false']);
    expect(fast).toEqual(run('slow'));
  });

  it('applies refs the same way', () => {
    const run = (variant: 'fast' | 'slow') => {
      const ref = vi.fn();
      const { fastEl, slowEl } = renderBoth(() => ({ 'data-testid': 't', children: 'T', ref }));
      const el = variant === 'fast' ? fastEl : slowEl;
      expect(ref).toHaveBeenCalledTimes(2);
      expect(ref.mock.calls.some((call) => call[0] === el)).toBe(true);
      return el.tagName;
    };
    expect(run('fast')).toBe(run('slow'));
  });

  it('renders and behaves identically inside a ToggleGroup (roving focus, group value, Space on keydown)', () => {
    for (const multiple of [false, true]) {
      const run = (variant: 'fast' | 'slow') => {
        const calls: string[] = [];
        const wrap = (ui: () => JSX.Element) => (
          <ToggleGroup
            multiple={multiple}
            defaultValue={['b']}
            onValueChange={(value) => calls.push(`group:${value.join(',')}`)}
          >
            <Toggle value="a" data-testid="a">
              A
            </Toggle>
            {ui()}
            <Toggle value="c" data-testid="c" disabled>
              C
            </Toggle>
          </ToggleGroup>
        );
        const { fast, slow, fastEl, slowEl } = renderBoth(
          () => ({
            'data-testid': 't',
            value: 'b',
            children: 'B',
            onPressedChange: (next: boolean) => calls.push(`pressed:${next}`),
            onFocus: () => calls.push('focus'),
            onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
          }),
          wrap,
        );
        const container = variant === 'fast' ? fast : slow;
        const el = variant === 'fast' ? fastEl : slowEl;
        expect(stripIds(fast)).toBe(stripIds(slow));
        const a = container.querySelector('[data-testid="a"]')! as HTMLElement;
        calls.push(`tabindex:${a.getAttribute('tabindex')}:${el.getAttribute('tabindex')}`);
        a.focus();
        calls.push(`focus-a:${a.getAttribute('tabindex')}`);
        calls.push(`arrow:${fireEvent.keyDown(a, { key: 'ArrowRight' })}:${document.activeElement === el}`);
        flush();
        calls.push(`tabindex:${a.getAttribute('tabindex')}:${el.getAttribute('tabindex')}`);
        calls.push(`space:${fireEvent.keyDown(el, { key: ' ' })}:${el.getAttribute('aria-pressed')}`);
        calls.push(`keyup:${fireEvent.keyUp(el, { key: ' ' })}:${el.getAttribute('aria-pressed')}`);
        calls.push(`click-a:${fireEvent.click(a)}:${a.getAttribute('aria-pressed')}:${el.getAttribute('aria-pressed')}`);
        calls.push(`click:${fireEvent.click(el)}:${el.getAttribute('aria-pressed')}`);
        return calls;
      };
      const fast = run('fast');
      expect(fast).toContain('group:');
      expect(fast).toEqual(run('slow'));
    }
  });

  it('renders identically inside a Toolbar and reports its disabled metadata', () => {
    const [disabled, setDisabled] = createSignal(false);
    const wrap = (ui: () => JSX.Element) => (
      <Toolbar.Root>
        <ToggleGroup>
          {ui()}
          <Toggle value="b" data-testid="b">
            B
          </Toggle>
        </ToggleGroup>
        <Toolbar.Button data-testid="btn">Button</Toolbar.Button>
      </Toolbar.Root>
    );
    const { fast, slow, fastEl, slowEl } = renderBoth(
      () => ({
        'data-testid': 't',
        value: 'a',
        children: 'A',
        get disabled() {
          return disabled();
        },
      }),
      wrap,
    );
    expect(stripIds(fast)).toBe(stripIds(slow));
    expect(fastEl).to.have.attribute('aria-disabled', 'false');
    expect(fastEl).to.have.attribute('tabindex', '0');
    setDisabled(true);
    flush();
    expect(stripIds(fast)).toBe(stripIds(slow));
    // A disabled toggle leaves roving focus: ArrowRight from the toolbar skips it.
    const fastB = fast.querySelector('[data-testid="b"]') as HTMLElement;
    const slowB = slow.querySelector('[data-testid="b"]') as HTMLElement;
    fastB.focus();
    fireEvent.keyDown(fastB, { key: 'ArrowLeft' });
    slowB.focus();
    fireEvent.keyDown(slowB, { key: 'ArrowLeft' });
    flush();
    expect(document.activeElement === fastEl).toBe(false);
    expect(fastEl.getAttribute('tabindex')).toBe(slowEl.getAttribute('tabindex'));
    expect(stripIds(fast)).toBe(stripIds(slow));
  });

  it('keeps the slow path for render, spread and a non-native button', () => {
    expect(canRenderNative({ render: 'button' }, ['nativeButton'])).toBe(false);
    const { container } = render(() => <Toggle nativeButton={false} render="span" />);
    expect(container.querySelector('span[role="button"][aria-pressed]')).not.toBe(null);
  });
});

describe('native parity: ToggleGroup', () => {
  const { render } = createRenderer();

  function renderBoth(make: () => Props, wrap?: (ui: () => JSX.Element) => JSX.Element) {
    const fast = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    const slow = Object.defineProperties({}, Object.getOwnPropertyDescriptors(make())) as Props;
    (slow as { render?: string }).render = 'div';
    expect(canRenderNative(fast), 'fast props qualify').toBe(true);
    const ui = (props: Props) => () =>
      createComponent(ToggleGroup, props as ToggleGroup.Props) as unknown as JSX.Element;
    const fastResult = render(() => (wrap ? wrap(ui(fast)) : ui(fast)()) as never);
    const slowResult = render(() => (wrap ? wrap(ui(slow)) : ui(slow)()) as never);
    return { fast: fastResult.container, slow: slowResult.container };
  }

  it('renders the same group, alone and inside a Toolbar', () => {
    const children = () => (
      <>
        <Toggle value="a">A</Toggle>
        <Toggle value="b">B</Toggle>
      </>
    );
    const cases: Array<() => Props> = [
      () => ({ get children() { return children(); } }),
      () => ({ get children() { return children(); }, disabled: true, multiple: true, orientation: 'vertical' }),
      () => ({ get children() { return children(); }, class: 'g', style: { gap: '4px' }, 'aria-label': 'Group', id: 'g' }),
      () => ({ get children() { return children(); }, class: (state: ToggleGroup.State) => (state.multiple ? 'm' : 's'), onKeyDown: () => {} }),
    ];
    for (const make of cases) {
      const plain = renderBoth(make);
      expect(stripIds(plain.fast)).toBe(stripIds(plain.slow));
      const toolbar = renderBoth(make, (ui) => <Toolbar.Root>{ui()}</Toolbar.Root>);
      expect(stripIds(toolbar.fast)).toBe(stripIds(toolbar.slow));
    }
  });

  it('navigates and reports value changes identically (consumer keydown first)', () => {
    const run = (variant: 'fast' | 'slow') => {
      const calls: string[] = [];
      const ref = vi.fn();
      const { fast, slow } = renderBoth(() => ({
        ref,
        get children() {
          return (
            <>
              <Toggle value="a" data-testid="a">
                A
              </Toggle>
              <Toggle value="b" data-testid="b">
                B
              </Toggle>
            </>
          );
        },
        onValueChange: (value: string[]) => calls.push(`value:${value.join(',')}`),
        onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${event.key}`),
      }));
      const container = variant === 'fast' ? fast : slow;
      expect(ref.mock.calls.some((call) => call[0] === container.querySelector('[role="group"]'))).toBe(true);
      const a = container.querySelector('[data-testid="a"]') as HTMLElement;
      const b = container.querySelector('[data-testid="b"]') as HTMLElement;
      a.focus();
      calls.push(`arrow:${fireEvent.keyDown(a, { key: 'ArrowRight' })}:${document.activeElement === b}`);
      calls.push(`home:${fireEvent.keyDown(b, { key: 'Home' })}:${document.activeElement === a}`);
      calls.push(`click:${fireEvent.click(b)}:${b.getAttribute('aria-pressed')}`);
      flush();
      calls.push(`tabindex:${a.getAttribute('tabindex')}:${b.getAttribute('tabindex')}`);
      return calls;
    };
    const fast = run('fast');
    expect(fast).toContain('value:b');
    expect(fast).toEqual(run('slow'));
  });
});
