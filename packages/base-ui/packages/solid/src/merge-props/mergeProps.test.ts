import { expect, vi } from 'vitest';
import { createMemo, createRoot, createSignal } from 'solid-js';
import { act } from '#test-utils';
import { callEventHandler } from '../solid-helpers';
import type { BaseUIEvent } from '../utils/types';
import { mergeProps, mergePropsN } from './mergeProps';

// Solid: titles keep React's wording (`className`, "synthetic" events); Solid uses `class`
// and native events.
describe('mergeProps', () => {
  it('merges event handlers', () => {
    const theirProps = {
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
    };
    const ourProps = {
      onClick: vi.fn(),
      onPaste: vi.fn(),
    };
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
    callEventHandler(mergedProps.onKeyDown as any, new KeyboardEvent('keydown') as any);
    callEventHandler(mergedProps.onPaste as any, new Event('paste') as any);

    expect(theirProps.onClick.mock.invocationCallOrder[0]).toBeLessThan(
      ourProps.onClick.mock.invocationCallOrder[0],
    );
    expect(theirProps.onClick.mock.calls.length).toBe(1);
    expect(ourProps.onClick.mock.calls.length).toBe(1);
    expect(theirProps.onKeyDown.mock.calls.length).toBe(1);
    expect(ourProps.onPaste.mock.calls.length).toBe(1);
  });

  it('merges multiple event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
    expect(log).toEqual(['1', '2', '3']);
  });

  it('merges undefined event handlers', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {
          log.push('3');
        },
      },
      {
        onClick: undefined,
      },
      {
        onClick() {
          log.push('1');
        },
      },
    );

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
    expect(log).toEqual(['1', '3']);
  });

  it('makes a lone synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {},
      {
        onClick(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
    );

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);

    expect(prevented).toBe(true);
  });

  it('makes a first-position synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {
        onMouseDown(event) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    );

    callEventHandler(mergedProps.onMouseDown, new MouseEvent('mousedown') as any);

    expect(prevented).toBe(true);
  });

  it('makes a first-position synthetic event handler preventable in mergePropsN', () => {
    let prevented = false;

    const mergedProps = mergePropsN<'button'>([
      {
        onMouseDown(event) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
      {
        id: 'test-button',
      },
    ]);

    callEventHandler(mergedProps.onMouseDown, new MouseEvent('mousedown') as any);

    expect(prevented).toBe(true);
  });

  it('makes a lone obscure synthetic event handler preventable', () => {
    let prevented = false;

    const mergedProps = mergeProps<'button'>(
      {},
      {
        onContextMenu(event) {
          event.preventBaseUIHandler();
          prevented = event.baseUIHandlerPrevented === true;
        },
      },
    );

    callEventHandler(mergedProps.onContextMenu, new MouseEvent('contextmenu') as any);

    expect(prevented).toBe(true);
  });

  it('forwards all arguments for a lone non-standard event handler', () => {
    const handler = vi.fn();

    const mergedProps = mergeProps<any>(
      {},
      {
        onOpenChange: handler,
      },
    );

    const eventDetails = { reason: 'test' };
    mergedProps.onOpenChange?.(true, eventDetails);

    expect(handler).toHaveBeenCalledWith(true, eventDetails);
  });

  it('forwards additional arguments for synthetic event handlers', () => {
    const log: Array<[string, string]> = [];

    const mergedProps = mergeProps<any>(
      {
        onMouseDown(_event: BaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['ours', details.reason]);
        },
      },
      {
        onMouseDown(_event: BaseUIEvent<MouseEvent>, details: { reason: string }) {
          log.push(['theirs', details.reason]);
        },
      },
    );

    mergedProps.onMouseDown?.(new MouseEvent('mousedown'), {
      reason: 'pointer',
    });

    expect(log).toEqual([
      ['theirs', 'pointer'],
      ['ours', 'pointer'],
    ]);
  });

  it('merges styles', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {
      style: { backgroundColor: 'blue', color: 'blue' },
    };
    const mergedProps = mergeProps<'div'>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      backgroundColor: 'blue',
      color: 'red',
    });
  });

  it('merges styles with undefined', () => {
    const theirProps = {
      style: { color: 'red' },
    };
    const ourProps = {};

    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.style).toEqual({
      color: 'red',
    });
  });

  it('does not merge styles if both are undefined', () => {
    const theirProps = {};
    const ourProps = {};
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.style).toBe(undefined);
  });

  it('merges classNames with rightmost first', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {
      class: 'internal-class',
    };
    const mergedProps = mergeProps<'div'>(ourProps, theirProps);

    expect(mergedProps.class).toBe('external-class internal-class');
  });

  it('merges multiple classNames', () => {
    const mergedProps = mergeProps<'div'>(
      {
        class: 'class-1',
      },
      {
        class: 'class-2',
      },
      {
        class: 'class-3',
      },
    );

    expect(mergedProps.class).toBe('class-3 class-2 class-1');
  });

  it('merges classNames with undefined', () => {
    const theirProps = {
      class: 'external-class',
    };
    const ourProps = {};

    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.class).toBe('external-class');
  });

  it('does not merge classNames if both are undefined', () => {
    const theirProps = {};
    const ourProps = {};
    const mergedProps = mergeProps<'button'>(ourProps, theirProps);

    expect(mergedProps.class).toBe(undefined);
  });

  it('does not prevent internal handler if event.preventBaseUIHandler() is not called', () => {
    let ran = false;

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {},
      },
      {
        onClick() {
          ran = true;
        },
      },
    );

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);

    expect(ran).toBe(true);
  });

  it('prevents internal handler if event.preventBaseUIHandler() is called', () => {
    let ran = false;

    const mergedProps = mergeProps<'button'>(
      {
        onClick: function onClick3() {
          ran = true;
        },
      },
      {
        onClick: function onClick2() {
          ran = true;
        },
      },
      {
        onClick: function onClick1(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
        },
      },
    );

    const event = new MouseEvent('click') as any;
    callEventHandler(mergedProps.onClick as any, event);

    expect(ran).toBe(false);
  });

  it('prevents handlers merged after event.preventBaseUIHandler() is called', () => {
    const log: string[] = [];

    const mergedProps = mergeProps<any>(
      {
        onClick() {
          log.push('2');
        },
      },
      {
        onClick(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          log.push('1');
        },
      },
      {
        onClick() {
          log.push('0');
        },
      },
    );

    callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);

    expect(log).toEqual(['0', '1']);
  });

  it('forwards all arguments for merged non-standard event handlers', () => {
    const log: Array<[string, boolean, { reason: string }]> = [];
    const eventDetails = { reason: 'test' };

    const mergedProps = mergeProps<any>(
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['ours', open, details]);
        },
      },
      {
        onOpenChange(open: boolean, details: { reason: string }) {
          log.push(['theirs', open, details]);
        },
      },
    );

    mergedProps.onOpenChange?.(true, eventDetails);

    expect(log).toEqual([
      ['theirs', true, eventDetails],
      ['ours', true, eventDetails],
    ]);
  });

  [true, 13, 'newValue', { key: 'value' }, ['value'], () => 'value'].forEach((eventArgument) => {
    it('handles non-standard event handlers without error', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<any>(
        {
          onValueChange() {
            log.push('1');
          },
        },
        {
          onValueChange() {
            log.push('0');
          },
        },
      );

      mergedProps.onValueChange(eventArgument);

      expect(log).toEqual(['0', '1']);
    });
  });

  it('lets an explicit undefined in a later source override an earlier value', () => {
    const mergedProps = mergeProps<'button'>({ title: 'ours' }, { title: undefined });

    expect(mergedProps.title).toBe(undefined);
  });

  // Solid: reading JSX `children` creates them, so a second read creates a second copy (and on the
  // server takes another hydration key, which the client then misses).
  it('reads the winning source once per merged read', () => {
    let reads = 0;
    const theirProps = {
      get children() {
        reads += 1;
        return 'label';
      },
    };
    const mergedProps = mergeProps<'button'>({ type: 'button' }, theirProps);

    expect(mergedProps.children).toBe('label');
    expect(reads).toBe(1);
  });

  it('reads a props getter result once per merged read', () => {
    let reads = 0;
    const theirProps = {
      get children() {
        reads += 1;
        return 'label';
      },
    };
    const mergedProps = mergeProps<'button'>(theirProps, (props) => ({
      type: 'button' as const,
      get children() {
        return props.children;
      },
    }));

    expect(mergedProps.children).toBe('label');
    expect(reads).toBe(1);
  });

  it('merges internal props so that the ones defined first override the ones defined later', () => {
    const mergedProps = mergeProps<'button'>(
      {
        title: 'internal title 2',
      },
      {
        title: 'internal title 1',
      },
      {},
    );

    expect(mergedProps.title).toBe('internal title 1');
  });

  it('sets baseUIHandlerPrevented to true after calling preventBaseUIHandler()', () => {
    let observedFlag: boolean | undefined;

    const mergedProps = mergeProps<'button'>(
      {
        onClick() {},
      },
      {
        onClick(event: BaseUIEvent<MouseEvent>) {
          event.preventBaseUIHandler();
          observedFlag = event.baseUIHandlerPrevented;
        },
      },
    );

    callEventHandler(mergedProps.onClick, new MouseEvent('click') as any);

    expect(observedFlag).toBe(true);
  });

  describe('callAllHandlers option', () => {
    it('executes all event handlers when callAllHandlers is true', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('1');
          },
        },
        {
          onClick() {
            log.push('2');
          },
        },
        {
          onClick() {
            log.push('3');
          },
        },
        { callAllHandlers: true },
      );

      callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
      expect(log).toEqual(['1', '2', '3']);
    });

    it('returns the first non-undefined result from handlers', () => {
      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            return undefined;
          },
        },
        {
          onClick() {
            return 'second';
          },
        },
        {
          onClick() {
            return 'third';
          },
        },
        { callAllHandlers: true },
      );

      const result = (mergedProps.onClick as any)(new MouseEvent('click'));
      expect(result).toBe('second');
    });

    it('does not use preventable chaining when callAllHandlers is true', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('1');
          },
        },
        {
          onClick() {
            log.push('2');
          },
        },
        {
          onClick() {
            log.push('3');
          },
        },
        { callAllHandlers: true },
      );

      callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
      expect(log).toEqual(['1', '2', '3']);
    });

    it('works with array syntax', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        [
          {
            onClick() {
              log.push('1');
            },
          },
          {
            onClick() {
              log.push('2');
            },
          },
        ],
        { callAllHandlers: true },
      );

      callEventHandler(mergedProps.onClick as any, new MouseEvent('click') as any);
      expect(log).toEqual(['1', '2']);
    });

    it('still merges non-event props normally', () => {
      const mergedProps = mergeProps<'button'>(
        { title: 'first' },
        { role: 'button', title: 'second' },
        { callAllHandlers: true },
      );

      expect(mergedProps.title).toBe('second');
      expect(mergedProps.role).toBe('button');
    });
  });

  describe('props getters', () => {
    it('calls the props getter with the props defined after it', () => {
      let observedProps: any;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          className: 'test-class',
          id: '2',
        },
        propsGetter,
        {
          id: '1',
          role: 'button',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({ className: 'test-class', id: '2' });
    });

    it('calls the props getter with merged props defined after it', () => {
      let observedProps: any;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(
        {
          className: 'test-class',
          role: 'button',
        },
        {
          role: 'tab',
        },
        propsGetter,
        {
          id: 'one',
        },
      );

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({
        className: 'test-class',
        role: 'tab',
      });
    });

    it('calls the props getter with an empty object if no props are defined after it', () => {
      let observedProps: any;
      const propsGetter = vi.fn((props) => {
        observedProps = { ...props };
        return props;
      });

      mergeProps(propsGetter, { id: '1' });

      expect(propsGetter.mock.calls.length === 1).toBe(true);
      expect(observedProps).toEqual({});
    });

    it('does not mutate a reused object returned by the first props getter', () => {
      const shared = { class: 'base' };

      const result = mergeProps(() => shared, {
        class: 'next',
      });

      expect(result).toEqual({
        class: 'next base',
      });
      expect(shared).toEqual({
        class: 'base',
      });
    });

    it('accepts the result of the props getter', () => {
      const propsGetter = () => ({ class: 'test-class' });
      const result = mergeProps(
        {
          id: 'two',
          role: 'tab',
        },
        {
          id: 'one',
        },
        propsGetter,
      );

      expect(result).toEqual({
        class: 'test-class',
      });
    });

    it('properly merges native object getters in a reactive way (class/style/ref/classList + other dynamic props)', () => {
      // Solid: writes inside an owned scope (the root included) are rejected, so the root only
      // builds the memos and the updates run after it, inside `act`.
      const [isOn, setIsOn] = createSignal(false);
      const [color, setColor] = createSignal<'blue' | 'red'>('blue');
      const [isEnabled, setIsEnabled] = createSignal(false);
      const [count, setCount] = createSignal(0);
      const [mode, setMode] = createSignal<'a' | 'b'>('a');

      let classGetterCalls = 0;
      let styleGetterCalls = 0;
      let classListGetterCalls = 0;
      let titleGetterCalls = 0;
      let tabIndexGetterCalls = 0;

      const refA = vi.fn();
      const refB = vi.fn();

      const {
        dispose,
        mergedProps,
        classValue,
        styleValue,
        classListValue,
        titleValue,
        tabIndexValue,
        staticValue,
      } = createRoot((dispose) => {
        // Solid: `classList` is not part of the typed props, so the getters are declared apart
        // from the call (no excess-property check).
        const dynamicProps = {
          get class() {
            classGetterCalls += 1;
            return isOn() ? 'on' : 'off';
          },
          get classList() {
            classListGetterCalls += 1;
            return { enabled: isEnabled() };
          },
          get style() {
            styleGetterCalls += 1;
            return { color: color() };
          },
          get tabindex() {
            tabIndexGetterCalls += 1;
            return mode() === 'a' ? 0 : -1;
          },
          get title() {
            titleGetterCalls += 1;
            return `title-${count()}`;
          },
        };

        const staticProps = {
          class: 'static-class',
          classList: { staticKey: true },
          id: 'static-id',
          ref: refA,
          style: { padding: '1px' },
        };

        const mergedProps = mergeProps<'div'>(dynamicProps, staticProps, { ref: refB });

        expect(classGetterCalls).toBe(0);
        expect(styleGetterCalls).toBe(0);
        expect(classListGetterCalls).toBe(0);
        expect(titleGetterCalls).toBe(0);
        expect(tabIndexGetterCalls).toBe(0);

        const classValue = createMemo(() => mergedProps.class);
        const styleValue = createMemo(() => mergedProps.style);
        const classListValue = createMemo(
          () => (mergedProps as { classList?: Record<string, boolean | undefined> }).classList,
        );
        const titleValue = createMemo(() => mergedProps.title);
        const tabIndexValue = createMemo(() => mergedProps.tabindex);
        const staticValue = createMemo(() => mergedProps.id);

        expect(classValue()).toBe('static-class off');
        expect(styleValue()).toEqual({ color: 'blue', padding: '1px' });
        expect(classListValue()).toEqual({ enabled: false, staticKey: true });
        expect(titleValue()).toBe('title-0');
        expect(tabIndexValue()).toBe(0);
        expect(staticValue()).toBe('static-id');

        expect(classGetterCalls).toBe(1);
        expect(styleGetterCalls).toBe(1);
        expect(classListGetterCalls).toBe(1);

        return {
          dispose,
          mergedProps,
          classValue,
          styleValue,
          classListValue,
          titleValue,
          tabIndexValue,
          staticValue,
        };
      });

      const titleCallsBefore = titleGetterCalls;
      const tabIndexCallsBefore = tabIndexGetterCalls;

      const element = document.createElement('div');
      (mergedProps.ref as any)?.(element);
      expect(refB.mock.invocationCallOrder[0]).toBeLessThan(refA.mock.invocationCallOrder[0]);
      expect(refA).toHaveBeenCalledWith(element);
      expect(refB).toHaveBeenCalledWith(element);

      act(() => {
        setIsOn(true);
        setColor('red');
        setIsEnabled(true);
        setCount(1);
        setMode('b');
      });

      expect(classValue()).toBe('static-class on');
      expect(styleValue()).toEqual({ color: 'red', padding: '1px' });
      expect(classListValue()).toEqual({ enabled: true, staticKey: true });
      expect(titleValue()).toBe('title-1');
      expect(tabIndexValue()).toBe(-1);
      expect(staticValue()).toBe('static-id');

      expect(classGetterCalls).toBe(2);
      expect(styleGetterCalls).toBe(2);
      expect(classListGetterCalls).toBe(2);
      expect(titleGetterCalls).toBeGreaterThan(titleCallsBefore);
      expect(tabIndexGetterCalls).toBeGreaterThan(tabIndexCallsBefore);

      dispose();
    });

    it('does not automatically prevent handlers that are manually called by getter handlers', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props) => ({
          onClick(event: BaseUIEvent<MouseEvent>) {
            event.preventBaseUIHandler();
            log.push('getter-handler');
            callEventHandler(props.onClick, new MouseEvent('click') as any);
          },
        }),
        {
          onClick() {
            log.push('last-handler');
          },
        },
      );

      callEventHandler(mergedProps.onClick, new MouseEvent('click') as any);

      expect(log).toEqual(['last-handler', 'getter-handler', 'first-handler']);
    });

    it('allows props getter handlers to check baseUIHandlerPrevented manually', () => {
      const log: string[] = [];

      const mergedProps = mergeProps<'button'>(
        {
          onClick() {
            log.push('first-handler');
          },
        },
        (props) => ({
          onClick(event: BaseUIEvent<MouseEvent>) {
            event.preventBaseUIHandler();
            log.push('getter-handler');
            if (!event.baseUIHandlerPrevented) {
              callEventHandler(props.onClick, new MouseEvent('click') as any);
            }
          },
        }),
        {
          onClick() {
            log.push('last-handler');
          },
        },
      );

      callEventHandler(mergedProps.onClick, new MouseEvent('click') as any);

      expect(log).toEqual(['last-handler', 'getter-handler']);
    });
  });
});
