import { Show } from 'solid-js';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { useRenderElement } from '../../utils/useRenderElement';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import type { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxIndicator(componentProps: CheckboxIndicator.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['keepMounted']);
  const keepMounted = () => local.keepMounted ?? false;

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked || rootState.indeterminate;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const indicatorRef = useRef<HTMLSpanElement | null | undefined>(null);

  const state: CheckboxIndicatorState = solidMergeProps(rootState, {
    get transitionStatus() {
      return transitionStatus();
    },
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

  const baseStateAttributesMapping = getCheckboxStateAttributesMapping(rootState);

  const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
    ...baseStateAttributesMapping,
    ...transitionStatusMapping,
  };

  const shouldRender = () => keepMounted() || mounted();

  const element = useRenderElement('span', componentProps, {
    ref: indicatorRef,
    state,
    stateAttributesMapping,
    props: elementProps,
  });

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps extends BaseUIComponentProps<
  'span',
  CheckboxIndicatorState
> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
