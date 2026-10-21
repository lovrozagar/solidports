/*
 * What a toggle click re-runs in a ToggleGroup (regate4's toggle-group/300-multiple click 100):
 * every toggle reads "is my value in the group's value". Read as a lookup in the value array, a click
 * re-runs every toggle; read through the group's keyed membership, it re-runs only the toggles whose
 * membership changed, so the value's subscribers do not grow with the number of toggles. A
 * controlled value is a new array on every change and re-runs only the values that joined or left.
 */
import { createRenderEffect, createRoot, createSignal, DEV, flush, For, getOwner } from 'solid-js';
import { fireEvent, within } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { createRenderer } from '#test-utils';
import { useToggleGroupContext } from './ToggleGroupContext';
import type { ToggleGroupContext } from './ToggleGroupContext';

/** The computations other than a probe's that read what `read` reads. */
function subscribers(read: () => void) {
  let probe: unknown;
  const dispose = createRoot((disposeRoot) => {
    createRenderEffect(
      () => {
        probe = getOwner();
        read();
      },
      () => {},
    );
    return disposeRoot;
  });
  onTestFinished(dispose);
  return () =>
    (DEV!.getSources(probe as never) as unknown[]).reduce<number>(
      (count, source) =>
        count +
        (DEV!.getObservers(source as never) as unknown[]).filter((observer) => observer !== probe)
          .length,
      0,
    );
}

describe('ToggleGroup: a click re-runs only the toggles whose membership changed', () => {
  const { render } = createRenderer();

  function mount(count: number, controlled?: () => readonly string[]) {
    let group!: ToggleGroupContext<string>;
    function GroupProbe() {
      group = useToggleGroupContext()!;
      return null;
    }
    const values = Array.from({ length: count }, (_, i) => `toggle-${i}`);
    const view = render(() => (
      <ToggleGroup multiple {...(controlled ? { value: controlled() } : { defaultValue: [] })}>
        <GroupProbe />
        <For each={values}>{(value) => <Toggle value={value} aria-label={value} />}</For>
      </ToggleGroup>
    ));
    flush();
    const value = subscribers(() => group.value());
    const click = (index: number) => {
      fireEvent.click(within(view.container).getAllByRole('button')[index]);
      flush();
    };
    const pressed = () =>
      within(view.container)
        .getAllByRole('button', { pressed: true })
        .map((toggle) => toggle.getAttribute('aria-label'));
    return { value, click, pressed };
  }

  it('the group value has as many subscribers at 300 toggles as at 30', () => {
    const small = mount(30);
    small.click(20);
    small.click(3);
    expect(small.pressed()).toEqual(['toggle-3', 'toggle-20']);
    const few = small.value();
    const large = mount(300);
    large.click(200);
    large.click(3);
    expect(large.pressed()).toEqual(['toggle-3', 'toggle-200']);
    expect(large.value()).toBe(few);
  });

  it('a controlled value, a new array on each change, keeps the same subscribers', () => {
    const [smallValue, setSmallValue] = createSignal<readonly string[]>([]);
    const small = mount(30, smallValue);
    setSmallValue(['toggle-20']);
    flush();
    setSmallValue(['toggle-20', 'toggle-3']);
    flush();
    expect(small.pressed()).toEqual(['toggle-3', 'toggle-20']);
    const few = small.value();
    const [largeValue, setLargeValue] = createSignal<readonly string[]>([]);
    const large = mount(300, largeValue);
    setLargeValue(['toggle-200']);
    flush();
    setLargeValue(['toggle-200', 'toggle-3']);
    flush();
    expect(large.pressed()).toEqual(['toggle-3', 'toggle-200']);
    expect(large.value()).toBe(few);
  });
});
