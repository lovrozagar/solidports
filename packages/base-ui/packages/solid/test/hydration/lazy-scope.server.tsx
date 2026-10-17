import { renderToString } from '@solidjs/web';
import { LazyScopeElement } from './lazy-scope.fixture';

export function render(): string {
  return renderToString(() => <LazyScopeElement />);
}
