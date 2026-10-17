import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

// The indicator's transition machinery is created when its radio is first checked (4.8a): the
// checked one creates it while hydrating, in a lazy scope, so every later key still lines up.
export default defineSsrFixtures(import.meta.url, {
  indicators: () => (
    <RadioGroup defaultValue="a">
      <Radio.Root value="a">
        <Radio.Indicator />
      </Radio.Root>
      <Radio.Root value="b">
        <Radio.Indicator />
      </Radio.Root>
    </RadioGroup>
  ),
  'indicators-keepMounted': () => (
    <RadioGroup defaultValue="a">
      <Radio.Root value="a">
        <Radio.Indicator keepMounted />
      </Radio.Root>
      <Radio.Root value="b">
        <Radio.Indicator keepMounted />
      </Radio.Root>
    </RadioGroup>
  ),
});
