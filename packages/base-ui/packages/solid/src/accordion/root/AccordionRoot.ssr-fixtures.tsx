import { Accordion } from '@solidports/base-ui/accordion';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export const PANEL_CONTENT_1 = 'Panel contents 1';

export default defineSsrFixtures(import.meta.url, {
  defaultOpen: () => (
    <Accordion.Root defaultValue={[0]}>
      <Accordion.Item value={0}>
        <Accordion.Header>
          <Accordion.Trigger>Trigger 1</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
});
