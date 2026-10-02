import { expectType } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import type { JSX } from '@solidjs/web';

// `Menu.LinkItem` exposes the native `<a>` props in its `render` callback.
<Menu.LinkItem
  render={(props) => {
    // Solid: native `href` is typed as `string | SerializableAttributeValue | RemoveAttribute`.
    expectType<JSX.AnchorHTMLAttributes<HTMLAnchorElement>['href'], typeof props.href>(props.href);
    return <a {...props} />;
  }}
/>;
