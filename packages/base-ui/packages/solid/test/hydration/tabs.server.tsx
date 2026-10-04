import { renderToString } from '@solidjs/web';
import { TabsFixture } from './tabs.fixture';

export function render(): string {
  return renderToString(() => <TabsFixture />);
}
