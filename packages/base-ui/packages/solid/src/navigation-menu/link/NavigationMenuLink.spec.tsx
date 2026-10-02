import type { JSX } from '@solidjs/web';
import { expectType } from '#test-utils';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';

// Solid: native attribute types come from the `@solidjs/web` JSX namespace.
// `NavigationMenu.Link` exposes the native `<a>` props in its `render` callback.
<NavigationMenu.Link
  render={(props) => {
    expectType<JSX.AnchorHTMLAttributes<HTMLAnchorElement>['href'], typeof props.href>(props.href);
    return <a {...props} />;
  }}
/>;
