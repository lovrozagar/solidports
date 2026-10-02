import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressIndicator(componentProps: ProgressIndicator.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { percentageValue, state } = useProgressRootContext();

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get style(): JSX.CSSProperties {
          if (percentageValue() == null) {
            return {};
          }

          return {
            'inset-inline-start': 0,
            height: 'inherit',
            width: `${percentageValue()}%`,
          };
        },
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps extends BaseUIComponentProps<
  'div',
  ProgressIndicatorState
> {}

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props = ProgressIndicatorProps;
}
