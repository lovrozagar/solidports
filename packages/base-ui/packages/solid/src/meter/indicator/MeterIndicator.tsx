import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterIndicator(componentProps: MeterIndicator.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { percentageValue } = useMeterRootContext();

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get style(): JSX.CSSProperties {
          return {
            'inset-inline-start': 0,
            height: 'inherit',
            width: `${percentageValue()}%`,
          };
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
