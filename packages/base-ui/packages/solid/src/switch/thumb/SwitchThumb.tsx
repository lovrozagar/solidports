import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SwitchRootState } from '../root/SwitchRoot';
import { useSwitchRootContext } from '../root/SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';

/**
 * The movable part of the switch that indicates whether the switch is on or off.
 * Renders a `<span>`.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchThumb(componentProps: SwitchThumb.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const state = useSwitchRootContext();

  const element = useRenderElement('span', componentProps, {
    state,
    stateAttributesMapping,
    props: elementProps,
  });

  return <>{element()}</>;
}

export interface SwitchThumbProps extends BaseUIComponentProps<'span', SwitchThumbState> {}

export interface SwitchThumbState extends SwitchRootState {}

export namespace SwitchThumb {
  export type Props = SwitchThumbProps;
  export type State = SwitchThumbState;
}
