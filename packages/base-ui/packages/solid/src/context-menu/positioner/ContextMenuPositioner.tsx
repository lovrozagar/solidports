import type { JSX } from 'solid-js';
import {
  MenuPositioner,
  type MenuPositionerProps,
  type MenuPositionerState,
} from '../../menu/positioner/MenuPositioner';

export interface ContextMenuPositionerState extends MenuPositionerState {}

/**
 * Positions the context menu popup against the pointer or a custom anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export const ContextMenuPositioner = MenuPositioner as unknown as (
  props: ContextMenuPositionerProps,
) => JSX.Element;

export interface ContextMenuPositionerProps extends MenuPositionerProps {}

export namespace ContextMenuPositioner {
  export type Props = ContextMenuPositionerProps;
  export type State = ContextMenuPositionerState;
}
