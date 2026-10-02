import { Show } from 'solid-js';
import { splitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { RadioRootState } from '../root/RadioRoot';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioIndicator(componentProps: RadioIndicator.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['keepMounted']);
  const keepMounted = () => local.keepMounted ?? false;

  const rootState = useRadioRootContext();

  const rendered = () => rootState.checked;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const state: RadioIndicatorState = solidMergeProps(rootState, {
    get transitionStatus() {
      return transitionStatus();
    },
  });

  const indicatorRef = useRef<HTMLSpanElement | null | undefined>(null);

  const shouldRender = () => keepMounted() || mounted();

  const element = useRenderElement('span', componentProps, {
    ref: indicatorRef,
    state,
    props: elementProps,
    stateAttributesMapping,
  });

  useOpenChangeComplete({
    batch: true,
    enabled: () => !rendered(),
    open: rendered,
    ref: () => indicatorRef.current,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface RadioIndicatorProps extends BaseUIComponentProps<'span', RadioIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace RadioIndicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
