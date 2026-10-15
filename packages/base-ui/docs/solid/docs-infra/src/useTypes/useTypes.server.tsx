import { renderToString } from '@solidjs/web';
import { TypesFixture } from './useTypes.fixture';

export function render(): string {
  return renderToString(() => <TypesFixture />);
}
