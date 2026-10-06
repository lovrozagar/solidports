/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, isStatic, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeItem } from '../internals/composite/item/CompositeItem';
import {
  useCompositeRootContext,
  type CompositeRootContext,
} from '../internals/composite/root/CompositeRootContext';
import { useToolbarRootContext } from '../toolbar/root/ToolbarRootContext';
import { makeEventPreventable } from '../merge-props';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import type { BaseUIEvent } from '../utils/types';
import {
  canRenderNative,
  createNativeElement,
  createCompositeItemRegistration,
  renderNativeElement,
  runConsumerHandler,
  stateAttr,
  type CompositeItemRegistration,
} from '../utils/native';
import { createDepsEffect, splitComponentProps } from '../solid-helpers';
import { useToggleGroupContext } from '../toggle-group/ToggleGroupContext';
import type { ToolbarRoot } from '../toolbar/root/ToolbarRoot';
import { useButton } from '../internals/use-button/useButton';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../utils/createBaseUIEventDetails';
import { error } from '../utils/error';
import { REASONS } from '../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../utils/types';
import { useBaseUiId } from '../utils/useBaseUiId';
import { useControlled } from '../utils/useControlled';
import { useRenderElement } from '../utils/useRenderElement';

/**
 * A two-state button that can be on or off.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toggle](https://base-ui.com/react/components/toggle)
 */
export function Toggle<Value extends string>(componentProps: Toggle.Props<Value>) {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a native `<button>` rendered
  // with direct JSX, inside a composite root (ToggleGroup, Toolbar) or not. A `render` prop,
  // spread props, a non-native button, the server and hydration keep the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.nativeButton ?? true) === true
  ) {
    return NativeToggle(componentProps);
  }

  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'defaultPressed',
    'disabled',
    'form', // never participates in form validation
    'onPressedChange',
    'pressed',
    'type', // cannot change button type
    'value',
    'nativeButton',
    'children',
  ]);
  const defaultPressedProp = () => local.defaultPressed ?? false;
  const disabledProp = () => Boolean(local.disabled);
  const pressedProp = () => local.pressed;
  const valueProp = () => local.value;
  const nativeButton = () => Boolean(local.nativeButton ?? true);

  // `|| undefined` handles cases, where value is falsy (i.e. "")
  const value = useBaseUiId(() => valueProp() || undefined);

  const groupContext = useToggleGroupContext();
  const groupValue = () => groupContext?.value() ?? [];

  const defaultPressed = () => (groupContext ? undefined : defaultPressedProp());

  const disabled = () => (disabledProp() || groupContext?.disabled()) ?? false;

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({
        valueProp: valueProp(),
        isValueInitialized: groupContext?.isValueInitialized(),
      }),
      (deps) => {
        if (groupContext && deps.valueProp === undefined && deps.isValueInitialized) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [pressed, setPressedState] = useControlled({
    controlled: () => (groupContext ? groupValue()?.indexOf(value()) > -1 : pressedProp()),
    default: defaultPressed,
    name: 'Toggle',
    state: 'pressed',
  });

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const state: Toggle.State = {
    get disabled() {
      return disabled();
    },
    get pressed() {
      return pressed();
    },
  };

  const props = [
    ...buttonSources.attributes,
    {
      get 'aria-pressed'() {
        return pressed() ? 'true' : 'false';
      },
      onClick(event: MouseEvent) {
        const nextPressed = !pressed();
        const details = createChangeEventDetails(REASONS.none, event);

        // `onPressedChange` runs before the group commits so that canceling here
        // can also veto the group value change, which shares this `details` object.
        local.onPressedChange?.(nextPressed, details);

        if (details.isCanceled) {
          return;
        }

        const val = value();
        if (val) {
          groupContext?.setGroupValue?.(val, nextPressed, details);
        }

        if (details.isCanceled) {
          return;
        }

        setPressedState(nextPressed);
      },
    },
    elementProps,
    buttonSources.handlers,
  ];

  const element = useRenderElement('button', componentProps, {
    enabled: () => !groupContext,
    props,
    ref: buttonRef,
    state,
  });

  // A disabled toggle is natively disabled and cannot hold roving focus.
  // Toolbar reads this metadata to compute its `disabledIndices`.
  const itemMetadata = createMemo<ToolbarRoot.ItemMetadata>(() => ({
    disabled: disabled(),
    focusableWhenDisabled: false,
  }));

  return (
    <Show when={groupContext} fallback={element()}>
      <CompositeItem
        tag="button"
        render={renderProps.render}
        class={renderProps.class}
        metadata={itemMetadata}
        state={state}
        refs={[buttonRef, componentProps.ref as any]}
        props={props}
      >
        {}
        {local.children}
      </CompositeItem>
    </Show>
  );
}

/** Props the native path reads once, as the slow path reads `nativeButton`. */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'defaultPressed',
  'disabled',
  'form',
  'onPressedChange',
  'pressed',
  'type',
  'value',
  'nativeButton',
]);

/** What the native toggle's handlers read when an event fires. */
interface NativeToggleModel {
  props: Toggle.Props<string>;
  disabled: Accessor<boolean>;
  pressed: Accessor<boolean>;
  setPressedState: (value: boolean) => void;
  value: Accessor<string | undefined>;
  groupContext: ReturnType<typeof useToggleGroupContext>;
  composite: CompositeRootContext | null;
  registration: CompositeItemRegistration | undefined;
  el: HTMLElement | null;
}

type ToggleEvent<T extends Event> = BaseUIEvent<T>;

const BUTTON_ATTRIBUTES = { type: 'button' };
const BUTTON_TABBABLE_ATTRIBUTES = { type: 'button', tabindex: '0' };

// The toggle's handlers, shared by every native toggle and bound per element with Solid's
// `[handler, data]` form: `useButton`'s gates (native button, composite or not) around the
// consumer's handler (first, as React's `mergeProps`), then the part's logic.
function toggleClick(m: NativeToggleModel, event: MouseEvent) {
  makeEventPreventable(event as ToggleEvent<MouseEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  if (runConsumerHandler(m.props, 'onClick', event as ToggleEvent<MouseEvent>)) {
    return;
  }
  const nextPressed = !m.pressed();
  const details = createChangeEventDetails(REASONS.none, event);

  // `onPressedChange` runs before the group commits so that canceling here
  // can also veto the group value change, which shares this `details` object.
  m.props.onPressedChange?.(nextPressed, details);

  if (details.isCanceled) {
    return;
  }

  const val = m.value();
  if (val) {
    m.groupContext?.setGroupValue?.(val, nextPressed, details);
  }

  if (details.isCanceled) {
    return;
  }

  m.setPressedState(nextPressed);
}
function toggleKeyDown(m: NativeToggleModel, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as ToggleEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyDown', baseUIEvent)) {
    return;
  }
  // `useButton` after the consumer: a composite item activates on Space keydown (a native
  // `<button>` activates itself on Enter and on Space keyup otherwise).
  if (m.composite && event.target === event.currentTarget && event.key === ' ') {
    event.preventDefault();
    baseUIEvent.preventBaseUIHandler();
    dispatchClickWithModifiers(event.currentTarget as Element, event);
  }
}
function toggleKeyUp(m: NativeToggleModel, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as ToggleEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  // `useButton` after the consumer: a composite item already activated on keydown.
  if (m.composite && event.target === event.currentTarget && event.key === ' ') {
    runConsumerHandler(m.props, 'onKeyUp', baseUIEvent);
    event.preventDefault();
    return;
  }
  runConsumerHandler(m.props, 'onKeyUp', baseUIEvent);
}
function toggleMouseDown(m: NativeToggleModel, event: MouseEvent) {
  makeEventPreventable(event as ToggleEvent<MouseEvent>);
  if (!m.disabled()) {
    runConsumerHandler(m.props, 'onMouseDown', event as ToggleEvent<MouseEvent>);
  }
}
function togglePointerDown(m: NativeToggleModel, event: PointerEvent) {
  makeEventPreventable(event as ToggleEvent<PointerEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  runConsumerHandler(m.props, 'onPointerDown', event as ToggleEvent<PointerEvent>);
}
// `useCompositeItem`'s handlers (a toggle in a group): the consumer's first.
function toggleFocus(m: NativeToggleModel, event: FocusEvent) {
  makeEventPreventable(event as ToggleEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onFocus', event as ToggleEvent<FocusEvent>)) {
    return;
  }
  m.composite!.onHighlightedIndexChange(m.registration!.index());
}
function toggleMouseMove(m: NativeToggleModel, event: MouseEvent) {
  makeEventPreventable(event as ToggleEvent<MouseEvent>);
  if (runConsumerHandler(m.props, 'onMouseMove', event as ToggleEvent<MouseEvent>)) {
    return;
  }
  const el = m.el;
  if (!m.composite!.highlightItemOnHover() || !el) {
    return;
  }
  const disabled = el.hasAttribute('disabled') || el.ariaDisabled === 'true';
  if (m.composite!.highlightedIndex() !== m.registration!.index() && !disabled) {
    el.focus();
  }
}

/**
 * The native toggle: `useButton` (native button; composite when inside a composite root) and
 * `useCompositeItem` (inside a ToggleGroup) inlined around a direct `<button>`.
 */
function NativeToggle(props: Toggle.Props<string>): JSX.Element {
  const groupContext = useToggleGroupContext();
  const composite = useCompositeRootContext(true);
  const toolbarContext = useToolbarRootContext(true);
  const groupValue = () => groupContext?.value() ?? [];
  // `|| undefined` handles cases, where value is falsy (i.e. "")
  const value = isStatic(props, 'value')
    ? useBaseUiId(props.value || undefined)
    : useBaseUiId(() => props.value || undefined);
  const disabled = () => (Boolean(props.disabled) || groupContext?.disabled()) ?? false;

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({
        valueProp: props.value,
        isValueInitialized: groupContext?.isValueInitialized(),
      }),
      (deps) => {
        if (groupContext && deps.valueProp === undefined && deps.isValueInitialized) {
          error(
            'A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop.',
            'This will cause issues between the Toggle Group and Toggle values.',
            'Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
          );
        }
      },
    );
  }

  const [pressed, setPressedState] = useControlled({
    controlled: () => (groupContext ? groupValue()?.indexOf(value()!) > -1 : props.pressed),
    default: () => (groupContext ? undefined : (props.defaultPressed ?? false)),
    name: 'Toggle',
    state: 'pressed',
  });

  const state: Toggle.State = {
    get disabled() {
      return disabled();
    },
    get pressed() {
      return pressed();
    },
  };

  // Registered with the composite list only inside a ToggleGroup (as `CompositeItem`); a
  // Toolbar reads the item metadata (a memo: a change re-registers, as React re-attaches the ref).
  const registration = groupContext
    ? createCompositeItemRegistration<ToolbarRoot.ItemMetadata>(
        toolbarContext
          ? createMemo<ToolbarRoot.ItemMetadata>(() => ({
              disabled: disabled(),
              focusableWhenDisabled: false,
            }))
          : undefined,
      )
    : undefined;

  const model: NativeToggleModel = {
    props,
    disabled,
    pressed,
    setPressedState,
    value,
    groupContext,
    composite,
    registration,
    el: null,
  };
  const handlers: Record<string, unknown> = {
    onClick: [toggleClick, model],
    onKeyDown: [toggleKeyDown, model],
    onKeyUp: [toggleKeyUp, model],
    onMouseDown: [toggleMouseDown, model],
    onPointerDown: [togglePointerDown, model],
  };
  if (registration) {
    handlers.onFocus = [toggleFocus, model];
    handlers.onMouseMove = [toggleMouseMove, model];
  }
  const disabledIsStatic =
    (!('disabled' in props) || isStatic(props, 'disabled')) && groupContext == null;
  const disabledAttributes = (set: (key: string, value: unknown) => void) => {
    const isDisabled = disabled();
    // `useFocusableWhenDisabled`: a composite native button is focusable while disabled.
    if (composite) {
      set('aria-disabled', isDisabled ? 'true' : 'false');
    }
    set('disabled', isDisabled ? true : undefined);
    set('data-disabled', stateAttr(isDisabled));
  };
  const literal: Record<string, unknown> = {};
  if (disabledIsStatic) {
    disabledAttributes((key, value) => {
      literal[key] = value;
    });
  }
  const el = createNativeElement('button', composite ? BUTTON_ATTRIBUTES : BUTTON_TABBABLE_ATTRIBUTES);
  model.el = el;
  const element = renderNativeElement({
    el,
    props,
    own: OWN_KEYS,
    state,
    literal,
    dynamic(target, set) {
      if (!disabledIsStatic) {
        disabledAttributes(set);
      }
      if (registration) {
        set('tabindex', composite!.highlightedIndex() === registration.index() ? 0 : -1);
      }
      const isPressed = pressed();
      set('aria-pressed', isPressed ? 'true' : 'false');
      set('data-pressed', stateAttr(isPressed));
    },
    handlers,
    partRefs: registration ? [registration.attach] : undefined,
  });
  return element;
}

export interface ToggleState {
  /**
   * Whether the toggle is currently pressed.
   */
  pressed: boolean;
  /**
   * Whether the toggle should ignore user interaction.
   */
  disabled: boolean;
}

export interface ToggleProps<Value extends string>
  extends NativeButtonProps, BaseUIComponentProps<'button', Toggle.State> {
  /**
   * Whether the toggle button is currently pressed.
   * This is the controlled counterpart of `defaultPressed`.
   */
  pressed?: boolean | undefined;
  /**
   * Whether the toggle button is currently pressed.
   * This is the uncontrolled counterpart of `pressed`.
   * @default false
   */
  defaultPressed?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Callback fired when the pressed state is changed.
   */
  onPressedChange?:
    ((pressed: boolean, eventDetails: Toggle.ChangeEventDetails) => void) | undefined;
  /**
   * A unique string that identifies the toggle when used
   * inside a toggle group.
   */
  value?: Value | undefined;
}

export type ToggleChangeEventReason = typeof REASONS.none;

export type ToggleChangeEventDetails = BaseUIChangeEventDetails<Toggle.ChangeEventReason>;

export namespace Toggle {
  export type State = ToggleState;
  export type Props<TValue extends string = string> = ToggleProps<TValue>;
  export type ChangeEventReason = ToggleChangeEventReason;
  export type ChangeEventDetails = ToggleChangeEventDetails;
}
