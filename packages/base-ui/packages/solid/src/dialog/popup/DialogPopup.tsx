import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { FloatingFocusManager } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { FOCUSABLE_POPUP_PROPS, createDefaultInitialFocus } from '../../utils/popups';
import { type BaseUIComponentProps } from '../../utils/types';
import { InteractionType } from '../../utils/useEnhancedClickHandler';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { type TransitionStatus } from '../../utils/useTransitionStatus';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { useDialogRootContext } from '../root/DialogRootContext';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';
import { DialogPopupCssVars } from './DialogPopupCssVars';

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogPopup(componentProps: DialogPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'finalFocus',
    'initialFocus',
  ]);

  const store = useDialogRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const floatingRootContext = store.context.floatingRootContext;
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const transitionStatus = store.useState('transitionStatus');
  const role = store.useState('role');
  const floatingId = floatingRootContext.useState('floatingId');

  useDialogPortalContext();

  useOpenChangeComplete({
    open,
    get ref() {
      return store.context.popupRef.current;
    },
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = () =>
    local.initialFocus === undefined
      ? createDefaultInitialFocus(store.context.popupRef)
      : local.initialFocus;

  const nestedDialogOpen = () => nestedOpenDialogCount() > 0;

  const setPopupElement = store.useStateSetter('popupElement');

  const state: DialogPopupState = {
    get open() {
      return open();
    },
    get nested() {
      return nested();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get nestedDialogOpen() {
      return nestedDialogOpen();
    },
  };

  const element = useRenderElement<'div', DialogPopupState>('div', componentProps, {
    state,
    props: [
      propsSourceAccessor(() => rootPopupProps()),
      {
        get id() {
          return floatingId();
        },
        get 'aria-labelledby'() {
          return titleElementId();
        },
        get 'aria-describedby'() {
          return descriptionElementId();
        },
        get role() {
          return role();
        },
        ...FOCUSABLE_POPUP_PROPS,
        get hidden() {
          return !mounted();
        },
        onKeyDown(event: KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        get style() {
          return {
            [DialogPopupCssVars.nestedDialogs]: nestedOpenDialogCount(),
          };
        },
      },
      elementProps,
    ],
    ref: [store.context.popupRef, setPopupElement],
    stateAttributesMapping: dialogStateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      openInteractionType={openMethod()}
      disabled={!mounted()}
      closeOnFocusOut={!disablePointerDismissal()}
      initialFocus={resolvedInitialFocus()}
      returnFocus={local.finalFocus}
      modal={modal() !== false}
      restoreFocus="popup"
    >
      {element()}
    </FloatingFocusManager>
  );
}

export interface DialogPopupProps extends BaseUIComponentProps<'div', DialogPopup.State> {
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((openType: InteractionType) => boolean | HTMLElement | null | void)
      )
    | undefined;
  /**
   * Determines the element to focus when the dialog is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
      )
    | undefined;
}

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogPopup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}
