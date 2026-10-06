import { getOwner, isStatic, Show } from 'solid-js';
import { insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import {
  attachNativeAttributes,
  canRenderNative,
  createNativeElement,
  elementRefs,
  classifyConsumerProps,
  fieldStateAttributes,
  resolveClass,
  resolveStyle,
  stateAttr,
} from '../../utils/native';
import { useFieldRootContext, DEFAULT_FIELD_ROOT_CONTEXT } from '../../field/root/FieldRootContext';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { useRenderElement } from '../../utils/useRenderElement';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import type { BaseUIComponentProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxIndicator(componentProps: CheckboxIndicator.Props) {
  // Solid-native fast path (plan 8): the `<span>` with its state attributes rendered directly;
  // no props split and no merged state proxy (the native element reads the state by key).
  const native = canRenderNative(componentProps);
  const keepMounted = () => componentProps.keepMounted ?? false;

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked || rootState.indeterminate;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const indicatorRef = useRef<HTMLSpanElement | null | undefined>(null);

  const state: CheckboxIndicatorState = native
    ? (Object.create(rootState, {
        transitionStatus: { enumerable: true, get: () => transitionStatus() },
      }) as CheckboxIndicatorState)
    : solidMergeProps(rootState, {
        get transitionStatus() {
          return transitionStatus();
        },
      });

  useOpenChangeComplete({
    batch: true,
    enabled: () => !rendered(),
    open: rendered,
    ref: () => indicatorRef.current,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const baseStateAttributesMapping = getCheckboxStateAttributesMapping(rootState);

  const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
    ...baseStateAttributesMapping,
    ...transitionStatusMapping,
  };

  const shouldRender = () => keepMounted() || mounted();

  if (native) {
    const inField = useFieldRootContext() !== DEFAULT_FIELD_ROOT_CONTEXT;
    return (
      <Show when={shouldRender()}>
        {NativeIndicator(componentProps, state, indicatorRef, inField)}
      </Show>
    );
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['keepMounted']);
  const element = useRenderElement('span', componentProps, {
    ref: indicatorRef,
    state,
    stateAttributesMapping,
    props: elementProps,
  });

  return <Show when={shouldRender()}>{element()}</Show>;
}

const OWN_KEYS: ReadonlySet<string> = new Set(['keepMounted']);

/**
 * The indicator's element: `data-*` from the checkbox state (`data-checked`/`data-unchecked`
 * unless indeterminate, the transition hooks, the Field validity) and the consumer's props, in one
 * render effect; literal consumer props and the part's ref are applied once.
 */
function NativeIndicator(
  props: CheckboxIndicator.Props,
  state: CheckboxIndicatorState,
  indicatorRef: { current: HTMLSpanElement | null | undefined },
  inField: boolean,
): JSX.Element {
  const owner = getOwner();
  const consumer = classifyConsumerProps(props, OWN_KEYS);
  const keys = consumer.keys;
  const set = (target: Record<string, unknown>, key: string, value: unknown) => {
    if (!keys.has(key)) {
      target[key] = value;
    }
  };
  const dynamic = (): Record<string, unknown> => {
    const target: Record<string, unknown> = {};
    const isIndeterminate = state.indeterminate;
    const isChecked = state.checked;
    set(target, 'data-disabled', stateAttr(state.disabled));
    if (inField) {
      fieldStateAttributes(state, target);
    }
    set(target, 'data-checked', !isIndeterminate && isChecked ? '' : undefined);
    set(target, 'data-unchecked', !isIndeterminate && !isChecked ? '' : undefined);
    set(target, 'data-readonly', stateAttr(state.readOnly));
    set(target, 'data-required', stateAttr(state.required));
    set(target, 'data-indeterminate', stateAttr(isIndeterminate));
    const status = state.transitionStatus;
    set(target, 'data-starting-style', status === 'starting' ? '' : undefined);
    set(target, 'data-ending-style', status === 'ending' ? '' : undefined);
    for (const key of consumer.reactive) {
      target[key] = (props as Record<string, unknown>)[key];
    }
    if ('class' in props) {
      target.class = resolveClass(props.class, state);
    }
    if ('style' in props) {
      target.style = resolveStyle(props.style, state);
    }
    return target;
  };
  const el = createNativeElement('span');
  attachNativeAttributes(
    el,
    consumer.literal,
    dynamic,
    owner,
    undefined,
    elementRefs(el, [indicatorRef], props.ref),
  );
  if (isStatic(props, 'children')) {
    insert(el, props.children);
  } else {
    insert(el, () => props.children);
  }
  return el as unknown as JSX.Element;
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps extends BaseUIComponentProps<
  'span',
  CheckboxIndicatorState
> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
