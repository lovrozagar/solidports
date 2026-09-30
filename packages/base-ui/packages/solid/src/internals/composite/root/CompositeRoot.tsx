/* eslint-disable typescript/no-explicit-any -- generic Metadata/State across composite items; State extends Record<string, any> mirrors React port */
import { batch, type JSX } from 'solid-js';
import { useDirection } from '../../../direction-provider/DirectionContext';
import { access, defaultProps, splitComponentProps, type ReactLikeRef } from '../../../solid-helpers';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../../utils/constants';
import { StateAttributesMapping } from '../../../utils/getStateAttributesProps';
import type { BaseUIComponentProps, UseRenderElementRef } from '../../../utils/types';
import { useRenderElement } from '../../../utils/useRenderElement';
import type { Dimensions, ModifierKey } from '../composite';
import { CompositeList, type CompositeMetadata } from '../list/CompositeList';
import { CompositeRootContext } from './CompositeRootContext';
import { useCompositeRoot } from './useCompositeRoot';

/**
 * @internal
 */
export function CompositeRoot<Metadata extends {}, State extends Record<string, any>>(
  componentProps: CompositeRoot.Props<Metadata, State>,
) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'refs',
    'props',
    'state',
    'stateAttributesMapping',
    'highlightedIndex',
    'onHighlightedIndexChange',
    'orientation',
    'dense',
    'itemSizes',
    'loopFocus',
    'cols',
    'enableHomeAndEndKeys',
    'onMapChange',
    'stopEventPropagation',
    'disabledIndices',
    'modifierKeys',
    'highlightItemOnHover',
    'tag',
    'rootRef',
  ]);
  const props = defaultProps(local, {
    highlightItemOnHover: false,
    props: EMPTY_ARRAY as Array<Record<string, any> | (() => Record<string, any>)>,
    refs: EMPTY_ARRAY as ReactLikeRef<HTMLElement>[],
    state: EMPTY_OBJECT as State,
    stopEventPropagation: true,
    tag: 'div',
  });

  const direction = useDirection();
  const {
    props: rootDefaultProps,
    highlightedIndex,
    onHighlightedIndexChange,
    onMapChange: onMapChangeUnwrapped,
    relayKeyboardEvent,
    setRootRef,
    refs: elementsRefs,
  } = useCompositeRoot(props, direction);

  const contextValue: CompositeRootContext = {
    highlightItemOnHover: () => access(props.highlightItemOnHover) ?? false,
    highlightedIndex,
    onHighlightedIndexChange,
    relayKeyboardEvent,
  };

  const element = useRenderElement(() => props.tag, componentProps, {
    get props() {
      return [rootDefaultProps, props.props, elementProps];
    },
    ref: [setRootRef, props.refs],
    get state() {
      return props.state;
    },
    get stateAttributesMapping() {
      return props.stateAttributesMapping;
    },
  });

  return (
    <CompositeRootContext.Provider value={contextValue}>
      <CompositeList<Metadata>
        refs={elementsRefs}
        onMapChange={(newMap) => {
          batch(() => {
            props.onMapChange?.(newMap);
            onMapChangeUnwrapped(newMap);
          });
        }}
      >
        {element()}
      </CompositeList>
    </CompositeRootContext.Provider>
  );
}

type AllowedProps = Record<string, any> & { children?: never };

export interface CompositeRootProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<'div', State>,
  'render' | 'class' | 'children'
> {
  props?: Array<AllowedProps | (() => AllowedProps)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  refs?:
    | Array<
        | UseRenderElementRef<HTMLElement>
        | Array<UseRenderElementRef<HTMLElement> | null | undefined>
      >
    | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
  orientation?: ('horizontal' | 'vertical' | 'both') | undefined;
  cols?: number | undefined;
  loopFocus?: boolean | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  itemSizes?: Dimensions[] | undefined;
  dense?: boolean | undefined;
  enableHomeAndEndKeys?: boolean | undefined;
  onMapChange?:
    | ((newMap: Array<{ element: Element; metadata: CompositeMetadata<Metadata> | null }>) => void)
    | undefined;
  stopEventPropagation?: boolean | undefined;
  rootRef?: (HTMLElement | null) | undefined;
  disabledIndices?: number[] | undefined;
  modifierKeys?: ModifierKey[] | undefined;
  highlightItemOnHover?: boolean | undefined;
}

export namespace CompositeRoot {
  export type Props<Metadata, State extends Record<string, any>> = CompositeRootProps<
    Metadata,
    State
  >;
}
