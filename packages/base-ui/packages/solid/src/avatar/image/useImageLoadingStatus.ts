import { createTrackedEffect, createSignal, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access, type MaybeAccessor } from '../../solid-helpers';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface UseImageLoadingStatusOptions {
  src: MaybeAccessor<string | undefined>;
  referrerPolicy?: MaybeAccessor<JSX.HTMLReferrerPolicy | false | undefined>;
  crossOrigin?: MaybeAccessor<
    JSX.ImgHTMLAttributes<HTMLImageElement>['crossorigin'] | false | undefined
  >;
}

export function useImageLoadingStatus(
  options: UseImageLoadingStatusOptions,
): Accessor<ImageLoadingStatus> {
  const [loadingStatus, setLoadingStatus] = createSignal<ImageLoadingStatus>('idle');
  const src = () => access(options.src);
  const referrerPolicy = () => access(options.referrerPolicy);
  const crossOrigin = () => access(options.crossOrigin);

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const currentSrc = src();
    if (!currentSrc) {
      setLoadingStatus('error');
      return;
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
    image.addEventListener('load', updateStatus('loaded'));
    image.addEventListener('error', updateStatus('error'));
    const currentReferrerPolicy = referrerPolicy();
    if (typeof currentReferrerPolicy === 'string' && currentReferrerPolicy) {
      image.referrerPolicy = currentReferrerPolicy;
    }
    image.crossOrigin = (crossOrigin() as string | null | undefined) ?? null;
    image.src = currentSrc;

    /* Fast path for cached/decoded images */
    if (image.complete) {
      setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
    }

    _c.push(() => {
      isMounted = false;
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return loadingStatus;
}
