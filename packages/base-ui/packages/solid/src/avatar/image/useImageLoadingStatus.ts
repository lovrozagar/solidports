import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createDepsEffect, access, type MaybeAccessor } from '../../solid-helpers';
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
  const [loadingStatus, setLoadingStatus] = createSignal<ImageLoadingStatus>('idle');

  createDepsEffect(
    () => ({
      enabled: access(enabled),
      src: access(src),
      srcSet: access(options.srcSet),
      sizes: access(options.sizes),
      crossOrigin: access(options.crossOrigin),
      referrerPolicy: access(options.referrerPolicy),
    }),
    (deps) => {
      if (!deps.enabled) {
        return undefined;
      }

      if (!deps.src && !deps.srcSet) {
        setLoadingStatus('error');
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

      setLoadingStatus('loading');
      image.onload = updateStatus('loaded');
      image.onerror = updateStatus('error');
      if (deps.referrerPolicy) {
        image.referrerPolicy = deps.referrerPolicy;
      }
      // Solid: JSX allows `true` (the empty, anonymous value) and `false` (no attribute).
      const crossOrigin = deps.crossOrigin;
      image.crossOrigin =
        crossOrigin === true
          ? ''
          : crossOrigin === false || crossOrigin == null
            ? null
            : crossOrigin;
      if (deps.sizes) {
        image.sizes = deps.sizes;
      }
      if (deps.srcSet) {
        image.srcset = deps.srcSet;
      }
      if (deps.src) {
        image.src = deps.src;
      }

      // Fast path for cached/decoded images
      if (image.complete) {
        setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
      }

      return () => {
        isMounted = false;
      };
    },
  );

  return [loadingStatus, setLoadingStatus];
}
