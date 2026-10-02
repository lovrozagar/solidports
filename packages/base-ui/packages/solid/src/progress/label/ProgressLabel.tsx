import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * An accessible label for the progress bar.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressLabel(componentProps: ProgressLabel.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);

  const { setLabelId, state } = useProgressRootContext();

  const id = useRegisteredLabelId(() => (local.id === false ? undefined : local.id), setLabelId);

  const element = useRenderElement('span', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ProgressLabelState extends ProgressRootState {}

export interface ProgressLabelProps extends BaseUIComponentProps<'span', ProgressLabelState> {}

export namespace ProgressLabel {
  export type State = ProgressLabelState;
  export type Props = ProgressLabelProps;
}
