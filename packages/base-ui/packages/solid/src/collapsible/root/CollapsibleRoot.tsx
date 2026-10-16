import type { JSX } from '@solidjs/web';
import { isStaticProp, splitComponentProps, provideContext } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import type { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useCollapsibleRoot } from './useCollapsibleRoot';
import { CollapsibleRootContext } from './CollapsibleRootContext';
import { collapsibleStateAttributesMapping, writeCollapsibleState } from './stateAttributesMapping';

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/solid/components/collapsible)
 */
export function CollapsibleRoot(componentProps: CollapsibleRoot.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX and its context on one owner, on the client, the server and while hydrating. A `render`
  // prop or spread props keep `useRenderElement`.
  if (canRenderNative(componentProps, [], { ssr: true })) {
    return NativeCollapsibleRoot(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'defaultOpen',
    'disabled',
    'onOpenChange',
    'open',
  ]);

  // Solid: a handler reading the latest prop is React's stable callback.
  const onOpenChange = (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) =>
    local.onOpenChange?.(open, eventDetails);

  const collapsible = useCollapsibleRoot({
    open: () => local.open,
    defaultOpen: () => local.defaultOpen ?? false,
    onOpenChange,
    disabled: () => local.disabled ?? false,
  });

  const state: CollapsibleRootState = {
    get open() {
      return collapsible.open();
    },
    get disabled() {
      return collapsible.disabled();
    },
    get transitionStatus() {
      return collapsible.transitionStatus();
    },
  };

  const contextValue: CollapsibleRootContext = {
    ...collapsible,
    onOpenChange,
    state,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: collapsibleStateAttributesMapping,
  });

  return provideContext(CollapsibleRootContext, contextValue, element);
}

/** The root's element: a `<div>`. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['defaultOpen', 'disabled', 'onOpenChange', 'open']);

function NativeCollapsibleRoot(props: CollapsibleRoot.Props) {
  const onOpenChange = (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) =>
    props.onOpenChange?.(open, eventDetails);

  const collapsible = useCollapsibleRoot({
    open: () => props.open,
    defaultOpen: () => props.defaultOpen ?? false,
    staticOpen: isStaticProp(props, 'open') && isStaticProp(props, 'defaultOpen'),
    onOpenChange,
    disabled: () => props.disabled ?? false,
  });

  const state: CollapsibleRootState = {
    get open() {
      return collapsible.open();
    },
    get disabled() {
      return collapsible.disabled();
    },
    get transitionStatus() {
      return collapsible.transitionStatus();
    },
  };

  // The hook's own object becomes the context: no copy of its members per root.
  const contextValue = collapsible as CollapsibleRootContext;
  contextValue.onOpenChange = onOpenChange;
  contextValue.state = state;

  return provideNativeContext(CollapsibleRootContext, contextValue, () =>
    renderNativeElement(DIV, props, {
      own: OWN_KEYS,
      state,
      mapping: collapsibleStateAttributesMapping,
      stateWriter: writeCollapsibleState,
      reactive: true,
    }),
  ) as unknown as JSX.Element;
}

// Solid: React picks these from the hook's return value; here the hook returns accessors.
export interface CollapsibleRootState {
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  transitionStatus: TransitionStatus;
}

export interface CollapsibleRootProps extends BaseUIComponentProps<'div', CollapsibleRootState> {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void) | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CollapsibleRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;
export type CollapsibleRootChangeEventDetails =
  BaseUIChangeEventDetails<CollapsibleRootChangeEventReason>;

export namespace CollapsibleRoot {
  export type State = CollapsibleRootState;
  export type Props = CollapsibleRootProps;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}
