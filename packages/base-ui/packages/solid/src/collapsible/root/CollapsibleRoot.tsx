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

  // The root's own props are the hook's parameters, read live.
  const collapsible = useCollapsibleRoot(local);

  const element = useRenderElement('div', componentProps, {
    state: collapsible.state,
    props: elementProps,
    stateAttributesMapping: collapsibleStateAttributesMapping,
  });

  return provideContext(CollapsibleRootContext, collapsible, element);
}

/** The root's element: a `<div>`. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['defaultOpen', 'disabled', 'onOpenChange', 'open']);

function NativeCollapsibleRoot(props: CollapsibleRoot.Props) {
  // The root's own props are the hook's parameters, read live; the dev checks only need the
  // static test.
  const collapsible = useCollapsibleRoot(
    props,
    process.env.NODE_ENV !== 'production' &&
      isStaticProp(props, 'open') &&
      isStaticProp(props, 'defaultOpen'),
  );

  return provideNativeContext(CollapsibleRootContext, collapsible, () =>
    renderNativeElement(DIV, props, {
      own: OWN_KEYS,
      state: () => collapsible.state,
      stateView: collapsible.stateView,
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
