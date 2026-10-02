import { createEffect, createSignal, untrack } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import type { AvatarRootState } from '../root/AvatarRoot';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Rendered when the image fails to load or when no image is provided.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarFallback(componentProps: AvatarFallback.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['delay']);

  const { imageLoadingStatus } = useAvatarRootContext();
  const delay = () => local.delay ?? 0;
  const [delayPassed, setDelayPassed] = createSignal(untrack(() => delay() === 0));
  const timeout = useTimeout();

  createEffect(delay, (delayValue) => {
    if (delayValue > 0) {
      timeout.start(delayValue, () => setDelayPassed(true));
    } else {
      // Once the fallback is shown without a delay, keep it visible. Otherwise a later
      // change from no delay to a number would re-hide an already-visible fallback.
      setDelayPassed(true);
    }
    return timeout.clear;
  });

  const state: AvatarFallback.State = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const element = useRenderElement('span', componentProps, {
    get enabled() {
      return imageLoadingStatus() !== 'loaded' && (delay() === 0 || delayPassed());
    },
    props: elementProps,
    state,
    stateAttributesMapping: avatarStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps extends BaseUIComponentProps<'span', AvatarFallback.State> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
