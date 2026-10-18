import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { canRenderNative, partHandler } from '../../utils/native';
import {
  compileStateWriter,
  isNativeButtonRender,
  renderNativeElement,
} from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);
/** The trigger's state attributes, compiled once (the root's state keys, in order). */
const writeTriggerState = compileStateWriter(
  ['open', 'disabled', 'transitionStatus'],
  stateAttributesMapping,
);

/** The trigger's element: a focusable `<button>`; the server renders the same literals. */
const BUTTON = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '0' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
  create: () => (<button type="button" tabindex="0" />) as unknown as Element,
};

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsibleTrigger(componentProps: CollapsibleTrigger.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a native `<button>` rendered
  // with direct JSX; `useButton` for a focusable-when-disabled native button is inlined below.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS, true, isNativeButtonRender, true) &&
    // Static once `canRenderNative` passes: a plain value, read without tracking anything.
    (componentProps.nativeButton ?? true) === true
  ) {
    return NativeCollapsibleTrigger(componentProps);
  }

  const root = useCollapsibleRootContext();

  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);
  const disabled = () => local.disabled ?? root.disabled();
  const nativeButton = () => local.nativeButton ?? true;

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const props: HTMLProps = {
    get 'aria-controls'() {
      return root.open() ? root.panelId() : undefined;
    },
    get 'aria-expanded'() {
      return root.open() ? 'true' : 'false';
    },
    onClick: root.handleTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    state: root.state,
    ref: buttonRef,
    props: [...buttonSources.attributes, props, elementProps, buttonSources.handlers],
    stateAttributesMapping,
  });

  return element();
}

/** What a disclosure trigger's handlers act on: its `disabled` accessor and its root. */
export class DisclosureTriggerTarget {
  declare readonly disabled: () => boolean;
  declare readonly root: { handleTrigger(event: MouseEvent | KeyboardEvent): void };

  constructor(
    disabled: () => boolean,
    root: { handleTrigger(event: MouseEvent | KeyboardEvent): void },
  ) {
    this.disabled = disabled;
    this.root = root;
  }
}

/** A disabled trigger cancels the event and runs no handler. */
function preventWhileDisabled(target: DisclosureTriggerTarget, event: Event) {
  if (target.disabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (target: DisclosureTriggerTarget) => !target.disabled();

/**
 * A disclosure trigger's handlers, composed as `useButton` and the trigger's own `onClick` compose
 * them: the disabled gate first, the consumer, then the part unless prevented. The after-consumer
 * keyboard logic of `useButton` is a no-op for a native button (the browser activates it). Shared
 * by Collapsible.Trigger and Accordion.Trigger, created once.
 */
export const DISCLOSURE_TRIGGER_HANDLERS = {
  onClick: partHandler<DisclosureTriggerTarget, MouseEvent>(
    'onClick',
    (target, event) => target.root.handleTrigger(event),
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<DisclosureTriggerTarget, KeyboardEvent>(
    'onKeyDown',
    undefined,
    (target, event) => {
      // Allow Tabbing away from the focusable-when-disabled button; block every other key.
      if (target.disabled() && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !target.disabled();
    },
  ),
  onPointerDown: partHandler<DisclosureTriggerTarget, PointerEvent>(
    'onPointerDown',
    undefined,
    preventWhileDisabled,
  ),
};

/** The disabled gate for a consumer's `onMouseDown` and `onKeyUp`, bound only when passed. */
export const DISCLOSURE_TRIGGER_HANDLERS_IF_PASSED = {
  onMouseDown: partHandler<DisclosureTriggerTarget>('onMouseDown', undefined, runWhileEnabled),
  onKeyUp: partHandler<DisclosureTriggerTarget>('onKeyUp', undefined, runWhileEnabled),
};

/** The trigger's `aria-*` attributes, as `useButton` and the trigger's props produce them. */
export function writeDisclosureTriggerAttributes(
  w: SetAttribute,
  open: boolean,
  panelId: JSX.HTMLAttributes<Element>['id'],
  disabled: boolean,
) {
  w.set('aria-controls', open ? panelId : undefined);
  w.set('aria-expanded', open ? 'true' : 'false');
  // Native buttons expose disabled through the disabled attribute.
  w.set('disabled', disabled ? true : undefined);
}

function NativeCollapsibleTrigger(props: CollapsibleTrigger.Props): JSX.Element {
  const root = useCollapsibleRootContext();
  const disabled = () => Boolean(props.disabled ?? root.disabled());

  return renderNativeElement(BUTTON, props, {
    own: OWN_KEYS,
    state: () => root.state,
    stateView: root.stateView,
    mapping: stateAttributesMapping,
    stateWriter: writeTriggerState,
    reactive: true,
    attributes: (w) => writeDisclosureTriggerAttributes(w, root.open(), root.panelId(), disabled()),
    handlers: DISCLOSURE_TRIGGER_HANDLERS,
    handlersIfPassed: DISCLOSURE_TRIGGER_HANDLERS_IF_PASSED,
    // The server renders no handlers: nothing to act on.
    handlerTarget: isServer ? undefined : new DisclosureTriggerTarget(disabled, root),
  }) as unknown as JSX.Element;
}

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleTriggerState> {}

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
