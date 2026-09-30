import { createEffect, createSignal, onCleanup, type Accessor, type JSX } from 'solid-js';
import { access, type MaybeAccessor } from '../../solid-helpers';

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface UseImageLoadingStatusOptions {
  src: MaybeAccessor<string | undefined>;
  referrerPolicy?: MaybeAccessor<JSX.HTMLReferrerPolicy | undefined>;
  crossOrigin?: MaybeAccessor<JSX.ImgHTMLAttributes<HTMLImageElement>['crossOrigin'] | undefined>;
}

export function useImageLoadingStatus(
  options: UseImageLoadingStatusOptions,
): Accessor<ImageLoadingStatus> {
  const [loadingStatus, setLoadingStatus] = createSignal<ImageLoadingStatus>('idle');
  const src = () => access(options.src);
  const referrerPolicy = () => access(options.referrerPolicy);
  const crossOrigin = () => access(options.crossOrigin);

  createEffect(() => {
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
    if (currentReferrerPolicy) {
      image.referrerPolicy = currentReferrerPolicy;
    }
    image.crossOrigin = crossOrigin() ?? null;
    image.src = currentSrc;

    /* Fast path for cached/decoded images */
    if (image.complete) {
      setLoadingStatus(image.naturalWidth > 0 ? 'loaded' : 'error');
    }

    onCleanup(() => {
      isMounted = false;
    });
  });

  return loadingStatus;
}
