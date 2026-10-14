import type {
  JSX,
  ComponentProps as SolidComponentProps,
  ValidComponent,
  DynamicProps,
} from '@solidjs/web';
import { access } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
import type { StateAttributesMapping } from '../utils/getStateAttributesProps';
import type { ComponentRenderFn, HTMLProps, UseRenderElementRef } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';

/**
 * Renders a Base UI element.
 *
 * @public
 */
export function useRender<
  State extends Record<string, MaybeAccessor<any>>,
  RenderedElementType extends Element,
  Enabled extends boolean | undefined = undefined,
>(
  params: useRender.Parameters<State, RenderedElementType, Enabled>,
): useRender.ReturnValue<Enabled> {
  const tag = () => access(params.defaultTagName) ?? 'div';
  return useRenderElement(tag, params, params);
}

export type UseRenderRenderProp<
  State = Record<string, unknown>,
  ElementType extends ValidComponent = ValidComponent,
  RenderFunctionProps = JSX.HTMLAttributes<any>,
> =
  | keyof JSX.IntrinsicElements
  // Any element, as React's `render` takes any `ReactElement`: `ElementType` types the part's own
  // props, not the element that replaces it.
  | DynamicProps<ValidComponent>
  | ComponentRenderFn<RenderFunctionProps, State>
  | null;

export type UseRenderElementProps<ElementType extends ValidComponent> =
  SolidComponentProps<ElementType>;

export type UseRenderComponentProps<
  ElementType extends ValidComponent,
  State = {},
  RenderFunctionProps = HTMLProps,
> = SolidComponentProps<ElementType> & {
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a `JSX.Element` or a function that returns the element to render.
   */
  render?: UseRenderRenderProp<State, ElementType, RenderFunctionProps> | undefined;
};

export interface UseRenderParameters<
  State,
  RenderedElementType extends Element,
  Enabled extends boolean | undefined,
> {
  /**
   * The React element or a function that returns one to override the default element.
   */
  render?: UseRenderRenderProp<State> | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?: UseRenderElementRef<RenderedElementType> | undefined;
  /**
   * The state of the component, passed as the second argument to the `render` callback.
   * State properties are automatically converted to data-* attributes.
   */
  state?: State | undefined;
  /**
   * Custom mapping for converting state properties to data-* attributes.
   * @example
   * { isActive: (value) => (value ? { 'data-is-active': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Props to be spread on the rendered element.
   * They are merged with the internal props of the component, so that event handlers
   * are merged, `className` strings and `style` properties are joined, while other external props overwrite the
   * internal ones.
   */
  props?: Record<string, unknown> | undefined;
  /**
   * If `false`, the hook will skip most of its internal logic and return `null`.
   * This is useful for rendering a component conditionally.
   * @default true
   */
  enabled?: MaybeAccessor<Enabled | undefined> | undefined;
  /**
   * The default tag name to use for the rendered element when `render` is not provided.
   * @default 'div'
   */
  defaultTagName?: MaybeAccessor<keyof JSX.IntrinsicElements | undefined> | undefined;
  /**
   * The children to render.
   */
  children?: JSX.Element | ((...args: any[]) => JSX.Element) | undefined;
}

export type UseRenderReturnValue<Enabled extends boolean | undefined> = (
  props?: HTMLProps,
) => Enabled extends false ? null : JSX.Element;

export interface UseRenderState {}

export namespace useRender {
  export type State = UseRenderState;

  export type RenderProp<
    TState = Record<string, unknown>,
    ElementType extends ValidComponent = ValidComponent,
  > = UseRenderRenderProp<TState, ElementType>;

  export type ElementProps<ElementType extends ValidComponent> = UseRenderElementProps<ElementType>;

  export type ComponentProps<
    ElementType extends ValidComponent,
    TState = {},
    RenderFunctionProps = HTMLProps,
  > = UseRenderComponentProps<ElementType, TState, RenderFunctionProps>;

  export type Parameters<
    TState,
    RenderedElementType extends Element,
    Enabled extends boolean | undefined,
  > = UseRenderParameters<TState, RenderedElementType, Enabled>;

  export type ReturnValue<Enabled extends boolean | undefined> = UseRenderReturnValue<Enabled>;
}
