import { Combobox } from '@solidports/base-ui/combobox';

/** An inline grid list (no popup), so the server renders its rows and the client hydrates them. */
export function ComboboxRowFixture() {
  return (
    <Combobox.Root inline grid defaultValue="b">
      <Combobox.Input data-testid="input" />
      <Combobox.List>
        <Combobox.Row data-testid="row-0">
          <Combobox.Item value="a">a</Combobox.Item>
          <Combobox.Item value="b">b</Combobox.Item>
        </Combobox.Row>
        <Combobox.Row data-testid="row-1" class="second">
          <Combobox.Item value="c">c</Combobox.Item>
        </Combobox.Row>
      </Combobox.List>
    </Combobox.Root>
  );
}
