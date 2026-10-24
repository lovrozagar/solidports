import { renderToString } from '@solidjs/web';
import { FieldControlFixture } from './field-control.fixture';

export function render(): string {
  return renderToString(() => <FieldControlFixture />);
}
