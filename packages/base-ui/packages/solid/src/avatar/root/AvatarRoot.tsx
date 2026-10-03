import { createMemo, createSignal, onSettled, untrack, type Accessor } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { AvatarRootContext } from './AvatarRootContext';
import { avatarStateAttributesMapping } from './stateAttributesMapping';

/**
 * Displays a user's profile picture, initials, or fallback icon.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Avatar](https://base-ui.com/react/components/avatar)
 */
export function AvatarRoot(componentProps: AvatarRoot.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  // Solid: the image registers its status and the root derives it in the same flush (React copies
  // it from the image's effect). An `'idle'` image keeps the last reported status.
  const [imageStatusSource, setImageStatusSource] = createSignal<
    Accessor<ImageLoadingStatus> | undefined
  >(undefined, { ownedWrite: true });
  const imageLoadingStatus = createMemo<ImageLoadingStatus>((prev) => {
    const source = imageStatusSource();
    if (!source) {
      return 'idle';
    }
    const status = source();
    return status === 'idle' ? (prev ?? 'idle') : status;
  });

  // Registered once mounted, as Field's filled sources: the image can be created inside a
  // computation that reads the status.
  function registerImageLoadingStatus(source: Accessor<ImageLoadingStatus>) {
    onSettled(() => {
      setImageStatusSource(() => source);
      return () => {
        if (untrack(imageStatusSource) === source) {
          setImageStatusSource(undefined);
        }
      };
    });
  }

  const state: AvatarRoot.State = {
    get imageLoadingStatus() {
      return imageLoadingStatus();
    },
  };

  const contextValue: AvatarRootContext = {
    imageLoadingStatus,
    registerImageLoadingStatus,
  };

  const element = useRenderElement('span', componentProps, {
    props: elementProps,
    state,
    stateAttributesMapping: avatarStateAttributesMapping,
  });

  return <AvatarRootContext value={contextValue}>{element()}</AvatarRootContext>;
}

export type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AvatarRootState {
  imageLoadingStatus: ImageLoadingStatus;
}

export interface AvatarRootProps extends BaseUIComponentProps<'span', AvatarRoot.State> {}

export namespace AvatarRoot {
  export type State = AvatarRootState;
  export type Props = AvatarRootProps;
}
