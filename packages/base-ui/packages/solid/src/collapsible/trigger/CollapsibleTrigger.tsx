import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { canRenderNative, composeHandler } from '../../utils/native';
import { renderNativeElement, type SetAttribute } from '../../utils/native/element';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import { type CollapsibleRootState } from '../root/CollapsibleRoot';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);
/** Handler keys the trigger needs even without a consumer handler. */
const HANDLER_KEYS = ['onClick', 'onKeyDown', 'onPointerDown'] as const;

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsibleTrigger(componentProps: CollapsibleTrigger.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a native `<button>` rendered
  // with direct JSX; `useButton` for a focusable-when-disabled native button is inlined below.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton ?? true) === true
  ) {
    return NativeCollapsibleTrigger(componentProps);
  }

  const {
    panelId,
    open,
    handleTrigger,
    state,
    disabled: contextDisabled,
  } = useCollapsibleRootContext();

  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const disabled = () => local.disabled ?? contextDisabled();
  const nativeButton = () => local.nativeButton ?? true;

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const props: HTMLProps = {
    get 'aria-controls'() {
      return open() ? panelId() : undefined;
    },
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    onClick: handleTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [...buttonSources.attributes, props, elementProps, buttonSources.handlers],
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

/* eslint-disable-next-line typescript/no-explicit-any -- handlers pass through as the kit holds them */
type Handler = (...args: any[]) => unknown;

/**
 * The consumer's handler for one of a disclosure trigger's keys, composed as `useButton` (a
 * focusable-when-disabled native button outside a composite root) and the trigger's own `onClick`
 * compose it: the disabled gate first, the consumer, then the part unless prevented. The
 * after-consumer keyboard logic of `useButton` is a no-op for a native button (the browser
 * activates it). Shared by Collapsible.Trigger and Accordion.Trigger.
 */
export function wrapDisclosureTriggerHandler(
  disabled: () => boolean,
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void,
  key: string,
  read: (() => Handler | undefined) | undefined,
): Handler | undefined {
  switch (key.toLowerCase()) {
    case 'onclick':
      return composeHandler<MouseEvent>(read, handleTrigger, (event) => {
        if (disabled()) {
          event.preventDefault();
          return false;
        }
        return true;
      });
    case 'onpointerdown':
      return composeHandler<PointerEvent>(read, undefined, (event) => {
        if (disabled()) {
          event.preventDefault();
          return false;
        }
        return true;
      });
    case 'onmousedown':
    case 'onkeyup':
      return composeHandler<Event>(read, undefined, () => !disabled());
    case 'onkeydown':
      return composeHandler<KeyboardEvent>(read, undefined, (event) => {
        // Allow Tabbing away from the focusable-when-disabled button; block every other key.
        if (disabled() && event.key !== 'Tab') {
          event.preventDefault();
        }
        return !disabled();
      });
    default:
      return undefined;
  }
}

/** The trigger's `aria-*` attributes, as `useButton` and the trigger's props produce them. */
export function writeDisclosureTriggerAttributes(
  set: SetAttribute,
  open: boolean,
  panelId: JSX.HTMLAttributes<Element>['id'],
  disabled: boolean,
) {
  set('aria-controls', open ? panelId : undefined);
  set('aria-expanded', open ? 'true' : 'false');
  set('aria-disabled', disabled ? 'true' : 'false');
}

function NativeCollapsibleTrigger(props: CollapsibleTrigger.Props): JSX.Element {
  const { panelId, open, handleTrigger, state, disabled: contextDisabled } =
    useCollapsibleRootContext();
  const disabled = () => Boolean(props.disabled ?? contextDisabled());

  return renderNativeElement((<button type="button" tabindex="0" />) as unknown as Element, props, {
    own: OWN_KEYS,
    state,
    mapping: stateAttributesMapping,
    reactive: true,
    attributes: (set) => writeDisclosureTriggerAttributes(set, open(), panelId(), disabled()),
    wrapHandler: (key, read) => wrapDisclosureTriggerHandler(disabled, handleTrigger, key, read),
    handlerKeys: HANDLER_KEYS,
  }) as unknown as JSX.Element;
}

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleTriggerState> {}

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
