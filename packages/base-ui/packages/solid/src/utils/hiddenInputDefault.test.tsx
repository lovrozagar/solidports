/*
 * A checked part's hidden input carries the checked state as its default (`defaultChecked`, the
 * `checked` attribute), as React's client render does (`initInput` sets `defaultChecked` to the
 * initial value): a form reset restores the part's initial state, and a hydrated input matches a
 * client-rendered one. The Solid port set only the `checked` property, so a reset unchecked them.
 */
import { createRenderer } from '#test-utils';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Switch } from '@solidports/base-ui/switch';

describe('hidden inputs of checked parts', () => {
  const { render } = createRenderer();

  // React's triple for the same parts: attribute / property / defaultChecked, at mount and after a
  // form reset (measured with @base-ui/react in this repo).
  const REACT = 'checkbox:true/true/true checkbox:true/true/true radio:true/true/true radio:false/false/false';

  it('match React at mount and after a form reset', () => {
    render(() => (
      <form>
        <Checkbox.Root defaultChecked name="c" />
        <Switch.Root defaultChecked name="s" />
        <RadioGroup defaultValue="a" name="r">
          <Radio.Root value="a" />
          <Radio.Root value="b" />
        </RadioGroup>
      </form>
    ));
    const inputs = [
      ...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ];
    const triple = () =>
      inputs.map((i) => `${i.type}:${i.hasAttribute('checked')}/${i.checked}/${i.defaultChecked}`).join(' ');
    expect(triple()).toBe(REACT);
    document.querySelector('form')!.reset();
    expect(triple()).toBe(REACT);
  });
});
