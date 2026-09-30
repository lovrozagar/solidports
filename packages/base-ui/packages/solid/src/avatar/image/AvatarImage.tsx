import { batch, createEffect, Show } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { AvatarRootState } from '../root/AvatarRoot';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';
import { ImageLoadingStatus, useImageLoadingStatus } from './useImageLoadingStatus';

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
export function AvatarImage(componentProps: AvatarImage.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'onLoadingStatusChange',
    'referrerPolicy',
    'crossOrigin',
  ]);

  const context = useAvatarRootContext();
  const imageLoadingStatus = useImageLoadingStatus({
    get crossOrigin() {
      return local.crossOrigin;
    },
    get referrerPolicy() {
      return local.referrerPolicy;
    },
    get src() {
      return componentProps.src;
    },
  });

  const isVisible = () => imageLoadingStatus() === 'loaded';
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(isVisible);

  let imageRef = null as HTMLImageElement | null | undefined;

  const handleLoadingStatusChange = (status: ImageLoadingStatus) => {
    batch(() => {
      local.onLoadingStatusChange?.(status);
      context.setImageLoadingStatus(status);
    });
  };

  createEffect(() => {
    if (imageLoadingStatus() !== 'idle') {
      handleLoadingStatusChange(imageLoadingStatus());
    }
  });

  const state: AvatarImageState = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  useOpenChangeComplete({
    onComplete() {
      if (!isVisible()) {
        setMounted(false);
      }
    },
    open: isVisible,
    ref: () => imageRef,
  });

  const element = useRenderElement('img', componentProps, {
    enabled: mounted,
    props: elementProps,
    ref: (el) => {
      imageRef = el;
    },
    state,
    stateAttributesMapping,
  });

  return <Show when={mounted()}>{element()}</Show>;
}

export interface AvatarImageState extends AvatarRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AvatarImageProps extends BaseUIComponentProps<'img', AvatarImage.State> {
  /**
   * Callback fired when the loading status changes.
   */
  onLoadingStatusChange?: ((status: ImageLoadingStatus) => void) | undefined;
}

export namespace AvatarImage {
  export type State = AvatarImageState;
  export type Props = AvatarImageProps;
}
