import type { JSX } from '@solidjs/web';
import { expectType } from '#test-utils';
import { Avatar, type ImageLoadingStatus } from '@solidports/base-ui/avatar';

// Solid: native attribute names and types come from the `@solidjs/web` JSX namespace.
// `Avatar.Image` accepts and forwards the native responsive/loading `<img>` props.
<Avatar.Root
  render={(props, state) => {
    expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
    return <span {...props} />;
  }}
>
  <Avatar.Image
    crossorigin="anonymous"
    keepMounted
    referrerpolicy="no-referrer"
    sizes="48px"
    srcset="avatar.png 1x, avatar@2x.png 2x"
    onLoadingStatusChange={(status) => {
      expectType<ImageLoadingStatus, typeof status>(status);
    }}
    render={(props, state) => {
      expectType<JSX.ImgHTMLAttributes<HTMLImageElement>['src'], typeof props.src>(props.src);
      expectType<JSX.ImgHTMLAttributes<HTMLImageElement>['alt'], typeof props.alt>(props.alt);
      expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
      return <img alt="" {...props} />;
    }}
  />
  <Avatar.Fallback
    delay={100}
    render={(props, state) => {
      expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
      return <span {...props} />;
    }}
  />
</Avatar.Root>;
