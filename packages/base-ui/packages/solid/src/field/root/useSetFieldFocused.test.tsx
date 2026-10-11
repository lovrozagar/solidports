import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Field } from '@solidports/base-ui/field';
import { useRef } from '@solidports/base-ui/solid-helpers';
import { createRenderer } from '#test-utils';
import { useFieldRootContext } from './FieldRootContext';
import { useSetFieldFocused } from './useSetFieldFocused';

describe('useSetFieldFocused', () => {
  const { render } = createRenderer();

  it('records the focused control and ignores a clear from a different control', () => {
    const seen: boolean[] = [];

    function Control(props: { id: string }) {
      const ref = useRef<HTMLButtonElement | null>(null);
      const setFocused = useSetFieldFocused(false, ref, (focused) => seen.push(focused));
      return (
        <button
          type="button"
          ref={(node) => {
            ref.current = node;
          }}
          data-testid={props.id}
          onFocus={() => setFocused(true)}
        >
          {props.id}
        </button>
      );
    }

    function Clearer() {
      const ref = useRef<HTMLButtonElement | null>(null);
      const setFocused = useSetFieldFocused(false, ref);
      return (
        <button
          type="button"
          ref={(node) => {
            ref.current = node;
          }}
          data-testid="clear"
          onClick={() => setFocused(false)}
        >
          clear
        </button>
      );
    }

    function Readout() {
      const { focused } = useFieldRootContext();
      return <span data-testid="focused">{focused() ? 'yes' : 'no'}</span>;
    }

    render(() => (
      <Field.Root>
        <Control id="a" />
        <Clearer />
        <Readout />
      </Field.Root>
    ));

    fireEvent.focus(document.querySelector('[data-testid="a"]')!);
    expect(document.querySelector('[data-testid="focused"]')?.textContent).toBe('yes');
    fireEvent.click(document.querySelector('[data-testid="clear"]')!);
    expect(document.querySelector('[data-testid="focused"]')?.textContent).toBe('yes');
    expect(seen).toEqual([true]);
  });

  it('does not publish focus from a disabled control, and releases focus when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    let setFieldFocused: (focused: boolean) => void = () => {};

    function Control() {
      const ref = useRef<HTMLInputElement | null>(null);
      setFieldFocused = useSetFieldFocused(disabled, ref);
      return (
        <input
          data-testid="input"
          ref={(node) => {
            ref.current = node;
          }}
        />
      );
    }

    function Readout() {
      const { focused } = useFieldRootContext();
      return <span data-testid="focused">{focused() ? 'yes' : 'no'}</span>;
    }

    render(() => (
      <Field.Root>
        <Control />
        <Readout />
      </Field.Root>
    ));

    const input = document.querySelector('[data-testid="input"]') as HTMLInputElement;
    input.focus();
    setDisabled(true);
    flush();
    setDisabled(false);
    flush();
    input.focus();
    setDisabled(true);
    flush();
    expect(document.querySelector('[data-testid="focused"]')?.textContent).toBe('no');

    setFieldFocused(true);
    expect(document.querySelector('[data-testid="focused"]')?.textContent).toBe('no');
  });

  it('skips the active-element check when the control has no element', () => {
    function Control() {
      useSetFieldFocused(false, { current: null });
      return null;
    }

    expect(() =>
      render(() => (
        <Field.Root>
          <Control />
        </Field.Root>
      )),
    ).not.toThrow();
  });
});
