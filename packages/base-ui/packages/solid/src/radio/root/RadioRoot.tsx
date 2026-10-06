import { DEFAULT_LABELABLE_CONTEXT } from '../../internals/labelable-provider/LabelableContext';
/* eslint-disable typescript/no-explicit-any -- generic radio Value erased at root */
import {
  createEffect,
  createRenderEffect,
  createSignal,
  getOwner,
  isStatic,
  onCleanup,
  onSettled,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import { assign, insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { DEFAULT_FIELD_ITEM_CONTEXT } from '../../field/item/FieldItemContext';
import { DEFAULT_FIELD_ROOT_CONTEXT } from '../../field/root/FieldRootContext';
import type { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { makeEventPreventable } from '../../merge-props';
import { provideContext } from '../../solid-helpers';
import type { BaseUIEvent } from '../../utils/types';
import {
  attachNativeAttributes,
  canRenderNative,
  createNativeElement,
  elementRefs,
  consumerHas,
  createCompositeItemRegistration,
  createLabelFallback,
  createLayout,
  fieldAttributes,
  fieldOwnedKeys,
  fieldStateAttributes,
  finishAttributes,
  literalClassStyle,
  put,
  runConsumerHandler,
  stateAttr,
  type CompositeItemRegistration,
  type NativeLayout,
} from '../../utils/native';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useButton } from '../../internals/use-button';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { omitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { NOOP } from '../../utils/noop';
import { REASONS } from '../../utils/reasons';
import { serializeValue } from '../../utils/serializeValue';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { RadioRootContext } from './RadioRootContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioRoot<Value>(componentProps: RadioRoot.Props<Value>) {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): the `<span role="radio">` and
  // its hidden input rendered with direct JSX, registered with the group's composite list. A
  // `render` prop, spread props, a native `<button>`, the server and hydration keep the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    !untrack(() => componentProps.nativeButton)
  ) {
    return NativeRadioRoot(componentProps as RadioRoot.Props<unknown>);
  }

  const elementProps = omitComponentProps(componentProps, [
    'disabled',
    'readOnly',
    'required',
    'aria-labelledby',
    'value',
    'inputRef',
    'nativeButton',
    'id',
    'children',
  ] as const);
  const local = componentProps;
  const disabledProp = () => local.disabled ?? false;
  const readOnlyProp = () => local.readOnly ?? false;
  const requiredProp = () => local.required ?? false;
  const nativeButton = () => local.nativeButton ?? false;
  const idProp = () => local.id;

  const groupContext = useRadioGroupContext();

  const disabledGroup = () => groupContext?.disabled();
  const readOnlyGroup = () => groupContext?.readOnly();
  const requiredGroup = () => groupContext?.required();
  const formGroup = () => groupContext?.form();
  const touched = () => groupContext?.touched() ?? false;
  const validation = groupContext?.validation;
  const name = () => groupContext?.name();
  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setTouched = groupContext?.setTouched ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;

  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const labelableContext = useLabelableContext();
  const { labelId, getDescriptionProps } = labelableContext;

  const disabled = () =>
    Boolean(fieldDisabled() || fieldItemContext.disabled() || disabledGroup() || disabledProp());
  const readOnly = () => Boolean(readOnlyGroup() || readOnlyProp());
  const required = () => Boolean(requiredGroup() || requiredProp());
  const form = formGroup;

  const checked = () =>
    groupContext ? groupContext.checkedValue() === local.value : local.value === '';

  const radioRef = useRef<HTMLElement | null | undefined>(null);
  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  // Solid: the label fallback below reads the input reactively, as React re-runs it every commit.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null, {
    ownedWrite: true,
  });

  const registerFieldInput = validation?.registerInput;
  const registerInput = (element: HTMLInputElement) =>
    registerFieldInput?.(element, { controlRef: radioRef, value: undefined });

  // Solid: refs return no cleanup, so the merged ref's cleanups run when the radio unmounts.
  let inputRefCleanups: Array<void | (() => void)> = [];
  const mergedInputRef = (element: HTMLInputElement) => {
    const inputRefProp = untrack(() => local.inputRef);
    if (typeof inputRefProp === 'function') {
      inputRefProp(element);
    } else if (inputRefProp) {
      inputRefProp.current = element;
    }
    inputRef.current = element;
    setInputElement(element);
    inputRefCleanups = [registerInputRef(element), registerInput(element)];
  };
  onCleanup(() => {
    inputRefCleanups.forEach((cleanup) => cleanup?.());
    inputRefCleanups = [];
    const inputRefProp = untrack(() => local.inputRef);
    if (typeof inputRefProp === 'function') {
      inputRefProp(null);
    } else if (inputRefProp) {
      inputRefProp.current = null;
    }
  });

  onSettled(() => {
    if (inputRef.current?.checked) {
      setFilled(true);
    }
  });

  createEffect(
    () => ({ checked: checked(), disabled: disabled() }),
    (deps) => {
      if (!inputRef.current) {
        return;
      }

      if (deps.disabled && deps.checked) {
        registerInputRef(null);
        return;
      }

      registerInputRef(inputRef.current);
    },
  );

  const id = useBaseUiId();
  const inputId = useLabelableId({ id: idProp });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
  const ariaLabelledBy = useAriaLabelledBy(
    () => local['aria-labelledby'],
    labelId,
    inputElement,
    !untrack(nativeButton),
    hiddenInputId,
  );

  const rootProps: JSX.HTMLAttributes<HTMLSpanElement> = {
    role: 'radio',
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM as string]() {
      return checked() ? '' : undefined;
    },
    get id() {
      return nativeButton() ? inputId() : id();
    },
    onKeyDown(event) {
      if (event.key === 'Enter') {
        // Radio only activates with Space. Preventing the keydown's default
        // stops useButton from turning Enter into a click.
        event.preventDefault();
      }
    },
    onClick(event) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled() || readOnly() || !touched()) {
        return;
      }

      inputRef.current?.click();

      setTouched(false);
    },
  };

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
    composite: false,
  });

  const inputProps: JSX.InputHTMLAttributes<HTMLInputElement> = {
    type: 'radio',
    ref: mergedInputRef,
    get form() {
      return form();
    },
    get id() {
      return hiddenInputId();
    },
    get name() {
      return name();
    },
    tabindex: -1,
    get style() {
      return name() ? visuallyHiddenInput : visuallyHidden;
    },
    'aria-hidden': 'true',
    get value() {
      return local.value !== undefined ? serializeValue(local.value) : undefined;
    },
    get disabled() {
      return disabled();
    },
    get checked() {
      return checked();
    },
    get required() {
      return required();
    },
    get readonly() {
      return readOnly();
    },
    // Solid: React's radio `onChange` runs during the click (only when the radio becomes
    // checked), so it is handled here, where canceling the click also reverts the native change.
    onClick(event) {
      // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
      // implementation detail and must not reach ancestors.
      event.stopPropagation();

      // Workaround for https://github.com/facebook/react/issues/9023
      if (event.defaultPrevented || untrack(checked)) {
        return;
      }

      if (disabled() || readOnly() || local.value === undefined) {
        event.preventDefault();
        return;
      }

      const details = createChangeEventDetails(REASONS.none, event);

      setCheckedValue(local.value, details);

      if (details.isCanceled) {
        event.preventDefault();
        return;
      }

      setFieldTouched(true);
    },
    onFocus() {
      radioRef.current?.focus();
    },
  };

  const state: RadioRootState = solidMergeProps(fieldState, {
    get required() {
      return required();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get checked() {
      return checked();
    },
  });

  const contextValue: RadioRootContext = state;

  const isRadioGroup = groupContext != null;

  // Solid: the consumer's ref is read when applied, as `forwardedRef` is in React.
  const forwardedRef = (element: HTMLElement | null) => {
    const ref = untrack(() => componentProps.ref) as
      ((el: HTMLElement | null) => void) | ReactLikeRef<HTMLElement | null> | undefined;
    if (typeof ref === 'function') {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  };

  const refs = [radioRef, buttonRef];
  // Built once (plan 7 step 3.4): the button's handlers above the part's props (wrapping them, as
  // `getButtonProps` did). Its attributes go below every other source, the composite item's
  // roving `tabindex` included, as the consumer-side props overrode them in `getButtonProps`.
  const props = [
    rootProps,
    elementProps,
    buttonSources.handlers,
    ...(labelableContext === DEFAULT_LABELABLE_CONTEXT ? [] : [getDescriptionProps]),
    ...(validation
      ? [(validationProps: HTMLProps) => validation.getValidationProps(disabled(), validationProps)]
      : []),
  ];

  const element = useRenderElement('span', componentProps, {
    enabled: !isRadioGroup,
    state,
    ref: refs,
    props: [...buttonSources.attributes, ...props],
    stateAttributesMapping,
  });

  return (
    <RadioRootContext value={contextValue}>
      <Show when={isRadioGroup} fallback={element()}>
        <CompositeItem
          tag="span"
          render={componentProps.render}
          class={componentProps.class}
          state={state}
          refs={[forwardedRef, ...refs]}
          baseProps={buttonSources.attributes}
          props={props}
          stateAttributesMapping={stateAttributesMapping}
        >
          {local.children}
        </CompositeItem>
      </Show>
      <input {...inputProps} />
    </RadioRootContext>
  );
}

/** Props the native path reads once, as the slow path reads `nativeButton`. */
const NATIVE_STATIC_KEYS = ['nativeButton', 'inputRef'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: readonly string[] = [
  'disabled',
  'readOnly',
  'required',
  'aria-labelledby',
  'value',
  'inputRef',
  'nativeButton',
  'id',
];
const OWN_KEYS_SET: ReadonlySet<string> = new Set(OWN_KEYS);

/** What the native radio's handlers read when an event fires. */
interface NativeRadio {
  props: RadioRoot.Props<unknown>;
  input: HTMLInputElement;
  root: HTMLElement | null;
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  checked: Accessor<boolean>;
  touched: Accessor<boolean>;
  setTouched: (value: boolean) => void;
  setCheckedValue: (value: unknown, details: RadioChangeDetails) => void;
  setFieldTouched: (value: boolean) => void;
  composite: CompositeRootContext | null;
  registration: CompositeItemRegistration | undefined;
  required: Accessor<boolean>;
  field: ReturnType<typeof useFieldRootContext>;
  validationField: ReturnType<typeof useFieldRootContext>;
  labelable: ReturnType<typeof useLabelableContext>;
  labelId: Accessor<string | undefined>;
  inputId: Accessor<string | undefined>;
}

type RadioEvent<T extends Event> = BaseUIEvent<T>;

const ROOT_ATTRIBUTES = { role: 'radio' };
const HIDDEN_RADIO_INPUT = { type: 'radio', tabindex: '-1', 'aria-hidden': 'true' };

// Layout flags: what can never change for one element (written once) and the contexts present.
const DISABLED_STATIC = 1;
const READONLY_STATIC = 2;
const REQUIRED_STATIC = 4;
const LABELLEDBY_STATIC = 8;
const IN_FIELD = 16;
const IN_LABELABLE = 32;
const HAS_VALIDATION = 64;
const IN_LIST = 128;

type RadioLayout = NativeLayout<NativeRadio>;

/** The part's handler for a key the consumer also passes (the tuple reads the consumer itself). */
function wrapRadioHandler(key: string, model: NativeRadio): unknown {
  switch (key.toLowerCase()) {
    case 'onclick':
      return [rootClick, model];
    case 'onkeydown':
      return [rootKeyDown, model];
    case 'onkeyup':
      return [rootKeyUp, model];
    case 'onmousedown':
      return [rootMouseDown, model];
    case 'onpointerdown':
      return [rootPointerDown, model];
    case 'onfocus':
      return [rootFocus, model];
    case 'onmousemove':
      return model.registration ? [rootMouseMove, model] : undefined;
    default:
      return undefined;
  }
}

/**
 * The root's attributes, in the slow path's order (the button's, the composite item's, the
 * part's, the state's `data-*`, the consumer's, then `class`/`style`).
 */
function radioAttributes(l: RadioLayout, target: Record<string, unknown>, once: boolean) {
  const m = l.m;
  const f = l.flags;
  if (!once) {
    // The label fallback (after the apply) follows these: read them here so a change re-runs it.
    void l.props['aria-labelledby'];
    m.labelId();
    m.inputId();
  }
  if (once === Boolean(f & DISABLED_STATIC)) {
    const isDisabled = m.disabled();
    if (!(f & IN_LIST)) {
      put(l, target, once, 'tabindex', isDisabled ? -1 : 0);
    }
    put(l, target, once, 'aria-disabled', isDisabled ? 'true' : undefined);
    put(l, target, once, 'data-disabled', stateAttr(isDisabled));
  }
  if (!once && f & IN_LIST) {
    // `useCompositeItem`'s roving tab stop wins over the button's `tabindex`.
    put(l, target, false, 'tabindex', m.composite!.highlightedIndex() === m.registration!.index() ? 0 : -1);
  }
  const isChecked = once ? false : m.checked();
  if (!once) {
    put(l, target, false, 'aria-checked', isChecked ? 'true' : 'false');
  }
  if (once === Boolean(f & LABELLEDBY_STATIC)) {
    const explicit = l.props['aria-labelledby'];
    put(l, target, once, 'aria-labelledby', (typeof explicit === 'string' ? explicit : undefined) ?? m.labelId());
  }
  if (!once) {
    put(l, target, false, ACTIVE_COMPOSITE_ITEM, isChecked ? '' : undefined);
    if (f & IN_FIELD) {
      fieldStateAttributes(m.field.state, target);
    }
  }
  if (once === Boolean(f & REQUIRED_STATIC)) {
    put(l, target, once, 'data-required', stateAttr(m.required()));
  }
  if (once === Boolean(f & READONLY_STATIC)) {
    put(l, target, once, 'data-readonly', stateAttr(m.readOnly()));
  }
  if (once) {
    return target;
  }
  put(l, target, false, 'data-checked', isChecked ? '' : undefined);
  put(l, target, false, 'data-unchecked', isChecked ? undefined : '');
  if (f & (IN_LABELABLE | HAS_VALIDATION)) {
    fieldAttributes(m.labelable, m.validationField, m.disabled(), l.props, target);
  }
  return finishAttributes(l, target);
}

/** The part's handlers for the keys the consumer does not pass. */
function radioHandlers(l: RadioLayout, literal: Record<string, unknown>) {
  const m = l.m;
  if (!consumerHas(l, 'onClick')) {
    literal.onClick = [rootClick, m];
  }
  if (!consumerHas(l, 'onKeyDown')) {
    literal.onKeyDown = [rootKeyDown, m];
  }
  if (!consumerHas(l, 'onKeyUp')) {
    literal.onKeyUp = [rootKeyUp, m];
  }
  if (!consumerHas(l, 'onMouseDown')) {
    literal.onMouseDown = [rootMouseDown, m];
  }
  if (!consumerHas(l, 'onPointerDown')) {
    literal.onPointerDown = [rootPointerDown, m];
  }
  if (!consumerHas(l, 'onFocus')) {
    literal.onFocus = [rootFocus, m];
  }
  if (m.registration && !consumerHas(l, 'onMouseMove')) {
    literal.onMouseMove = [rootMouseMove, m];
  }
}
type RadioChangeDetails = ReturnType<typeof createChangeEventDetails<typeof REASONS.none>>;

// The root's handlers, shared by every native radio and bound per element with Solid's
// `[handler, data]` form: `useButton`'s gates (non-native, `composite: false`) around the
// consumer's handler (first, as React's `mergeProps`), then the part's logic, then
// `useCompositeItem`'s (lowest priority).
function rootClick(m: NativeRadio, event: MouseEvent) {
  makeEventPreventable(event as RadioEvent<MouseEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  if (runConsumerHandler(m.props, 'onClick', event as RadioEvent<MouseEvent>)) {
    return;
  }
  if (event.defaultPrevented || m.readOnly()) {
    return;
  }
  event.preventDefault();
  dispatchClickWithModifiers(m.input, event);
}
function rootKeyDown(m: NativeRadio, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as RadioEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyDown', baseUIEvent)) {
    return;
  }
  if (event.key === 'Enter') {
    // Radio only activates with Space. Preventing the keydown's default
    // stops useButton from turning Enter into a click.
    event.preventDefault();
  }
  // `useButton` after the consumer (non-native, non-composite): Space must not scroll the page.
  if (event.target === event.currentTarget && event.key === ' ' && !event.defaultPrevented) {
    event.preventDefault();
  }
}
function rootKeyUp(m: NativeRadio, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as RadioEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyUp', baseUIEvent)) {
    return;
  }
  if (event.target === event.currentTarget && !event.defaultPrevented && event.key === ' ') {
    baseUIEvent.preventBaseUIHandler();
    dispatchClickWithModifiers(event.currentTarget as Element, event);
  }
}
function rootMouseDown(m: NativeRadio, event: MouseEvent) {
  makeEventPreventable(event as RadioEvent<MouseEvent>);
  if (!m.disabled()) {
    runConsumerHandler(m.props, 'onMouseDown', event as RadioEvent<MouseEvent>);
  }
}
function rootPointerDown(m: NativeRadio, event: PointerEvent) {
  makeEventPreventable(event as RadioEvent<PointerEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  runConsumerHandler(m.props, 'onPointerDown', event as RadioEvent<PointerEvent>);
}
function rootFocus(m: NativeRadio, event: FocusEvent) {
  makeEventPreventable(event as RadioEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onFocus', event as RadioEvent<FocusEvent>)) {
    return;
  }
  if (!event.defaultPrevented && !m.disabled() && !m.readOnly() && m.touched()) {
    m.input.click();
    m.setTouched(false);
  }
  if (m.composite && m.registration) {
    m.composite.onHighlightedIndexChange(m.registration.index());
  }
}
function rootMouseMove(m: NativeRadio, event: MouseEvent) {
  makeEventPreventable(event as RadioEvent<MouseEvent>);
  if (runConsumerHandler(m.props, 'onMouseMove', event as RadioEvent<MouseEvent>)) {
    return;
  }
  const el = m.root;
  if (!m.composite || !m.registration || !m.composite.highlightItemOnHover() || !el) {
    return;
  }
  const disabled = el.hasAttribute('disabled') || el.ariaDisabled === 'true';
  if (m.composite.highlightedIndex() !== m.registration.index() && !disabled) {
    el.focus();
  }
}
// Solid: React's radio `onChange` runs during the click (only when the radio becomes
// checked), so it is handled here, where canceling the click also reverts the native change.
function inputClick(m: NativeRadio, event: MouseEvent) {
  // Clicks dispatched on the input from the root's `onClick` and `onFocus` are an
  // implementation detail and must not reach ancestors.
  event.stopPropagation();

  // Workaround for https://github.com/facebook/react/issues/9023
  if (event.defaultPrevented || untrack(m.checked)) {
    return;
  }
  const value = m.props.value;
  if (m.disabled() || m.readOnly() || value === undefined) {
    event.preventDefault();
    return;
  }
  const details = createChangeEventDetails(REASONS.none, event);
  m.setCheckedValue(value, details as never);
  if (details.isCanceled) {
    event.preventDefault();
    return;
  }
  m.setFieldTouched(true);
}
function inputFocus(m: NativeRadio) {
  m.root?.focus();
}

/**
 * The native radio: the slow path's hooks (group and Field registration, label association)
 * with the root and the hidden input rendered directly; inside a `RadioGroup` the root registers
 * with the group's composite list (roving tab stop).
 */
function NativeRadioRoot(props: RadioRoot.Props<unknown>): JSX.Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const groupContext = useRadioGroupContext();
  const composite = groupContext ? useCompositeRootContext(true) : null;
  const fieldRootContext = useFieldRootContext();
  const inField = fieldRootContext !== DEFAULT_FIELD_ROOT_CONTEXT;
  const fieldItemContext = useFieldItemContext();
  const inFieldItem = fieldItemContext !== DEFAULT_FIELD_ITEM_CONTEXT;
  const labelableContext = useLabelableContext();
  const inLabelable = labelableContext !== DEFAULT_LABELABLE_CONTEXT;
  const { labelId } = labelableContext;
  const fieldState = fieldRootContext.state;
  const validation = groupContext?.validation;
  // The validation props come through the group (its Field); a radio alone gets none.
  const validationField = groupContext ? fieldRootContext : DEFAULT_FIELD_ROOT_CONTEXT;

  const disabled = () =>
    Boolean(
      fieldRootContext.disabled() ||
        fieldItemContext.disabled() ||
        groupContext?.disabled() ||
        props.disabled,
    );
  const readOnly = () => Boolean(groupContext?.readOnly() || props.readOnly);
  const required = () => Boolean(groupContext?.required() || props.required);
  const name = () => groupContext?.name();
  const checked = () =>
    groupContext ? groupContext.checkedValue() === props.value : props.value === '';
  const touched = () => groupContext?.touched() ?? false;

  const id = useBaseUiId();
  const inputId = useLabelableId({ id: () => props.id });

  const radioRef = useRef<HTMLElement | null | undefined>(null);

  // The hidden input: literal attributes from the template, the rest in one render effect.
  const input = createNativeElement('input', HIDDEN_RADIO_INPUT);
  const inputAttributes = (): Record<string, unknown> => {
    const target: Record<string, unknown> = {
      form: groupContext?.form(),
      id: inputId(),
      name: name(),
      style: name() ? visuallyHiddenInput : visuallyHidden,
      value: props.value !== undefined ? serializeValue(props.value) : undefined,
      disabled: disabled(),
      checked: checked(),
      required: required(),
      readonly: readOnly(),
    };
    return target;
  };
  const inputRefProp = props.inputRef;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;
  // Solid: refs return no cleanup, so the merged ref's cleanups run when the radio unmounts.
  let inputRefCleanups: Array<void | (() => void)> = [];
  const previousInput: Record<string, unknown> = {};
  let registered = false;
  createRenderEffect(inputAttributes, (attributes) => {
    assign(input, attributes, true, previousInput, true);
    if (!registered) {
      // As the slow path's ref: the group reads the input's `checked`/`disabled` when it registers.
      registered = true;
      if (typeof inputRefProp === 'function') {
        inputRefProp(input);
      } else if (inputRefProp) {
        inputRefProp.current = input;
      }
      inputRefCleanups = [
        registerInputRef(input),
        validation?.registerInput(input, { controlRef: radioRef, value: undefined }),
      ];
    }
  });
  onCleanup(() => {
    inputRefCleanups.forEach((cleanup) => cleanup?.());
    if (typeof inputRefProp === 'function') {
      inputRefProp(null);
    } else if (inputRefProp) {
      inputRefProp.current = null;
    }
  });

  if (inField) {
    onSettled(() => {
      if (input.checked) {
        fieldRootContext.setFilled(true);
      }
    });
  }
  if (groupContext) {
    createEffect(
      () => ({ checked: checked(), disabled: disabled() }),
      (deps) => {
        if (deps.disabled && deps.checked) {
          registerInputRef(null);
          return;
        }
        registerInputRef(input);
      },
    );
  }

  const state: RadioRootState = {
    get disabled() {
      return disabled();
    },
    get touched() {
      return fieldState.touched;
    },
    get dirty() {
      return fieldState.dirty;
    },
    get valid() {
      return fieldState.valid;
    },
    get filled() {
      return fieldState.filled;
    },
    get focused() {
      return fieldState.focused;
    },
    get required() {
      return required();
    },
    get readOnly() {
      return readOnly();
    },
    get checked() {
      return checked();
    },
  };

  const registration = composite ? createCompositeItemRegistration() : undefined;
  const model: NativeRadio = {
    props,
    input,
    root: null,
    disabled,
    readOnly,
    checked,
    touched,
    setTouched: groupContext?.setTouched ?? NOOP,
    setCheckedValue: groupContext?.setCheckedValue ?? NOOP,
    setFieldTouched: fieldRootContext.setTouched,
    composite,
    registration,
    required,
    field: fieldRootContext,
    validationField,
    labelable: labelableContext,
    labelId,
    inputId,
  };
  assign(input, { onClick: [inputClick, model], onFocus: [inputFocus, model] }, true, {}, true);

  // The root element and its children are created inside the context provider (children read it).
  return provideContext(RadioRootContext, state, () => {
    const owner = getOwner();
    const fieldKeys = fieldOwnedKeys(labelableContext, validationField);
    const own = fieldKeys.length ? new Set([...OWN_KEYS, ...fieldKeys]) : OWN_KEYS_SET;
    const l = createLayout(props, own, model, state, (key) => wrapRadioHandler(key, model));
    const staticProp = (key: string) => !(key in props) || isStatic(props, key);
    l.flags =
      (staticProp('disabled') && !inField && !inFieldItem && groupContext == null ? DISABLED_STATIC : 0) |
      (staticProp('readOnly') && groupContext == null ? READONLY_STATIC : 0) |
      (staticProp('required') && groupContext == null ? REQUIRED_STATIC : 0) |
      (staticProp('aria-labelledby') && !inLabelable ? LABELLEDBY_STATIC : 0) |
      (inField ? IN_FIELD : 0) |
      (inLabelable ? IN_LABELABLE : 0) |
      (validationField !== DEFAULT_FIELD_ROOT_CONTEXT ? HAS_VALIDATION : 0) |
      (registration ? IN_LIST : 0);

    const literal: Record<string, unknown> = { id: id() };
    radioAttributes(l, literal, true);
    literalClassStyle(l, literal);
    radioHandlers(l, literal);
    if (l.hasKeys) {
      Object.assign(literal, l.consumerLiteral);
    }
    const dynamic = () => radioAttributes(l, {}, false);

    const el = createNativeElement('span', ROOT_ATTRIBUTES);
    model.root = el;
    // `useAriaLabelledBy`'s DOM label fallback runs after each attribute apply (the attribute
    // effect reads the prop, the Field label id and the control id); the first time once mounted.
    attachNativeAttributes(
      el,
      literal,
      dynamic,
      owner,
      createLabelFallback(el, input, () => props['aria-labelledby'], labelId, inputId),
      elementRefs(el, registration ? [radioRef, registration.attach] : [radioRef], props.ref),
    );
    if ('children' in props) {
      if (isStatic(props, 'children')) {
        insert(el, props.children);
      } else {
        insert(el, () => props.children);
      }
    }
    return [el, input] as unknown as JSX.Element;
  });
}

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRootState>, 'value'> {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?:
    | ReactLikeRef<HTMLInputElement | null | undefined>
    | ((el: HTMLInputElement | null) => void)
    | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
