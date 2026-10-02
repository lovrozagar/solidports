import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterLabel(componentProps: MeterLabel.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);

  const { setLabelId } = useMeterRootContext();

  const id = useRegisteredLabelId(() => (local.id === false ? undefined : local.id), setLabelId);

  const element = useRenderElement('span', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface MeterLabelState extends MeterRootState {}

export interface MeterLabelProps extends BaseUIComponentProps<'span', MeterLabelState> {}

export namespace MeterLabel {
  export type State = MeterLabelState;
  export type Props = MeterLabelProps;
}
