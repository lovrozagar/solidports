import type { JSX } from '@solidjs/web';
import { expectType } from '#test-utils';
import { Toolbar } from '@solidports/base-ui/toolbar';

// Solid: native attribute types come from the `@solidjs/web` JSX namespace.
// `Toolbar.Link` exposes the native `<a>` props in its `render` callback.
<Toolbar.Link
  render={(props) => {
    expectType<JSX.AnchorHTMLAttributes<HTMLAnchorElement>['href'], typeof props.href>(props.href);
    return <a {...props} />;
  }}
/>;
