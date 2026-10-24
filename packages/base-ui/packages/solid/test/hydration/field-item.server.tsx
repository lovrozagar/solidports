import { renderToString } from '@solidjs/web';
import { FieldItemFixture } from './field-item.fixture';

export function render(): string {
  return renderToString(() => <FieldItemFixture />);
}
