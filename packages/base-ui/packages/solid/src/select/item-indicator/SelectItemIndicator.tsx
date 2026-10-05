import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useSelectItemContext } from '../item/SelectItemContext';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator(componentProps: SelectItemIndicator.Props) {
  const { selected } = useSelectItemContext();

  const shouldRender = () => (componentProps.keepMounted ?? false) || selected();

  return (
    <Show when={shouldRender()}>
      <Inner {...componentProps} />
    </Show>
  );
}

/** The core implementation is split here to avoid paying the hooks' costs unless the element needs
 * to mount, as React's `Inner`: an unselected item's indicator creates nothing. */
function Inner(componentProps: SelectItemIndicator.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, ['keepMounted']);

  const { selected } = useSelectItemContext();

  let indicatorRef = null as HTMLSpanElement | null | undefined;

  const { transitionStatus, setMounted } = useTransitionStatus(selected);

  const state: SelectItemIndicator.State = {
    get selected() {
      return selected();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  useOpenChangeComplete({
    batch: true,
    enabled: () => !selected(),
    onComplete() {
      if (!selected()) {
        setMounted(false);
      }
    },
    open: selected,
    ref: () => indicatorRef,
  });

  const element = useRenderElement('span', componentProps, {
    get children() {
      return <>{componentProps.children ?? '✔️'}</>;
    },
    props: [{ 'aria-hidden': 'true' }, elementProps],
    ref: (el) => {
      indicatorRef = el;
    },
    state,
    stateAttributesMapping: transitionStatusMapping,
  });

  return <>{element()}</>;
}

export interface SelectItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicator.State
> {
  children?: JSX.Element;
  /** Whether to keep the HTML element in the DOM when the item is not selected. */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
