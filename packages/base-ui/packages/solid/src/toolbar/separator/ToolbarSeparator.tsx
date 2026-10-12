import { createMemo } from 'solid-js';
import { Separator } from '../../separator';
import type { SeparatorState } from '../../separator';
import type { Orientation } from '../../utils/types';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarSeparator(props: ToolbarSeparator.Props) {
  const context = useToolbarRootContext();

  const orientation = createMemo(
    () =>
      (
        ({
          horizontal: 'vertical',
          vertical: 'horizontal',
        }) as Record<ToolbarRoot.Orientation, ToolbarRoot.Orientation>
      )[context.orientation()],
  );

  return <Separator orientation={orientation()} {...props} ref={props.ref} />;
}

export interface ToolbarSeparatorState extends SeparatorState {}

export interface ToolbarSeparatorProps extends Separator.Props {
  /**
   * The orientation of the separator. Defaults to the opposite of the toolbar's
   * orientation, so a horizontal toolbar renders vertical separators.
   */
  orientation?: Orientation | undefined;
}

export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props = ToolbarSeparatorProps;
}
