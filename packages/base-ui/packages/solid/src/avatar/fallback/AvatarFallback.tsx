import { createTrackedEffect, createSignal, onCleanup } from 'solid-js';
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
  const [delayPassed, setDelayPassed] = createSignal(local.delay === undefined);
  const timeout = useTimeout();

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (local.delay !== undefined) {
      timeout.start(local.delay, () => setDelayPassed(true));
    }
    _c.push(() => {
      timeout.clear();
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const state: AvatarFallback.State = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const element = useRenderElement('span', componentProps, {
    get enabled() {
      return imageLoadingStatus() !== 'loaded' && delayPassed();
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
   */
  delay?: number | undefined;
}

export namespace AvatarFallback {
  export type State = AvatarFallbackState;
  export type Props = AvatarFallbackProps;
}
