import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import {
  wrapDisclosureTriggerHandler,
  writeDisclosureTriggerAttributes,
} from '../../collapsible/trigger/CollapsibleTrigger';
import { createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import { canRenderNative } from '../../utils/native';
import {
  compileStateWriter,
  isNativeButtonRender,
  renderNativeElement,
} from '../../utils/native/element';
import { createIdRegistration } from '../../utils/native/registration';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { ITEM_STATE_KEYS } from '../item/AccordionItemModel';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
/** The trigger's element: a focusable `<button>`; the server renders the same literals. */
const BUTTON = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '0' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
  create: () => (<button type="button" tabindex="0" />) as unknown as Element,
};

const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'id', 'nativeButton']);
/** Handler keys the trigger needs even without a consumer handler. */
const HANDLER_KEYS = ['onClick', 'onKeyDown', 'onPointerDown'] as const;

const stateAttributesMapping: StateAttributesMapping<AccordionTriggerState> = {
  ...accordionStateAttributesMapping,
  ...triggerOpenStateMapping,
};

/** The trigger's state attributes, compiled once (the item's state keys, in order). */
const writeTriggerState = compileStateWriter(ITEM_STATE_KEYS, stateAttributesMapping);

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */

export function AccordionTrigger(componentProps: AccordionTrigger.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a native `<button>` rendered
  // with direct JSX; `useButton` for a focusable-when-disabled native button is inlined.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS, true, isNativeButtonRender, true) &&
    // Static once `canRenderNative` passes: a plain value, read without tracking anything.
    (componentProps.nativeButton ?? true) === true
  ) {
    return NativeAccordionTrigger(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'id',
    'nativeButton',
  ]);
  const nativeButton = () => local.nativeButton ?? true;

  const root = useCollapsibleRootContext();

  const disabled = () => (local.disabled ?? false) || root.disabled();

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const { defaultTriggerId, state, setTriggerId } = useAccordionItemContext();
  const registeredId = () => local.id || undefined;
  const id = () => registeredId() ?? defaultTriggerId?.();

  createDepsRenderEffect(registeredId, (currentRegisteredId) => {
    setTriggerId(
      (currentId) => currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      setTriggerId((currentId) => (currentId === currentRegisteredId ? null : currentId));
    };
  });

  const props: HTMLProps = {
    get 'aria-controls'() {
      return root.open() ? root.panelId() : undefined;
    },
    get 'aria-expanded'() {
      return root.open() ? 'true' : 'false';
    },
    get id() {
      return id();
    },
    onClick: root.handleTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [...buttonSources.attributes, props, elementProps, buttonSources.handlers],
    stateAttributesMapping,
  });

  return element();
}

function NativeAccordionTrigger(props: AccordionTrigger.Props): JSX.Element {
  const root = useCollapsibleRootContext();
  const item = useAccordionItemContext();
  const { defaultTriggerId, setTriggerId } = item;
  const disabled = () => (props.disabled ?? false) || root.disabled();
  const id = () => (props.id || undefined) ?? defaultTriggerId?.();

  const registerId = createIdRegistration(props, 'id', setTriggerId, item.owner);

  return renderNativeElement(BUTTON, props, {
    refs: registerId ? [registerId] : undefined,
    own: OWN_KEYS,
    state: () => item.state,
    stateView: item.stateView,
    stateWriter: writeTriggerState,
    mapping: stateAttributesMapping,
    reactive: true,
    attributes: (w) => {
      writeDisclosureTriggerAttributes(w, root.open(), root.panelId(), disabled());
      w.set('id', id());
    },
    // The server renders no handlers: no wrapper to create.
    wrapHandler: isServer
      ? undefined
      : (key, read) => wrapDisclosureTriggerHandler(disabled, root.handleTrigger, key, read),
    handlerKeys: HANDLER_KEYS,
  }) as unknown as JSX.Element;
}

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AccordionTriggerState> {}

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props = AccordionTriggerProps;
}
