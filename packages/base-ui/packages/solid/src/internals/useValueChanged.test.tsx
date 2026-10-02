import { expect, vi, describe } from 'vitest';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { act } from '#test-utils';
import { useValueChanged } from './useValueChanged';

describe('useValueChanged', () => {
  // Solid: there is no StrictMode, so both variants run the same way.
  it.each([false, true])(
    'retains -0 as the previous value without treating it as a change from 0 (strict: %s)',
    () => {
      const onChange = vi.fn();
      // Solid: React re-renders on every `rerender` and compares deps with `Object.is`.
      const [value, setValue] = createSignal(0, { equals: Object.is });

      function Test(props: { value: number }) {
        useValueChanged(() => props.value, onChange);
        return null;
      }

      render(() => <Test value={value()} />);

      act(() => setValue(-0));
      expect(onChange).not.toHaveBeenCalled();

      act(() => setValue(1));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(Object.is(onChange.mock.calls[0][0], -0)).toBe(true);
    },
  );
});
