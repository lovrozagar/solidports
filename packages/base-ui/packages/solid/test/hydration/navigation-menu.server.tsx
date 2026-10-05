import { renderToString } from '@solidjs/web';
import { NavigationMenuFixture } from './navigation-menu.fixture';

export function render(): string {
  return renderToString(() => <NavigationMenuFixture />);
}
