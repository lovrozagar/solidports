import { renderToString } from '@solidjs/web';
import { ComboboxRowFixture } from './combobox-row.fixture';

export function render(): string {
  return renderToString(() => <ComboboxRowFixture />);
}
