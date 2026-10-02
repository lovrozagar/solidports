import { createRenderEffect, createSignal } from 'solid-js';
import { FloatingFocusManager } from '../../floating-ui-solid';
import { contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { InteractionType } from '../../utils/useEnhancedClickHandler';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxFloatingContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { getComboboxPopupId } from '../root/utils';
import { ComboboxInternalDismissButton } from '../utils/ComboboxInternalDismissButton';
import { useListEmpty } from '../utils/parts';

const stateAttributesMapping: StateAttributesMapping<ComboboxPopup.State> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the list.
 * Renders a `<div>` element.
 */
export function ComboboxPopup(componentProps: ComboboxPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'initialFocus',
    'finalFocus',
  ]);

  const store = useComboboxRootContext();
  const positioning = useComboboxPositionerContext();
  const floatingRootContext = useComboboxFloatingContext();

  const mounted = store.useState('mounted');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const popupProps = store.useState('popupProps');
  const transitionStatus = store.useState('transitionStatus');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const inputElement = store.useState('inputElement');
  const modal = store.useState('modal');
  const rootId = store.useState('id');

  const empty = useListEmpty();
  const popupId = () =>
    (elementProps as { id?: string | undefined }).id ??
    (inputInsidePopup() ? getComboboxPopupId(rootId()) : undefined);

  // Solid: refs are applied after this effect is created, so the element is tracked to read its
  // rendered id once it exists (React's layout effect runs after the ref is attached).
  const [popupElement, setPopupElement] = createSignal<HTMLDivElement | null | undefined>(null, {
    ownedWrite: true,
  });

  createRenderEffect(
    () => ({ id: popupId(), element: popupElement() }),
    ({ id, element }) => {
      // Prefer the rendered DOM id, which a `render` prop element or function may override.
      store.set('popupId', element?.id || id);
      return () => {
        store.set('popupId', undefined);
      };
    },
  );

  useOpenChangeComplete({
    open,
    ref: () => store.context.popupRef.current,
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete(true);
      }
    },
  });

  const state: ComboboxPopup.State = {
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get empty() {
      return empty();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: (el) => {
      store.context.popupRef.current = el;
      setPopupElement(el);
    },
    get props() {
      return [
        popupProps(),
        {
          id: popupId(),
          role: inputInsidePopup() ? 'dialog' : 'presentation',
          // Solid: React's `onFocus` bubbles, so focusing the list re-enters this handler and
          // hands focus back to the input; `focusin` observes that descendant focus.
          onFocusIn(event: FocusEvent) {
            const target = getTarget(event) as Element | null;
            if (
              openMethod() !== 'touch' &&
              (contains(store.state.listElement, target) || target === event.currentTarget)
            ) {
              store.context.inputRef.current?.focus();
            }
          },
        },
        getDisabledMountTransitionStyles(transitionStatus()),
        elementProps,
      ];
    },
    stateAttributesMapping,
  });

  // Default initial focus logic:
  // If opened by touch, focus the popup element to prevent the virtual keyboard from opening
  // (this is required for Android specifically as iOS handles this automatically).
  const computedDefaultInitialFocus = () =>
    inputInsidePopup()
      ? (interactionType: InteractionType) =>
          interactionType === 'touch' ? store.context.popupRef.current : inputElement()
      : false;

  const resolvedInitialFocus = () =>
    local.initialFocus === undefined ? computedDefaultInitialFocus() : local.initialFocus;

  const resolvedFinalFocus = () => {
    if (local.finalFocus != null) {
      return local.finalFocus;
    }
    return inputInsidePopup() ? undefined : false;
  };

  const focusManagerModal = () => !inputInsidePopup() || modal();

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      disabled={!mounted()}
      modal={focusManagerModal()}
      openInteractionType={openMethod()}
      initialFocus={resolvedInitialFocus()}
      returnFocus={resolvedFinalFocus()}
      getInsideElements={() => [
        store.context.startDismissRef.current,
        store.context.endDismissRef.current,
      ]}
    >
      <>
        {element()}
        {focusManagerModal() && (
          <ComboboxInternalDismissButton
            ref={(el) => {
              store.context.endDismissRef.current = el;
            }}
          />
        )}
      </>
    </FloatingFocusManager>
  );
}

export interface ComboboxPopupState {
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  transitionStatus: TransitionStatus;
  empty: boolean;
}

export interface ComboboxPopupProps extends BaseUIComponentProps<'div', ComboboxPopup.State> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((openType: InteractionType) => void | boolean | HTMLElement | undefined | null)
      )
    | undefined;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((closeType: InteractionType) => void | boolean | HTMLElement | undefined | null)
      )
    | undefined;
}

export namespace ComboboxPopup {
  export type State = ComboboxPopupState;
  export type Props = ComboboxPopupProps;
}
