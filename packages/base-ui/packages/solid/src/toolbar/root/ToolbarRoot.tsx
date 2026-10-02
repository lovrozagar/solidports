import { createMemo, createSignal } from 'solid-js';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { splitComponentProps } from '../../solid-helpers';
import { Orientation as BaseOrientation, BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { ToolbarRootContext } from './ToolbarRootContext';

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarRoot(componentProps: ToolbarRoot.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'loopFocus',
    'orientation',
    'children',
  ]);
  const disabled = () => Boolean(local.disabled);
  const loopFocus = () => local.loopFocus ?? true;
  const orientation = () => local.orientation ?? 'horizontal';

  const [itemMap, setItemMap] = createSignal<
    Array<{ element: Element; metadata: CompositeMetadata<ToolbarRoot.ItemMetadata> | null }>
  >([]);

  const disabledIndices = createMemo(() => {
    const output: number[] = [];
    for (const { metadata: itemMetadata } of itemMap()) {
      // Only items that are disabled and not focusable when disabled
      // are removed from roving focus.
      // Solid: the composite index is nullable until the list registers the item.
      if (
        itemMetadata?.disabled &&
        !itemMetadata.focusableWhenDisabled &&
        itemMetadata.index != null
      ) {
        output.push(itemMetadata.index);
      }
    }
    return output;
  });

  const toolbarRootContext: ToolbarRootContext = {
    disabled,
    orientation,
  };

  const state: ToolbarRoot.State = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const defaultProps: Omit<HTMLProps, 'children'> = {
    get 'aria-orientation'() {
      return orientation();
    },
    role: 'toolbar',
  };

  return (
    <ToolbarRootContext value={toolbarRootContext}>
      <CompositeRoot
        render={renderProps.render}
        class={renderProps.class}
        state={state}
        ref={componentProps.ref}
        props={[defaultProps, elementProps]}
        disabledIndices={disabledIndices()}
        loopFocus={loopFocus()}
        onMapChange={setItemMap}
        orientation={orientation()}
      >
        {local.children}
      </CompositeRoot>
    </ToolbarRootContext>
  );
}

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarRootProps extends BaseUIComponentProps<'div', ToolbarRoot.State> {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRoot.Orientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace ToolbarRoot {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}
