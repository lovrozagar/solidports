import { getOwner, isStatic, Show } from 'solid-js';
import { insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { DEFAULT_FIELD_ROOT_CONTEXT, useFieldRootContext } from '../../field/root/FieldRootContext';
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
import { splitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { RadioRootState } from '../root/RadioRoot';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioIndicator(componentProps: RadioIndicator.Props) {
  // Solid-native fast path (plan 8): the `<span>` with its state attributes rendered directly;
  // no props split and no merged state proxy (the native element reads the state by key).
  const native = canRenderNative(componentProps);
  const keepMounted = () => componentProps.keepMounted ?? false;

  const rootState = useRadioRootContext();

  const rendered = () => rootState.checked;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const state: RadioIndicatorState = native
    ? (Object.create(rootState, {
        transitionStatus: { enumerable: true, get: () => transitionStatus() },
      }) as RadioIndicatorState)
    : solidMergeProps(rootState, {
        get transitionStatus() {
          return transitionStatus();
        },
      });

  const indicatorRef = useRef<HTMLSpanElement | null | undefined>(null);

  const shouldRender = () => keepMounted() || mounted();

  const inField = native && useFieldRootContext() !== DEFAULT_FIELD_ROOT_CONTEXT;
  const element = native
    ? () => NativeIndicator(componentProps, state, indicatorRef, inField)
    : useRenderElement('span', componentProps, {
        ref: indicatorRef,
        state,
        props: splitComponentProps(componentProps, ['keepMounted'])[2],
        stateAttributesMapping,
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

  return <Show when={shouldRender()}>{element()}</Show>;
}

const OWN_KEYS: ReadonlySet<string> = new Set(['keepMounted']);

/**
 * The indicator's element: `data-*` from the radio state (`data-checked`/`data-unchecked`, the
 * transition hooks, the Field validity) and the consumer's props in one render effect.
 */
function NativeIndicator(
  props: RadioIndicator.Props,
  state: RadioIndicatorState,
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
    set(target, 'data-disabled', stateAttr(state.disabled));
    if (inField) {
      fieldStateAttributes(state, target);
    }
    set(target, 'data-required', stateAttr(state.required));
    set(target, 'data-readonly', stateAttr(state.readOnly));
    const isChecked = state.checked;
    set(target, 'data-checked', isChecked ? '' : undefined);
    set(target, 'data-unchecked', isChecked ? undefined : '');
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
  if ('children' in props) {
    if (isStatic(props, 'children')) {
      insert(el, props.children);
    } else {
      insert(el, () => props.children);
    }
  }
  return el as unknown as JSX.Element;
}

export interface RadioIndicatorProps extends BaseUIComponentProps<'span', RadioIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace RadioIndicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
