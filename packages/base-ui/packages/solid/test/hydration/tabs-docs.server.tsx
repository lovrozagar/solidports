import { renderToString } from '@solidjs/web';
import { DocsTabs } from './tabs.fixture';

export function render(): string {
  return renderToString(() => <DocsTabs />);
}
