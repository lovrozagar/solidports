import { createEffect, createSignal, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceAccessor } from '../../utils/propsView';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { AvatarRootState, ImageLoadingStatus } from '../root/AvatarRoot';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { useImageLoadingStatus } from './useImageLoadingStatus';

const stateAttributesMapping: StateAttributesMapping<AvatarImageState> = {
  ...avatarStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * The image to be displayed in the avatar.
 * Renders an `<img>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarImage(componentProps: AvatarImage.Props): JSX.Element {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'onLoadingStatusChange',
    'keepMounted',
    // Split out so they can be applied after every other prop. Safari and Firefox start fetching
    // as soon as `src` lands, ignoring a `loading` or `srcset` that arrives after it.
    'sizes',
    'srcset',
    'src',
  ]);
  const keepMounted = () => local.keepMounted ?? false;
  const src = () => (typeof local.src === 'string' ? local.src : undefined);
  const srcSet = () => (typeof local.srcset === 'string' ? local.srcset : undefined);
  const sizes = () => (typeof local.sizes === 'string' ? local.sizes : undefined);

  const { registerImageLoadingStatus } = useAvatarRootContext();
  const [imageLoadingStatus, setImageLoadingStatus] = useImageLoadingStatus(
    src,
    {
      get referrerPolicy() {
        return elementProps.referrerpolicy;
      },
      get crossOrigin() {
        return elementProps.crossorigin;
      },
      sizes,
      srcSet,
    },
    () => !keepMounted(),
  );

  const isVisible = () => imageLoadingStatus() === 'loaded';
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(isVisible);

  // Solid: a signal, because the spread applies the ref after this component's effects are set up.
  const [imageElement, setImageElement] = createSignal<HTMLImageElement | null>(null, {
    ownedWrite: true,
  });
  let initialCommitRef = true;

  // Solid: a render function updates its element's source attributes in place, where React gets a
  // new `render` element, so watch them to re-run the status check below.
  const [renderedSourceVersion, setRenderedSourceVersion] = createSignal(0);
  createEffect(
    () => (keepMounted() ? imageElement() : null),
    (image) => {
      if (!image) {
        return undefined;
      }
      const observer = new MutationObserver(() => {
        setRenderedSourceVersion((version) => version + 1);
      });
      observer.observe(image, {
        attributes: true,
        attributeFilter: ['src', 'srcset', 'sizes', 'crossorigin', 'referrerpolicy'],
      });
      return () => observer.disconnect();
    },
  );

  // With `keepMounted`, the status comes from the rendered element itself, whose `load` event may
  // have already fired (cached images, or loads completed before hydration).
  createDepsEffect(
    () => ({
      keepMounted: keepMounted(),
      image: imageElement(),
      src: src(),
      srcSet: srcSet(),
      sizes: sizes(),
      crossOrigin: elementProps.crossorigin,
      referrerPolicy: elementProps.referrerpolicy,
      render: componentProps.render,
      renderedSourceVersion: renderedSourceVersion(),
    }),
    (deps) => {
      if (!deps.keepMounted) {
        return;
      }

      const image = deps.image;
      if (!image) {
        // The `render` element didn't forward the ref. Its own `load`/`error` events remain the
        // only source of truth, so don't overwrite the status they already reported.
        return;
      }

      const isInitialCommit = initialCommitRef;
      initialCommitRef = false;

      if (!image.complete) {
        setImageLoadingStatus('loading');
        return;
      }

      const status = image.naturalWidth > 0 ? 'loaded' : 'error';
      setImageLoadingStatus(status);

      // An image that's already complete on the first commit was painted before hydration, so
      // mount it without going through `'starting'` to avoid replaying the enter animation.
      if (status === 'loaded' && isInitialCommit) {
        setMounted(true);
      }
    },
  );

  // Solid: a getter view, so the keys exist only with `keepMounted` as React spreads them.
  const renderedStatusProps = (): JSX.ImgHTMLAttributes<HTMLImageElement> | undefined =>
    keepMounted()
      ? {
          // Presence no longer implies the image loaded, so the not-loaded states need their own
          // styling hooks. Scoped to `keepMounted` so the default mode, where the element only
          // exists once loaded, doesn't pick them up while it animates out.
          ...(imageLoadingStatus() === 'loading' ? { 'data-loading': '' } : undefined),
          ...(imageLoadingStatus() === 'error' ? { 'data-error': '' } : undefined),
          // Until the image is displayable, the fallback owns the accessible name; without this
          // both would be exposed to assistive technology at once (including in server HTML).
          ...(imageLoadingStatus() !== 'loaded' ? { 'aria-hidden': 'true' } : undefined),
          onLoad() {
            setImageLoadingStatus('loaded');
          },
          onError() {
            setImageLoadingStatus('error');
          },
        }
      : undefined;

  registerImageLoadingStatus(imageLoadingStatus);

  // The callback reads the latest props, as React's stable callback.
  createDepsEffect(imageLoadingStatus, (status) => {
    if (status !== 'idle') {
      local.onLoadingStatusChange?.(status);
    }
  });

  useOpenChangeComplete({
    enabled: () => !isVisible(),
    open: isVisible,
    ref: imageElement,
    onComplete() {
      if (!untrack(isVisible)) {
        setMounted(false);
      }
    },
  });

  const state: AvatarImageState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
    // The element never unmounts with `keepMounted`, so an exit transition would play and then
    // reverse itself once the status is cleared. `data-loading`/`data-error` cover that state.
    get transitionStatus() {
      const status = transitionStatus();
      return keepMounted() && status === 'ending' ? undefined : status;
    },
  };

  const shouldRender = () => keepMounted() || mounted();

  // Solid: getters that are omitted when unset, as React only adds the keys that are defined.
  const sourceProps = (): JSX.ImgHTMLAttributes<HTMLImageElement> => ({
    ...(local.sizes !== undefined ? { sizes: local.sizes } : undefined),
    ...(local.srcset !== undefined ? { srcset: local.srcset } : undefined),
    ...(local.src !== undefined ? { src: local.src } : undefined),
  });

  const element = useRenderElement('img', componentProps, {
    state,
    ref: setImageElement,
    // Accessor sources: their keys follow the loading status and source props without rebuilding
    // these props.
    props: [
      propsSourceAccessor(renderedStatusProps),
      elementProps,
      propsSourceAccessor(sourceProps),
    ],
    stateAttributesMapping,
    enabled: shouldRender,
  });

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps extends BaseUIComponentProps<
  'img',
  AvatarImageState,
  JSX.ImgHTMLAttributes<HTMLImageElement>
> {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
  /**
   * Whether the image element stays mounted and loads in place instead of being preloaded.
   * Supports `loading="lazy"` and optimized image components.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace AvatarImage {
  export type State = AvatarImageState;
  export type Props = AvatarImageProps;
}
