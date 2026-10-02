/* eslint-disable typescript/no-explicit-any -- generic State/Metadata propagated via composite root, mirrors React port */
import type { JSX } from '@solidjs/web';
import { splitComponentProps, type MaybeAccessor } from '../../../solid-helpers';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../../utils/constants';
import { StateAttributesMapping } from '../../../utils/getStateAttributesProps';
import type { BaseUIComponentProps, UseRenderElementRef } from '../../../utils/types';
import { useRenderElement } from '../../../utils/useRenderElement';
import { useCompositeItem } from './useCompositeItem';
import { mergeProps as solidMergeProps } from '../../../solid-1-compat';

/**
 * @internal
 */
export function CompositeItem<Metadata, State extends Record<string, any>>(
  componentProps: CompositeItem.Props<Metadata, State>,
) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'state',
    'props',
    'refs',
    'metadata',
    'stateAttributesMapping',
    'tag',
    'children',
  ]);
  const mergedProps = solidMergeProps(
    {
      props: EMPTY_ARRAY,
      refs: EMPTY_ARRAY,
      state: EMPTY_OBJECT as State,
      tag: 'div',
    } as typeof local,
    local,
  );
  const { compositeProps, setCompositeRef } = useCompositeItem({ metadata: local.metadata });

  const element = useRenderElement(() => mergedProps.tag, componentProps, {
    get children() {
      return local.children;
    },
    get props() {
      return [compositeProps, mergedProps.props, elementProps];
    },
    get ref() {
      return [mergedProps.refs, setCompositeRef];
    },
    get state() {
      return mergedProps.state;
    },
    get stateAttributesMapping() {
      return mergedProps.stateAttributesMapping;
    },
  });

  return <>{element()}</>;
}

export interface CompositeItemProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<any, State>,
  'render' | 'class'
> {
  children?: JSX.Element;
  metadata?: MaybeAccessor<Metadata | undefined>;
  refs?: UseRenderElementRef<HTMLElement> | UseRenderElementRef<HTMLElement>[];
  props?: Array<Record<string, any> | (() => Record<string, any>)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
}

export namespace CompositeItem {
  export type Props<Metadata, State extends Record<string, any>> = CompositeItemProps<
    Metadata,
    State
  >;
}
