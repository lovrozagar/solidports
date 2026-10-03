import { createEffect, createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access, createDepsMemo, type MaybeAccessor } from '../../solid-helpers';
import type { ImageLoadingStatus } from '../root/AvatarRoot';

export type { ImageLoadingStatus };

interface UseImageLoadingStatusOptions {
  referrerPolicy?: MaybeAccessor<JSX.HTMLReferrerPolicy | false | undefined>;
  crossOrigin?: MaybeAccessor<
    JSX.ImgHTMLAttributes<HTMLImageElement>['crossorigin'] | false | undefined
  >;
  sizes?: MaybeAccessor<string | undefined>;
  srcSet?: MaybeAccessor<string | undefined>;
}

export function useImageLoadingStatus(
  src: MaybeAccessor<string | undefined>,
  options: UseImageLoadingStatusOptions,
  enabled: MaybeAccessor<boolean>,
): [Accessor<ImageLoadingStatus>, Setter<ImageLoadingStatus>] {
  const deps = createDepsMemo(() => ({
    enabled: access(enabled),
    src: access(src),
    srcSet: access(options.srcSet),
    sizes: access(options.sizes),
    crossOrigin: access(options.crossOrigin),
    referrerPolicy: access(options.referrerPolicy),
  }));

  // React sets the status from a layout effect when the source changes. Solid derives the
  // synchronous part (`'error'` without a source, `'loading'` otherwise) in the same flush; the
  // image's load and error events write the result.
  const [loadingStatus, setLoadingStatus] = createSignal<ImageLoadingStatus>((prev) => {
    const current = deps();
    if (!current.enabled) {
      return prev ?? 'idle';
    }
    return !current.src && !current.srcSet ? 'error' : 'loading';
  });

  createEffect(deps, (current) => {
    if (!current.enabled || (!current.src && !current.srcSet)) {
      return undefined;
    }

    let isMounted = true;
    const image = new window.Image();

    const updateStatus = (status: ImageLoadingStatus) => () => {
      if (!isMounted) {
        return;
      }

      setLoadingStatus(status);
    };

    image.onload = updateStatus('loaded');
    image.onerror = updateStatus('error');
    if (current.referrerPolicy) {
      image.referrerPolicy = current.referrerPolicy;
    }
    // Solid: JSX allows `true` (the empty, anonymous value) and `false` (no attribute).
    const crossOrigin = current.crossOrigin;
    image.crossOrigin =
      crossOrigin === true ? '' : crossOrigin === false || crossOrigin == null ? null : crossOrigin;
    if (current.sizes) {
      image.sizes = current.sizes;
    }
    if (current.srcSet) {
      image.srcset = current.srcSet;
    }
    if (current.src) {
      image.src = current.src;
    }

    // Fast path for cached/decoded images
    if (image.complete) {
      setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
    }

    return () => {
      isMounted = false;
    };
  });

  return [loadingStatus, setLoadingStatus];
}
