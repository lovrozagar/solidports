import { Fieldset } from '@solidports/base-ui/fieldset';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  noLegend: () => <Fieldset.Root data-testid="fieldset" />,
  withLegend: () => (
    <Fieldset.Root data-testid="fieldset">
      <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
    </Fieldset.Root>
  ),
});
