import { getOwner, isStatic } from 'solid-js';
import { insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { DEFAULT_FIELD_ROOT_CONTEXT, useFieldRootContext } from '../../field/root/FieldRootContext';
import { splitComponentProps } from '../../solid-helpers';
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
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SwitchRootState } from '../root/SwitchRoot';
import { useSwitchRootContext } from '../root/SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';

/**
 * The movable part of the switch that indicates whether the switch is on or off.
 * Renders a `<span>`.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchThumb(componentProps: SwitchThumb.Props) {
  const state = useSwitchRootContext();

  // Solid-native fast path (plan 8): the `<span>` with its state attributes rendered directly.
  if (canRenderNative(componentProps)) {
    return NativeThumb(componentProps, state);
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('span', componentProps, {
    state,
    stateAttributesMapping,
    props: elementProps,
  });

  return <>{element()}</>;
}

const OWN_KEYS: ReadonlySet<string> = new Set();

/** The thumb's element: `data-*` from the switch state and the consumer's props in one render effect. */
function NativeThumb(props: SwitchThumb.Props, state: SwitchRootState): JSX.Element {
  const owner = getOwner();
  const inField = useFieldRootContext() !== DEFAULT_FIELD_ROOT_CONTEXT;
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
    const isChecked = state.checked;
    set(target, 'data-checked', isChecked ? '' : undefined);
    set(target, 'data-unchecked', isChecked ? undefined : '');
    set(target, 'data-readonly', stateAttr(state.readOnly));
    set(target, 'data-required', stateAttr(state.required));
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
    elementRefs(el, undefined, props.ref),
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

export interface SwitchThumbProps extends BaseUIComponentProps<'span', SwitchThumbState> {}

export interface SwitchThumbState extends SwitchRootState {}

export namespace SwitchThumb {
  export type Props = SwitchThumbProps;
  export type State = SwitchThumbState;
}
