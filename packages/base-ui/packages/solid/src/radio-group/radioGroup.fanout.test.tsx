/*
 * What a radio click re-runs (plan 3 push gate, kpmac2's radio/300 click 100): every radio reads
 * "am I the checked one". Read as a direct compare against the group's value, a click re-runs every
 * radio. Read through the group's keyed selector (`createIdSelector`), it re-runs the old and the
 * new radio only, so the value's subscribers do not grow with the number of radios.
 */
import { createRenderEffect, createRoot, DEV, flush, For, getOwner } from 'solid-js';
import { fireEvent, within } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { createRenderer } from '#test-utils';
import { useRadioGroupContext } from './RadioGroupContext';
import type { RadioGroupContext } from './RadioGroupContext';

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

describe('RadioGroup: a click re-runs the old and the new radio only', () => {
  const { render } = createRenderer();

  function mount(count: number) {
    let group!: RadioGroupContext<string>;
    function GroupProbe() {
      group = useRadioGroupContext()!;
      return null;
    }
    const values = Array.from({ length: count }, (_, i) => `radio-${i}`);
    const view = render(() => (
      <RadioGroup defaultValue="radio-0">
        <GroupProbe />
        <For each={values}>{(value) => <Radio.Root value={value} aria-label={value} />}</For>
      </RadioGroup>
    ));
    flush();
    const checked = subscribers(() => group.checkedValue());
    const click = (index: number) => {
      fireEvent.click(within(view.container).getAllByRole('radio')[index]);
      flush();
    };
    const checkedRadios = () =>
      within(view.container)
        .getAllByRole('radio', { checked: true })
        .map((radio) => radio.getAttribute('aria-label'));
    return { checked, click, checkedRadios };
  }

  it('the checked value has as many subscribers at 300 radios as at 30', () => {
    const small = mount(30);
    small.click(20);
    expect(small.checkedRadios()).toEqual(['radio-20']);
    const few = small.checked();
    const large = mount(300);
    large.click(200);
    expect(large.checkedRadios()).toEqual(['radio-200']);
    expect(large.checked()).toBe(few);
  });
});
