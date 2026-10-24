import { renderToString } from '@solidjs/web';
import { AttributeOverridesFixture } from './attribute-overrides.fixture';

export function render(): string {
  return renderToString(() => <AttributeOverridesFixture />);
}
