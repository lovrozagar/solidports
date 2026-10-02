/* eslint-disable typescript/no-explicit-any -- generic render-element handles arbitrary State and tag types; tightening to unknown forces consumers to assert at every state-attribute mapping */
import { Show, createMemo, merge } from 'solid-js';
import type { JSX, ValidComponent } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import type { DynamicProps } from '@solidjs/web';
import { mergeProps } from '../merge-props/mergeProps';
import { access, type MaybeAccessor } from '../solid-helpers';
import { EMPTY_OBJECT } from './constants';
import { getStateAttributesProps, type StateAttributesMapping } from './getStateAttributesProps';
import { resolveClassName } from './resolveClassName';
import { resolveStyle } from './resolveStyle';
import type {
  BaseUIComponentProps,
  BaseUIHTMLProps,
  ComponentRenderFn,
  HTMLProps,
  IntrinsicRefElement,
  UseRenderElementRef,
} from './types';

/**
 * Renders a Base UI element.
 *
 * @param element The default HTML element to render. Can be overridden by the `render` prop.
 * @param componentProps An object containing the `render`, `className` and `ref` props to be used for element customization. Other props are ignored.
 * @param params Additional parameters for rendering the element.
 */
export function useRenderElement<
  TagName extends keyof JSX.IntrinsicElements | undefined,
  State extends Record<string, MaybeAccessor<any>>,
  RenderedElementType extends Element = TagName extends keyof JSX.IntrinsicElements
    ? IntrinsicRefElement<TagName>
    : Element,
  Enabled extends boolean | undefined = undefined,
  RenderFnElement extends ValidComponent = ValidComponent,
>(
  element: MaybeAccessor<TagName>,
  componentProps: useRenderElement.ComponentProps<State, RenderedElementType, RenderFnElement>,
  params: useRenderElement.Parameters<State, RenderedElementType, TagName, Enabled>,
): (props?: HTMLProps) => Enabled extends false ? null : JSX.Element {
  const state = () => params.state ?? (EMPTY_OBJECT as State);

  const Resolved = (renderProps: HTMLProps) => {
    // Solid 2 component bodies are not tracking scopes. mergeProps also snapshots
    // source keys at call time, so state `data-*` attrs (open, starting-style, checked)
    // must be rebuilt in a memo or they freeze on first paint.
    const applyRef = (el: any) => {
      if (typeof componentProps.ref === 'function') {
        componentProps.ref(el);
      } else if (
        componentProps.ref != null &&
        typeof componentProps.ref === 'object' &&
        'current' in (componentProps.ref as any)
      ) {
        /* User passed a ReactLikeRef — write to .current so consumers (e.g. `anchor={containerRef}`) see the live element. */
        (componentProps.ref as { current: unknown }).current = el;
      }

      const paramsRefs = Array.isArray(params.ref) ? params.ref.flat(Infinity) : [params.ref];
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < paramsRefs.length; i++) {
        const r = paramsRefs[i];
        if (typeof r === 'function') {
          (r as Function)(el);
        } else if (r != null && typeof r === 'object' && 'current' in r) {
          (r as { current: unknown }).current = el;
        }
      }
    };

    const merged = createMemo(() =>
      mergeProps([
        renderProps,

        { ref: applyRef },

        typeof componentProps.render === 'object' ? (componentProps.render as object) : {},

        getStateAttributesProps(state(), params.stateAttributesMapping),

        mergeProps(Array.isArray(params.props) ? params.props.flat() : params.props),

        {
          get class() {
            return resolveClassName(componentProps.class, state());
          },
          // Strip `component` from DOM/render-fn props. Solid 2 merge overwrites with
          // undefined, so the real tag must be passed as Dynamic's `component` *after*
          // this spread — never as a sibling prop that this undefined can clobber.
          component: undefined,

          get style() {
            return resolveStyle(componentProps.style, state());
          },
        },
      ]),
    );

    const resolvedChildren = () => {
      if (params.children != null) return params.children;
      const render = componentProps.render;
      /* `<a/>`-style JSX renders to an HTMLElement at evaluation time; HTMLElement always has a (live) `children` HTMLCollection, so the old
         `'children' in render` check trapped here and returned an empty collection — dropping the consumer's actual children. Only honor `render.children` for plain config objects ({component, children}). */
      if (render && typeof render === 'object' && !(render instanceof Node) && 'children' in render) {
        return (render as { children?: JSX.Element }).children;
      }
      // Parts that forward children through `params.props` (e.g. NavigationMenu.Link via
      // CompositeItem) only carry them in the merged props. The JSX child below overrides the
      // spread, and Solid 2 lets an `undefined` override win, so fall back to the merged value.
      return componentProps.children ?? (merged() as { children?: JSX.Element }).children;
    };

    const tag = () => {
      const render = componentProps.render;
      if (typeof render === 'string') {
        return render;
      }
      if (render && typeof render === 'object' && 'component' in render) {
        return (render as { component: ValidComponent }).component;
      }
      return access(element);
    };

    const intrinsicTag = () => access(element);

    if (typeof componentProps.render === 'function') {
      // Render functions receive the part's children in their props, as `<Dynamic>` passed them
      // before the Solid 2 port (`render={(props) => <Toggle {...props} />}`). The getter keeps
      // them lazy so they are created inside the rendered component's context, like React elements.
      const withChildren = (props: HTMLProps) =>
        merge(props, {
          get children() {
            return resolvedChildren();
          },
        });
      return <>{componentProps.render(withChildren(merged()), state())}</>;
    }

    return (
      <Dynamic
        {...(intrinsicTag() === 'button' ? { type: 'button' } : {})}
        {...(intrinsicTag() === 'img' ? { alt: '' } : {})}
        {...merged()}
        component={tag()}
      >
        {resolvedChildren()}
      </Dynamic>
    );
  };

  const Component = (props: HTMLProps) => {
    return (
      <Show when={access(params.enabled) ?? true}>
        <Resolved {...props} />
      </Show>
    );
  };

  return ((renderFnProps: HTMLProps = {}) => {
    return <Component {...renderFnProps} />;
  }) as (props?: HTMLProps) => Enabled extends false ? null : JSX.Element;
}

type RenderFunctionProps<TagName extends keyof JSX.IntrinsicElements | undefined, State> =
  | BaseUIComponentProps<TagName, State>
  | JSX.HTMLAttributes<
      TagName extends keyof JSX.IntrinsicElements ? JSX.IntrinsicElements[TagName] : any
    >;

export type UseRenderElementParameters<
  State extends Record<string, MaybeAccessor<any>>,
  RenderedElementType extends Element,
  TagName extends keyof JSX.IntrinsicElements | undefined,
  Enabled extends boolean | undefined,
> = {
  /**
   * If `false`, the hook will skip most of its internal logic and return `null`.
   * This is useful for rendering a component conditionally.
   * @default true
   */
  enabled?: MaybeAccessor<Enabled | undefined>;
  /**
   * @deprecated
   */
  propGetter?: ((externalProps: HTMLProps) => HTMLProps) | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?:
    | UseRenderElementRef<RenderedElementType>
    | (
        | UseRenderElementRef<RenderedElementType>
        | undefined
        | null
        | (
            | UseRenderElementRef<RenderedElementType>
            | undefined
            | null
            | (UseRenderElementRef<RenderedElementType> | undefined | null)[]
          )[]
      )[]
    | undefined;
  /**
   * The state of the component.
   */
  state?: State | undefined;
  /**
   * Intrinsic props to be spread on the rendered element.
   */
  props?:
    | RenderFunctionProps<TagName, State>
    | (
        | RenderFunctionProps<TagName, State>
        | BaseUIHTMLProps
        | JSX.HTMLAttributes<HTMLElement>
        | Record<string, any>
        | undefined
        | ((
            props: BaseUIHTMLProps,
          ) => RenderFunctionProps<TagName, State> | BaseUIHTMLProps | undefined | null)
        | (
            | RenderFunctionProps<TagName, State>
            | BaseUIHTMLProps
            | JSX.HTMLAttributes<HTMLElement>
            | Record<string, any>
            | undefined
            | ((
                props: BaseUIHTMLProps,
              ) => RenderFunctionProps<TagName, State> | BaseUIHTMLProps | undefined | null)
          )[]
      )[]
    | undefined;

  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * SolidJS only: The children override to render.
   */
  children?: JSX.Element | ((...args: any[]) => JSX.Element) | undefined;
};

export interface UseRenderElementComponentProps<
  State extends Record<string, MaybeAccessor<any>>,
  RenderedElementType extends Element,
  RenderFnElement extends ValidComponent = ValidComponent,
> {
  /**
   * The class name to apply to the rendered element.
   * Can be a string or a function that accepts the state and returns a string.
   */
  class?: (string | ((state: State) => string | undefined)) | undefined;
  /**
   * The render prop or Solid element to override the default element.
   */
  render?:
    | undefined
    | null
    | keyof JSX.IntrinsicElements
    | DynamicProps<RenderFnElement>
    | ComponentRenderFn<Record<string, unknown>, State>;
  /**
   * The style to apply to the rendered element.
   * Can be a style object or a function that accepts the state and returns a style object.
   */
  style?: (JSX.CSSProperties | ((state: State) => JSX.CSSProperties | undefined)) | undefined;
  /**
   * The children to render.
   */
  children?: JSX.Element | ((...args: any[]) => JSX.Element) | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?: UseRenderElementRef<RenderedElementType> | undefined;
}

export namespace useRenderElement {
  export type Parameters<
    State extends Record<string, MaybeAccessor<any>>,
    RenderedElementType extends Element,
    TagName extends keyof JSX.IntrinsicElements | undefined,
    Enabled extends boolean | undefined,
  > = UseRenderElementParameters<State, RenderedElementType, TagName, Enabled>;
  export type ComponentProps<
    State extends Record<string, MaybeAccessor<any>>,
    RenderedElementType extends Element,
    RenderFnElement extends ValidComponent = ValidComponent,
  > = UseRenderElementComponentProps<State, RenderedElementType, RenderFnElement>;
}
