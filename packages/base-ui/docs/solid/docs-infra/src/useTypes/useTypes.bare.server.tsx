import { renderToString } from '@solidjs/web';
import { BareTypesFixture } from './useTypes.fixture';

export function render(): string {
  return renderToString(() => <BareTypesFixture />);
}
