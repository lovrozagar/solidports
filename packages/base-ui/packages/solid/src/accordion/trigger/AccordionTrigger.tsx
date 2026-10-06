import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import {
  wrapDisclosureTriggerHandler,
  writeDisclosureTriggerAttributes,
} from '../../collapsible/trigger/CollapsibleTrigger';
import { createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { createIdRegistration } from '../../utils/native/registration';
import { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'id', 'nativeButton']);
/** Handler keys the trigger needs even without a consumer handler. */
const HANDLER_KEYS = ['onClick', 'onKeyDown', 'onPointerDown'] as const;

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */

export function AccordionTrigger(componentProps: AccordionTrigger.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a native `<button>` rendered
  // with direct JSX; `useButton` for a focusable-when-disabled native button is inlined.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton ?? true) === true
  ) {
    return NativeAccordionTrigger(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'id',
    'nativeButton',
  ]);
  const nativeButton = () => local.nativeButton ?? true;

  const { panelId, open, handleTrigger, disabled: contextDisabled } = useCollapsibleRootContext();

  const disabled = () => (local.disabled ?? false) || contextDisabled();

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
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
      return open() ? panelId() : undefined;
    },
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    get id() {
      return id();
    },
    onClick: handleTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [...buttonSources.attributes, props, elementProps, buttonSources.handlers],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return <>{element()}</>;
}

function NativeAccordionTrigger(props: AccordionTrigger.Props): JSX.Element {
  const { panelId, open, handleTrigger, disabled: contextDisabled } = useCollapsibleRootContext();
  const { defaultTriggerId, owner: itemOwner, state, setTriggerId } = useAccordionItemContext();
  const disabled = () => (props.disabled ?? false) || contextDisabled();
  const id = () => (props.id || undefined) ?? defaultTriggerId?.();

  const registerId = createIdRegistration(props, 'id', setTriggerId, itemOwner);

  return renderNativeElement((<button type="button" tabindex="0" />) as unknown as Element, props, {
    refs: registerId ? [registerId] : undefined,
    own: OWN_KEYS,
    state,
    mapping: triggerOpenStateMapping,
    reactive: true,
    attributes: (set) => {
      writeDisclosureTriggerAttributes(set, open(), panelId(), disabled());
      set('id', id());
    },
    wrapHandler: (key, read) => wrapDisclosureTriggerHandler(disabled, handleTrigger, key, read),
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
