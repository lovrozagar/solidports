import { renderToString } from '@solidjs/web';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Combobox } from '@solidports/base-ui/combobox';
import { Field } from '@solidports/base-ui/field';
import { NumberField } from '@solidports/base-ui/number-field';
import { OTPField } from '@solidports/base-ui/otp-field';
import { Radio } from '@solidports/base-ui/radio';
import { Select } from '@solidports/base-ui/select';
import { Slider } from '@solidports/base-ui/slider';
import { Switch } from '@solidports/base-ui/switch';
import { Toolbar } from '@solidports/base-ui/toolbar';

/*
 * A value the server already knows must be in the HTML, as React's Base UI writes it during
 * render. An input filled only by a browser effect paints blank, then flashes the text in.
 */
export function render(): string {
  return renderToString(() => (
    <>
      <Field.Root>
        <Field.Control id="field-text" defaultValue="ada@acme.dev" />
      </Field.Root>
      <NumberField.Root defaultValue={3}>
        <NumberField.Input id="number-text" />
      </NumberField.Root>
      <Combobox.Root defaultInputValue="initech-query">
        <Combobox.Input id="combo-query" />
      </Combobox.Root>
      <Combobox.Root defaultValue="Initech" name="company">
        <Combobox.Input id="combo-selected" />
      </Combobox.Root>
      <Combobox.Root inputValue="controlled-text">
        <Combobox.Input id="combo-controlled" />
      </Combobox.Root>
      <Combobox.Root>
        <Combobox.Input id="combo-override" value="override-text" />
      </Combobox.Root>
      <Autocomplete.Root defaultValue="acme-co">
        <Autocomplete.Input id="autocomplete-text" />
      </Autocomplete.Root>
      <OTPField.Root defaultValue="42" length={2} name="otp">
        <OTPField.Input id="otp-0" />
        <OTPField.Input id="otp-1" />
      </OTPField.Root>
      <Slider.Root defaultValue={37}>
        <Slider.Control>
          <Slider.Thumb aria-label="Volume" />
        </Slider.Control>
      </Slider.Root>
      <Select.Root defaultValue="kiwi" name="fruit">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
      <Checkbox.Root id="agree" name="agree" value="yes" />
      <Switch.Root id="alerts" name="alerts" value="on" />
      <Radio.Root id="size-m" name="size" value="m" />
      <Toolbar.Root>
        <Toolbar.Input id="toolbar-text" defaultValue="toolbar-text" />
      </Toolbar.Root>
    </>
  ));
}
