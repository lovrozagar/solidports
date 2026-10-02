import type { JSX } from '@solidjs/web';
import type { MaybeAccessor } from '../solid-helpers';
import { getDisabledMountTransitionStyles } from './getDisabledMountTransitionStyles';
import { popupStateMapping } from './popupStateMapping';
import type { BaseUIHTMLProps, UseRenderElementRef } from './types';
import { useRenderElement } from './useRenderElement';
import type { TransitionStatus } from './useTransitionStatus';

interface UsePositionerOptions {
  styles: JSX.CSSProperties;
  transitionStatus: TransitionStatus;
  props?: BaseUIHTMLProps<HTMLDivElement> | BaseUIHTMLProps<HTMLDivElement>[] | undefined;
  refs?:
    | UseRenderElementRef<HTMLDivElement>
    | (UseRenderElementRef<HTMLDivElement> | undefined)[]
    | undefined;
  hidden?: boolean | undefined;
  inert?: boolean | undefined;
}

/**
 * Renders the shared outer Positioner element used by popup components.
 * Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
 *
 * `options` is read lazily (pass getters for reactive values).
 */
export function usePositioner<State extends Record<string, MaybeAccessor<any>>>(
  componentProps: useRenderElement.ComponentProps<State, HTMLDivElement>,
  state: State,
  options: UsePositionerOptions,
) {
  return useRenderElement('div', componentProps, {
    state,
    get ref() {
      return options.refs as never;
    },
    // Read inside the render memo, so the props rebuild when the styles or flags change.
    get props() {
      const style: JSX.CSSProperties = { ...options.styles };
      if (options.inert) {
        style['pointer-events'] = 'none';
      }
      return [
        { role: 'presentation', hidden: options.hidden, style },
        getDisabledMountTransitionStyles(options.transitionStatus),
        ...(Array.isArray(options.props) ? options.props : [options.props]),
      ];
    },
    stateAttributesMapping: popupStateMapping,
  });
}
