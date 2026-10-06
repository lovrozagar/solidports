import {
  createMemo,
  createRenderEffect,
  createSignal,
  getOwner,
  isStatic,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import { assign, insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { DEFAULT_LABELABLE_CONTEXT } from '../../internals/labelable-provider/LabelableContext';
import { makeEventPreventable } from '../../merge-props';
import { NOOP } from '../../utils/noop';
import type { BaseUIEvent } from '../../utils/types';
import {
  attachNativeAttributes,
  canRenderNative,
  createNativeElement,
  elementRefs,
  consumerHas,
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
  type NativeLayout,
} from '../../utils/native';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext, DEFAULT_FIELD_ROOT_CONTEXT } from '../../field/root/FieldRootContext';
import { useFormContext } from '../../form/FormContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useButton } from '../../internals/use-button';
import { useValueChanged } from '../../internals/useValueChanged';
import { mergeProps } from '../../merge-props';
import { provideContext, splitComponentProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../types';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { SwitchRootContext } from './SwitchRootContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchRoot(componentProps: SwitchRoot.Props) {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): the `<span role="switch">` and
  // its hidden input rendered with direct JSX. A `render` prop, spread props, a native `<button>`
  // (`nativeButton`), the server and hydration keep the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    !untrack(() => componentProps.nativeButton)
  ) {
    return NativeSwitchRoot(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'checked',
    'defaultChecked',
    'aria-labelledby',
    'form',
    'id',
    'inputRef',
    'name',
    'nativeButton',
    'onCheckedChange',
    'readOnly',
    'required',
    'disabled',
    'uncheckedValue',
    'value',
  ]);
  const checkedProp = () => local.checked;
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const form = () => local.form;
  const idProp = () => local.id;
  const nameProp = () => local.name;
  const nativeButton = () => local.nativeButton ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const disabledProp = () => local.disabled ?? false;

  const { clearErrors } = useFormContext();
  const fieldRootContext = useFieldRootContext();
  const {
    state: fieldState,
    setTouched,
    registerDirtySource,
    setDirty,
    validityData,
    registerFilledSource,
    setFocused,
    validationMode,
    disabled: fieldDisabled,
    name: fieldName,
    validation,
  } = fieldRootContext;
  const { labelId } = useLabelableContext();

  const disabled = () => Boolean(fieldDisabled() || disabledProp());
  const name = () => fieldName() ?? nameProp();

  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  // Solid: the label fallback below reads the input reactively, as React re-runs it every commit.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null, {
    ownedWrite: true,
  });
  const handleInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
    setInputElement(element);
    validation.inputRef.current = element;
    const externalInputRef = untrack(() => local.inputRef);
    if (externalInputRef) {
      externalInputRef.current = element;
    }
  };

  const switchRef = useRef<HTMLElement | null | undefined>(null);

  const id = useBaseUiId();

  const controlId = useLabelableId({ id: idProp });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const [checked, setCheckedState] = useControlled({
    controlled: checkedProp,
    default: () => Boolean(local.defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  useRegisterFieldControl(switchRef, id, checked, undefined, () => !disabled(), nameProp);

  // React sets `filled` from a layout effect; the field derives it from this source.
  registerFilledSource(checked);

  // React sets `dirty` from a layout effect when the value changes; the field derives it.
  registerDirtySource(() => checked() !== validityData.initialValue);

  useValueChanged(checked, () => {
    const value = untrack(checked);
    clearErrors(untrack(name));
    setDirty(value !== validityData.initialValue);

    validation.change(value);
  });

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputElement,
    !untrack(nativeButton),
    hiddenInputId,
  );

  const rootProps: JSX.HTMLAttributes<HTMLSpanElement> = {
    get id() {
      return nativeButton() ? controlId() : id();
    },
    role: 'switch',
    get 'aria-checked'() {
      return checked() ? 'true' : 'false';
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    onFocus() {
      if (!disabled()) {
        setFocused(true);
      }
    },
    onBlur() {
      const element = inputRef.current;
      if (!element || disabled()) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(element.checked);
      }
    },
    onClick(event) {
      if (readOnly() || disabled()) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
  };

  // Rebuilt when its sources change, as React merges these props every render.
  const inputProps = createMemo(() =>
    mergeProps<'input'>(validation.getValidationProps(disabled()), {
      get checked() {
        return checked();
      },
      get disabled() {
        return disabled();
      },
      get form() {
        return form();
      },
      get id() {
        return hiddenInputId();
      },
      get name() {
        return name();
      },
      get required() {
        return required();
      },
      get style() {
        return name() ? visuallyHiddenInput : visuallyHidden;
      },
      tabindex: -1,
      type: 'checkbox',
      'aria-hidden': 'true',
      ref: handleInputRef,
      // Solid: React's checkbox `onChange` runs during the click, so it is handled here, where
      // canceling the click also reverts the native toggle.
      onClick(event) {
        // The click dispatched from the root's `onClick` is an implementation detail
        // and must not reach ancestors, which already receive the original click.
        event.stopPropagation();

        // Workaround for https://github.com/facebook/react/issues/9023
        if (event.defaultPrevented) {
          return;
        }

        if (readOnly()) {
          event.preventDefault();
          return;
        }

        const nextChecked = event.currentTarget.checked;
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        local.onCheckedChange?.(nextChecked, eventDetails);

        if (eventDetails.isCanceled) {
          event.preventDefault();
          return;
        }

        setCheckedState(nextChecked);
      },
      onFocus() {
        switchRef.current?.focus();
      },
      // Only set `value` when defined: Solid writes `undefined` to an input's `value` as ''.
      ...(local.value !== undefined ? { value: local.value } : EMPTY_OBJECT),
    }),
  );

  const state: SwitchRootState = solidMergeProps(fieldState, {
    get checked() {
      return checked();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
  });

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [switchRef, buttonRef],
    get props() {
      return [
        ...buttonSources.attributes,
        rootProps,
        elementProps,
        buttonSources.handlers,
        // Outside a Field the validation props only return their input.
        ...(fieldRootContext === DEFAULT_FIELD_ROOT_CONTEXT
          ? []
          : [(props: HTMLProps) => validation.getValidationProps(disabled(), props)]),
      ];
    },
    stateAttributesMapping,
  });

  return (
    <SwitchRootContext value={state}>
      {element()}
      {!checked() && name() && local.uncheckedValue !== undefined && (
        <input
          type="hidden"
          form={form()}
          name={name()}
          value={local.uncheckedValue}
          disabled={disabled()}
        />
      )}
      <input {...(inputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)} />
    </SwitchRootContext>
  );
}

/** Props the native path reads once, as the slow path reads `nativeButton`. */
const NATIVE_STATIC_KEYS = ['nativeButton', 'inputRef'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: readonly string[] = [
  'checked',
  'defaultChecked',
  'aria-labelledby',
  'form',
  'id',
  'inputRef',
  'name',
  'nativeButton',
  'onCheckedChange',
  'readOnly',
  'required',
  'disabled',
  'uncheckedValue',
  'value',
];
const OWN_KEYS_SET: ReadonlySet<string> = new Set(OWN_KEYS);

/** What the native switch's handlers read when an event fires. */
interface NativeSwitch {
  props: SwitchRoot.Props;
  input: HTMLInputElement;
  root: HTMLElement | null;
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  checked: Accessor<boolean>;
  setCheckedState: (value: boolean) => void;
  field: ReturnType<typeof useFieldRootContext>;
  labelable: ReturnType<typeof useLabelableContext>;
  labelId: Accessor<string | undefined>;
  controlId: Accessor<string | undefined>;
}

type SwitchEvent<T extends Event> = BaseUIEvent<T>;

const ROOT_ATTRIBUTES = { role: 'switch' };
const HIDDEN_CHECKBOX_INPUT = { type: 'checkbox', tabindex: '-1', 'aria-hidden': 'true' };

// Layout flags: what can never change for one element (written once) and the contexts present.
const DISABLED_STATIC = 1;
const READONLY_STATIC = 2;
const REQUIRED_STATIC = 4;
const LABELLEDBY_STATIC = 8;
const IN_FIELD = 16;
const IN_LABELABLE = 32;

type SwitchLayout = NativeLayout<NativeSwitch>;

/** The part's handler for a key the consumer also passes (the tuple reads the consumer itself). */
function wrapSwitchHandler(key: string, model: NativeSwitch): unknown {
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
    case 'onblur':
      return [rootBlur, model];
    default:
      return undefined;
  }
}

/**
 * The root's attributes, in the slow path's order (the button's, the part's, the state's
 * `data-*`, the consumer's, then `class`/`style`): the literal pass (`once`) writes what can
 * never change; the dynamic pass (one render effect) the rest.
 */
function switchAttributes(l: SwitchLayout, target: Record<string, unknown>, once: boolean) {
  const m = l.m;
  const f = l.flags;
  if (!once) {
    // The label fallback (after the apply) follows these: read them here so a change re-runs it.
    void l.props['aria-labelledby'];
    m.labelId();
    m.controlId();
  }
  if (once === Boolean(f & DISABLED_STATIC)) {
    const isDisabled = m.disabled();
    put(l, target, once, 'tabindex', isDisabled ? -1 : 0);
    put(l, target, once, 'aria-disabled', isDisabled ? 'true' : undefined);
    put(l, target, once, 'data-disabled', stateAttr(isDisabled));
  }
  if (!once) {
    put(l, target, once, 'aria-checked', m.checked() ? 'true' : 'false');
  }
  if (once === Boolean(f & READONLY_STATIC)) {
    const isReadOnly = m.readOnly();
    put(l, target, once, 'aria-readonly', isReadOnly ? 'true' : undefined);
    put(l, target, once, 'data-readonly', stateAttr(isReadOnly));
  }
  if (once === Boolean(f & REQUIRED_STATIC)) {
    const isRequired = m.required();
    put(l, target, once, 'aria-required', isRequired ? 'true' : undefined);
    put(l, target, once, 'data-required', stateAttr(isRequired));
  }
  if (once === Boolean(f & LABELLEDBY_STATIC)) {
    const explicit = l.props['aria-labelledby'];
    put(l, target, once, 'aria-labelledby', (typeof explicit === 'string' ? explicit : undefined) ?? m.labelId());
  }
  if (once) {
    return target;
  }
  if (f & IN_FIELD) {
    fieldStateAttributes(m.field.state, target);
  }
  const isChecked = m.checked();
  put(l, target, false, 'data-checked', isChecked ? '' : undefined);
  put(l, target, false, 'data-unchecked', isChecked ? undefined : '');
  if (f & (IN_FIELD | IN_LABELABLE)) {
    fieldAttributes(m.labelable, m.field, m.disabled(), l.props, target);
  }
  return finishAttributes(l, target);
}

/** The part's handlers for the keys the consumer does not pass. */
function switchHandlers(l: SwitchLayout, literal: Record<string, unknown>) {
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
  // Focus/blur only matter to a Field (touched/focused/validation on blur).
  if (l.flags & IN_FIELD) {
    if (!consumerHas(l, 'onFocus')) {
      literal.onFocus = [rootFocus, m];
    }
    if (!consumerHas(l, 'onBlur')) {
      literal.onBlur = [rootBlur, m];
    }
  }
}

// The root's handlers, shared by every native switch and bound per element with Solid's
// `[handler, data]` form: `useButton`'s gates (non-native, non-composite) around the consumer's
// handler (first, as React's `mergeProps`), then the part's logic and `useButton`'s keyboard
// activation after the consumer.
function rootClick(m: NativeSwitch, event: MouseEvent) {
  makeEventPreventable(event as SwitchEvent<MouseEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  if (runConsumerHandler(m.props, 'onClick', event as SwitchEvent<MouseEvent>)) {
    return;
  }
  if (m.readOnly()) {
    return;
  }
  event.preventDefault();
  dispatchClickWithModifiers(m.input, event);
}
function rootKeyDown(m: NativeSwitch, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as SwitchEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyDown', baseUIEvent)) {
    return;
  }
  // `useButton` after the consumer (non-native, non-composite): Space and Enter are the
  // button's keys; Enter activates on keydown, Space on keyup.
  if (event.target !== event.currentTarget || (event.key !== ' ' && event.key !== 'Enter')) {
    return;
  }
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  if (event.key === 'Enter') {
    baseUIEvent.preventBaseUIHandler();
    dispatchClickWithModifiers(event.currentTarget as Element, event);
  }
}
function rootKeyUp(m: NativeSwitch, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as SwitchEvent<KeyboardEvent>);
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
function rootMouseDown(m: NativeSwitch, event: MouseEvent) {
  makeEventPreventable(event as SwitchEvent<MouseEvent>);
  if (!m.disabled()) {
    runConsumerHandler(m.props, 'onMouseDown', event as SwitchEvent<MouseEvent>);
  }
}
function rootPointerDown(m: NativeSwitch, event: PointerEvent) {
  makeEventPreventable(event as SwitchEvent<PointerEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  runConsumerHandler(m.props, 'onPointerDown', event as SwitchEvent<PointerEvent>);
}
function rootFocus(m: NativeSwitch, event: FocusEvent) {
  makeEventPreventable(event as SwitchEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onFocus', event as SwitchEvent<FocusEvent>)) {
    return;
  }
  if (!m.disabled()) {
    m.field.setFocused(true);
  }
}
function rootBlur(m: NativeSwitch, event: FocusEvent) {
  makeEventPreventable(event as SwitchEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onBlur', event as SwitchEvent<FocusEvent>)) {
    return;
  }
  if (m.disabled()) {
    return;
  }
  m.field.setTouched(true);
  m.field.setFocused(false);
  if (untrack(m.field.validationMode) === 'onBlur') {
    m.field.validation.commit(m.input.checked);
  }
}
// Solid: React's checkbox `onChange` runs during the click, so it is handled here, where
// canceling the click also reverts the native toggle.
function inputClick(m: NativeSwitch, event: MouseEvent) {
  // The click dispatched from the root's `onClick` is an implementation detail
  // and must not reach ancestors, which already receive the original click.
  event.stopPropagation();

  // Workaround for https://github.com/facebook/react/issues/9023
  if (event.defaultPrevented) {
    return;
  }
  if (m.readOnly()) {
    event.preventDefault();
    return;
  }
  const nextChecked = (event.currentTarget as HTMLInputElement).checked;
  const eventDetails = createChangeEventDetails(REASONS.none, event);
  m.props.onCheckedChange?.(nextChecked, eventDetails);
  if (eventDetails.isCanceled) {
    event.preventDefault();
    return;
  }
  m.setCheckedState(nextChecked);
}
function inputFocus(m: NativeSwitch) {
  m.root?.focus();
}

/**
 * The native switch: the slow path's hooks (controlled state, Field/labelable registration) with
 * the root and the hidden input rendered directly. Attributes that can never change are written
 * once; the rest share one render effect per element.
 */
function NativeSwitchRoot(props: SwitchRoot.Props): JSX.Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const { clearErrors } = useFormContext();
  const fieldRootContext = useFieldRootContext();
  const inField = fieldRootContext !== DEFAULT_FIELD_ROOT_CONTEXT;
  const labelableContext = useLabelableContext();
  const inLabelable = labelableContext !== DEFAULT_LABELABLE_CONTEXT;
  const { labelId } = labelableContext;
  const { validation, validityData } = fieldRootContext;
  const fieldState = fieldRootContext.state;

  const disabled = () => Boolean(fieldRootContext.disabled() || props.disabled);
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const name = () => fieldRootContext.name() ?? props.name;

  const id = useBaseUiId();
  const controlId = useLabelableId({ id: () => props.id });

  const [checked, setCheckedState] = useControlled({
    controlled: () => props.checked,
    default: () => Boolean(props.defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  const switchRef = useRef<HTMLElement | null | undefined>(null);
  useRegisterFieldControl(switchRef, id, checked, undefined, () => !disabled(), () => props.name);
  // React sets `filled` and `dirty` from layout effects when the value changes; the field derives them.
  fieldRootContext.registerFilledSource(checked);
  fieldRootContext.registerDirtySource(() => checked() !== validityData.initialValue);
  // Outside a Field and a Form the change effect has nothing to do (every call is a no-op).
  if (inField || clearErrors !== NOOP) {
    useValueChanged(checked, () => {
      const value = untrack(checked);
      clearErrors(untrack(name));
      fieldRootContext.setDirty(value !== validityData.initialValue);
      validation.change(value);
    });
  }

  // The hidden input: literal attributes from the template, the rest in one render effect.
  const input = createNativeElement('input', HIDDEN_CHECKBOX_INPUT);
  const hasValue = 'value' in props;
  const inputAttributes = (): Record<string, unknown> => {
    const target: Record<string, unknown> = {};
    if (inField || inLabelable) {
      fieldAttributes(labelableContext, fieldRootContext, disabled(), undefined, target);
    }
    target.checked = checked();
    target.disabled = disabled();
    target.form = props.form;
    target.id = controlId();
    target.name = name();
    target.required = required();
    target.style = name() ? visuallyHiddenInput : visuallyHidden;
    if (hasValue && props.value !== undefined) {
      // Only set `value` when defined: Solid writes `undefined` to an input's `value` as ''.
      target.value = props.value;
    }
    return target;
  };
  const previousInput: Record<string, unknown> = {};
  createRenderEffect(inputAttributes, (attributes) => {
    assign(input, attributes, true, previousInput, true);
  });
  const inputRef = useRef<HTMLInputElement | null | undefined>(input);
  validation.inputRef.current = input;
  const externalInputRef = props.inputRef;
  if (externalInputRef) {
    externalInputRef.current = input;
  }

  const state: SwitchRootState = {
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
    get checked() {
      return checked();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
  };

  const model: NativeSwitch = {
    props,
    input,
    root: null,
    disabled,
    readOnly,
    required,
    checked,
    setCheckedState,
    field: fieldRootContext,
    labelable: labelableContext,
    labelId,
    controlId,
  };
  assign(input, { onClick: [inputClick, model], onFocus: [inputFocus, model] }, true, {}, true);

  // The root element and its children are created inside the context provider (children read it).
  return provideContext(SwitchRootContext, state, () => {
    const owner = getOwner();
    const fieldKeys = fieldOwnedKeys(labelableContext, fieldRootContext);
    const own = fieldKeys.length ? new Set([...OWN_KEYS, ...fieldKeys]) : OWN_KEYS_SET;
    const l = createLayout(props, own, model, state, (key) => wrapSwitchHandler(key, model));
    const staticProp = (key: string) => !(key in props) || isStatic(props, key);
    // What can never change: a prop that is a literal and no context that could flip it.
    l.flags =
      (staticProp('disabled') && !inField ? DISABLED_STATIC : 0) |
      (staticProp('readOnly') ? READONLY_STATIC : 0) |
      (staticProp('required') ? REQUIRED_STATIC : 0) |
      (staticProp('aria-labelledby') && !inLabelable ? LABELLEDBY_STATIC : 0) |
      (inField ? IN_FIELD : 0) |
      (inLabelable ? IN_LABELABLE : 0);

    const literal: Record<string, unknown> = { id: id() };
    switchAttributes(l, literal, true);
    literalClassStyle(l, literal);
    switchHandlers(l, literal);
    if (l.hasKeys) {
      Object.assign(literal, l.consumerLiteral);
    }
    const dynamic = () => switchAttributes(l, {}, false);

    const el = createNativeElement('span', ROOT_ATTRIBUTES);
    model.root = el;
    // `useAriaLabelledBy`'s DOM label fallback runs after each attribute apply (the attribute
    // effect reads the prop, the Field label id and the control id); the first time once mounted.
    attachNativeAttributes(
      el,
      literal,
      dynamic,
      owner,
      createLabelFallback(el, input, () => props['aria-labelledby'], labelId, controlId),
      elementRefs(el, [switchRef], props.ref),
    );
    if (isStatic(props, 'children')) {
      insert(el, props.children);
    } else {
      insert(el, () => props.children);
    }

    const nodes: JSX.Element[] = [el];
    if ('uncheckedValue' in props) {
      nodes.push(
        <Show when={!checked() && name() && props.uncheckedValue !== undefined}>
          <input
            type="hidden"
            form={props.form}
            name={name()}
            value={props.uncheckedValue}
            disabled={disabled()}
          />
        </Show>,
      );
    }
    nodes.push(input);
    return nodes;
  });
}

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: ReactLikeRef<HTMLInputElement | null | undefined> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
