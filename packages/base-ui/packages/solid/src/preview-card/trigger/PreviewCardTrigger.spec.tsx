import { expectType } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import type { JSX } from '@solidjs/web';

// `PreviewCard.Trigger` exposes the native `<a>` props in its `render` callback.
<PreviewCard.Trigger
  render={(props) => {
    // Solid: native `href` is typed as `string | SerializableAttributeValue | RemoveAttribute`.
    expectType<JSX.AnchorHTMLAttributes<HTMLAnchorElement>['href'], typeof props.href>(props.href);
    return <a {...props} />;
  }}
/>;
