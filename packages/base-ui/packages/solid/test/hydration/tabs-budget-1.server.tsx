import { renderToString } from '@solidjs/web';
import { TabsBudget } from './tabs.fixture';

export function render(): string {
  return renderToString(() => <TabsBudget count={1} />);
}
