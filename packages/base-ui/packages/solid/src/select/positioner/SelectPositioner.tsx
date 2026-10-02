import { createEffect, createRenderEffect, createSignal, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  CompositeList,
  type CompositeMetadata,
} from '../../internals/composite/list/CompositeList';
import { FloatingNode, useFloatingNodeId } from '../../floating-ui-solid';
import { createDepsEffect, splitComponentProps, useRef } from '../../solid-helpers';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../utils/constants';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { findItemIndex, selectedValueIncludes } from '../../utils/itemEquality';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIHTMLProps } from '../../utils/types';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { useAnchorPositioning, type Align, type Side } from '../../utils/useAnchorPositioning';
import { usePositioner } from '../../utils/usePositioner';
import { clearStyles } from '../popup/utils';
import { useSelectFloatingContext, useSelectRootContext } from '../root/SelectRootContext';
import { SelectPositionerContext } from './SelectPositionerContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const FIXED: JSX.CSSProperties = { position: 'fixed' };

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPositioner(componentProps: SelectPositioner.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'anchor',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
    'alignItemWithTrigger',
    'collisionAvoidance',
  ]);
  const positionMethod = () => local.positionMethod ?? 'absolute';
  const side = () => local.side ?? 'bottom';
  const align = () => local.align ?? 'center';
  const sideOffset = () => local.sideOffset ?? 0;
  const alignOffset = () => local.alignOffset ?? 0;
  const collisionBoundary = () => local.collisionBoundary ?? 'clipping-ancestors';
  const collisionPadding = () => local.collisionPadding;
  const arrowPadding = () => local.arrowPadding ?? 5;
  const sticky = () => local.sticky ?? false;
  const alignItemWithTrigger = () => local.alignItemWithTrigger ?? true;
  const collisionAvoidance = () => local.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;

  const {
    store,
    listRef,
    labelsRef,
    alignItemWithTriggerActiveRef,
    selectedItemTextRef,
    valuesRef,
    initialValueRef,
    popupRef,
    setValue,
  } = useSelectRootContext();
  const floatingRootContext = useSelectFloatingContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const value = store.useState('value');
  const openMethod = store.useState('openMethod');
  const positionerElement = store.useState('positionerElement');
  const triggerElement = store.useState('triggerElement');
  const isItemEqualToValue = store.useState('isItemEqualToValue');
  const transitionStatus = store.useState('transitionStatus');

  // Solid: React treats presses and focus inside the portaled popup as inside an enclosing
  // floating element through portal event bubbling; here the positioner joins its floating tree.
  const nodeId = useFloatingNodeId();

  const scrollUpArrowRef = useRef<HTMLDivElement | null | undefined>(null);
  const scrollDownArrowRef = useRef<HTMLDivElement | null | undefined>(null);

  const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = createSignal(
    untrack(() => alignItemWithTrigger()),
  );
  const alignItemWithTriggerActive = () =>
    mounted() && controlledAlignItemWithTrigger() && openMethod() !== 'touch';

  createDepsEffect(
    () => ({ mounted: mounted(), alignItemWithTrigger: alignItemWithTrigger() }),
    (deps) => {
      if (!deps.mounted && untrack(controlledAlignItemWithTrigger) !== deps.alignItemWithTrigger) {
        setControlledAlignItemWithTrigger(deps.alignItemWithTrigger);
      }
    },
  );

  // ––– AI-GENERATED FIX AND EXPLANATION –––
  // Solid-specific: the store outlives the positioner's mount cycle without a rerender resetting
  // the scroll arrow flags, so clear them once the popup unmounts.
  createEffect(mounted, (isMounted) => {
    if (isMounted) {
      return;
    }
    untrack(() => {
      if (store.state.scrollUpArrowVisible || store.state.scrollDownArrowVisible) {
        store.update({ scrollDownArrowVisible: false, scrollUpArrowVisible: false });
      }
    });
  });

  createEffect(alignItemWithTriggerActive, (active) => {
    alignItemWithTriggerActiveRef.current = active;
  });

  useAnchoredPopupScrollLock({
    enabled: () => (alignItemWithTriggerActive() || modal()) && open(),
    positionerElement,
    referenceElement: triggerElement,
    touchOpen: () => openMethod() === 'touch',
  });

  const positioning = useAnchorPositioning({
    align,
    alignOffset,
    anchor: () => local.anchor,
    arrowPadding,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking: () => local.disableAnchorTracking ?? alignItemWithTriggerActive(),
    get floatingRootContext() {
      return floatingRootContext;
    },
    keepMounted: true,
    mounted,
    nodeId,
    positionMethod,
    side,
    sideOffset,
    sticky,
  });

  const renderedSide = () => (alignItemWithTriggerActive() ? 'none' : positioning.side());
  const positionerStyles = () => {
    return alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles();
  };

  const state: SelectPositioner.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get open() {
      return open();
    },
    get side() {
      return renderedSide();
    },
  };

  createRenderEffect(positioning.side, (positionedSide) => {
    store.set('popupSide', positionedSide);
  });

  const setPositionerElement = (element: HTMLElement | null | undefined) => {
    store.set('positionerElement', element);
  };

  const element = usePositioner(componentProps, state, {
    get styles() {
      return positionerStyles();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    // Solid: the remaining positioner props are plain element props once the positioning options are split off.
    props: elementProps as BaseUIHTMLProps<HTMLDivElement>,
    refs: setPositionerElement,
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open();
    },
  });

  let prevMapSizeRef = 0;

  const onMapChange = <Metadata,>(
    newMap: Array<{ element: Element; metadata: CompositeMetadata<Metadata> | null }>,
  ) => {
    if (newMap.length === 0 && prevMapSizeRef === 0) {
      return;
    }

    if (valuesRef.current.length === 0) {
      return;
    }

    const prevSize = prevMapSizeRef;
    prevMapSizeRef = newMap.length;

    const eventDetails = createChangeEventDetails(REASONS.none);
    const val = value();

    if (prevSize !== 0 && !store.state.multiple && val !== null) {
      const selectedValueIndex = findItemIndex(valuesRef.current, val, isItemEqualToValue());
      if (selectedValueIndex === -1) {
        const initialSelectedValue = initialValueRef.current;
        const hasInitial =
          initialSelectedValue != null &&
          findItemIndex(valuesRef.current, initialSelectedValue, isItemEqualToValue()) !== -1;
        const nextValue = hasInitial ? initialSelectedValue : null;
        setValue(nextValue, eventDetails);

        if (nextValue === null) {
          store.set('selectedIndex', null);
          selectedItemTextRef.current = null;
        }
      }
    }

    if (prevSize !== 0 && store.state.multiple && Array.isArray(val)) {
      const hasVisibleItem = (selectedItemValue: unknown) =>
        findItemIndex(valuesRef.current, selectedItemValue, isItemEqualToValue()) !== -1;
      const nextValue = val.filter((selectedItemValue) => hasVisibleItem(selectedItemValue));
      if (
        nextValue.length !== val.length ||
        nextValue.some(
          (selectedItemValue) =>
            !selectedValueIncludes(val, selectedItemValue, isItemEqualToValue()),
        )
      ) {
        setValue(nextValue, eventDetails);

        if (nextValue.length === 0) {
          store.set('selectedIndex', null);
          selectedItemTextRef.current = null;
        }
      }
    }

    if (open() && alignItemWithTriggerActive()) {
      store.update({
        scrollDownArrowVisible: false,
        scrollUpArrowVisible: false,
      });

      const stylesToClear: JSX.CSSProperties = { height: '' };
      clearStyles(positionerElement(), stylesToClear);
      clearStyles(popupRef.current, stylesToClear);
    }
  };

  const contextValue: SelectPositionerContext = solidMergeProps(positioning, {
    alignItemWithTriggerActive,
    scrollDownArrowRef,
    scrollUpArrowRef,
    setControlledAlignItemWithTrigger,
    side: renderedSide,
  }) as SelectPositionerContext;

  return (
    <CompositeList
      refs={{ elements: listRef.current, labels: labelsRef.current }}
      onMapChange={onMapChange}
    >
      <SelectPositionerContext value={contextValue}>
        <Show when={mounted() && modal()}>
          <InternalBackdrop managed inert={!open()} cutout={triggerElement()} />
        </Show>
        <FloatingNode id={nodeId()}>{element()}</FloatingNode>
      </SelectPositionerContext>
    </CompositeList>
  );
}

export interface SelectPositionerState {
  open: boolean;
  side: Side | 'none';
  align: Align;
  anchorHidden: boolean;
}

export interface SelectPositionerProps
  extends
    useAnchorPositioning.SharedParameters,
    BaseUIComponentProps<'div', SelectPositioner.State> {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props = SelectPositionerProps;
}
