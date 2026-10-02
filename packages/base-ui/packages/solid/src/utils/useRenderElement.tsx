/* eslint-disable typescript/no-explicit-any -- generic render-element handles arbitrary State and tag types; tightening to unknown forces consumers to assert at every state-attribute mapping */
import {
  Show,
  createMemo,
  createRenderEffect,
  getObserver,
  merge,
  omit,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { JSX, ValidComponent } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import type { DynamicProps } from '@solidjs/web';
import { MERGED_REFS, mergeProps } from '../merge-props/mergeProps';
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
const BUTTON_DEFAULTS = { type: 'button' } as const;
const IMG_DEFAULTS = { alt: '' } as const;

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
    // Solid 2 applies refs from inside an effect. A ref is a callback, not a subscription, so
    // the chain (user ref, part refs, trigger registration) runs untracked.
    // Read the `render` prop once per change: a JSX-valued prop is a getter that re-creates its
    // element on every read, and the branch below must not re-run for unrelated prop changes.
    const renderProp = createMemo(() => componentProps.render);
    // React semantics for the element's refs: each distinct ref callback is called once with the
    // element, and a replacement callback (a part rebuilt its props) is called with it too. A
    // replaced callback is not called with `null`: Solid refs never receive `null`. The consumer's ref usually also reaches the merged props
    // through the part's forwarded element props, so callbacks are deduplicated.
    let attachedElement: unknown = null;
    let appliedRefs = new Set<Function>();
    let appliedObjectRefs = new Set<{ current: unknown }>();
    const collectRefs = (
      ref: unknown,
      callbacks: Set<Function>,
      objects: Set<{ current: unknown }>,
    ) => {
      if (typeof ref === 'function') {
        const chained = (ref as { [MERGED_REFS]?: Function[] })[MERGED_REFS];
        if (chained) {
          chained.forEach((callback) => collectRefs(callback, callbacks, objects));
        } else {
          callbacks.add(ref);
        }
      } else if (Array.isArray(ref)) {
        ref.forEach((r) => collectRefs(r, callbacks, objects));
      } else if (ref != null && typeof ref === 'object' && 'current' in ref) {
        objects.add(ref as { current: unknown });
      }
    };
    const readRefs = () => {
      const callbacks = new Set<Function>();
      const objects = new Set<{ current: unknown }>();
      collectRefs(componentProps.ref, callbacks, objects);
      collectRefs((merged() as { ref?: unknown }).ref, callbacks, objects);
      collectRefs(params.ref, callbacks, objects);
      return { callbacks, objects };
    };
    // Ref callbacks run ownerless and untracked, as Solid applies refs.
    const syncRefs = (refs: ReturnType<typeof readRefs>) =>
      runWithOwner(null, () =>
        untrack(() => {
          const el = attachedElement;
          refs.callbacks.forEach((callback) => {
            if (!appliedRefs.has(callback)) {
              callback(el);
            }
          });
          // An object ref that was removed is cleared, as React does; callback refs keep Solid's
          // contract and are never called with `null`.
          appliedObjectRefs.forEach((ref) => {
            if (!refs.objects.has(ref) && ref.current === el) {
              ref.current = null;
            }
          });
          refs.objects.forEach((ref) => {
            ref.current = el;
          });
          appliedRefs = refs.callbacks;
          appliedObjectRefs = refs.objects;
        }),
      );
    const applyRef = (el: any) => {
      if (el === attachedElement) {
        return;
      }
      attachedElement = el;
      appliedRefs = new Set();
      appliedObjectRefs = new Set();
      syncRefs(untrack(readRefs));
    };
    // React calls the part's refs with `null` when the element unmounts, and the ported
    // registration logic relies on it; Solid only applies refs on mount. Mirror the unmount call.
    // User refs keep Solid's contract.
    onCleanup(() => {
      if (attachedElement != null) {
        const previousElement = attachedElement;
        attachedElement = null;
        const partRefs = {
          callbacks: new Set<Function>(),
          objects: new Set<{ current: unknown }>(),
        };
        untrack(() => collectRefs(params.ref, partRefs.callbacks, partRefs.objects));
        runWithOwner(null, () =>
          untrack(() => {
            partRefs.callbacks.forEach((callback) => callback(null));
            // Solid may attach a replacement element before this cleanup runs: only clear a ref
            // that still points at the outgoing element.
            partRefs.objects.forEach((ref) => {
              if (ref.current === previousElement) {
                ref.current = null;
              }
            });
          }),
        );
      }
    });

    // `component` (from a `render={{ component }}` config) is dropped, not set to `undefined`:
    // a render function spreading these props onto `<Dynamic component={X}>` would otherwise
    // have its own `component` overwritten.
    const merged = createMemo(() =>
      omit(
        mergeProps([
          renderProps,

          typeof renderProp() === 'object' ? (renderProp() as object) : {},

          getStateAttributesProps(state(), params.stateAttributesMapping),

          mergeProps(Array.isArray(params.props) ? params.props.flat() : params.props),

          {
            get class() {
              return resolveClassName(componentProps.class, state());
            },
            get style() {
              return resolveStyle(componentProps.style, state());
            },
          },
        ]),
        'component' as never,
      ),
    );

    // A part that rebuilds its props (e.g. a new inline ref) re-syncs the attached element's refs.
    createRenderEffect(readRefs, (refs) => {
      if (attachedElement != null) {
        syncRefs(refs);
      }
    });

    const resolvedChildren = () => {
      // A part that supplies `children` owns them, even when they resolve to nothing.
      if ('children' in params) return params.children;
      const render = renderProp();
      /* `<a/>`-style JSX renders to an HTMLElement at evaluation time; HTMLElement always has a (live) `children` HTMLCollection, so the old
         `'children' in render` check trapped here and returned an empty collection — dropping the consumer's actual children. Only honor `render.children` for plain config objects ({component, children}). */
      if (
        render &&
        typeof render === 'object' &&
        !(render instanceof Node) &&
        'children' in render
      ) {
        return (render as { children?: JSX.Element }).children;
      }
      // Parts that forward children through `params.props` (e.g. NavigationMenu.Link via
      // CompositeItem) only carry them in the merged props. The JSX child below overrides the
      // spread, and Solid 2 lets an `undefined` override win, so fall back to the merged value.
      return componentProps.children ?? (merged() as { children?: JSX.Element }).children;
    };

    const tag = () => {
      const render = renderProp();
      if (typeof render === 'string') {
        return render;
      }
      if (render && typeof render === 'object' && 'component' in render) {
        return (render as { component: ValidComponent }).component;
      }
      return access(element);
    };

    // React's `renderTag`: the default element gets `type="button"` / `alt=""` at the lowest
    // priority. Both sources are accessors, so `merge` reads them lazily in tracking scopes.
    const intrinsicDefaults = () => {
      const intrinsicTag = access(element);
      if (intrinsicTag === 'button') {
        return BUTTON_DEFAULTS;
      }
      return intrinsicTag === 'img' ? IMG_DEFAULTS : EMPTY_OBJECT;
    };
    // The element gets a single ref, `applyRef`, which applies every merged ref once per element.
    const elementRef = { ref: applyRef };
    const dynamicProps = merge(intrinsicDefaults, merged, elementRef);

    // Render functions receive a live view of the props (the memo as a `merge` source) plus the
    // part's children, as `<Dynamic>` passed them before the Solid 2 port. The function runs in
    // a tracking scope, so it re-runs only for state its own body reads (e.g. `state.pressed`);
    // prop changes reach the element through its spread. Passing a `merged()` snapshot instead
    // re-created the element on every prop change, and a ref that writes state then looped.
    const renderFnPropsView = merge(merged, elementRef, {
      get children() {
        return resolvedChildren();
      },
    });
    // Render functions treat these as plain props: handlers and ref callbacks read them
    // imperatively, so reads outside a tracking scope are untracked (no stale-read diagnostics).
    // The proxy target is an empty object so property-invariant checks never read the view.
    const read = <R,>(fn: () => R) => (getObserver() === null ? untrack(fn) : fn());
    // A stable view of the current state for render functions: the function itself tracks only
    // the state keys it reads, not the identity of the part's state object.
    const renderFnState = new Proxy({} as State, {
      get: (_, key) => read(() => Reflect.get(state(), key)),
      has: (_, key) => read(() => Reflect.has(state(), key)),
      ownKeys: () => read(() => Reflect.ownKeys(state())),
      getOwnPropertyDescriptor: (_, key) =>
        read(() => {
          const descriptor = Reflect.getOwnPropertyDescriptor(state(), key);
          return descriptor && { ...descriptor, configurable: true };
        }),
    });
    const renderFnProps = new Proxy({} as typeof renderFnPropsView, {
      get: (_, key) => read(() => Reflect.get(renderFnPropsView, key)),
      has: (_, key) => read(() => Reflect.has(renderFnPropsView, key)),
      ownKeys: () => read(() => Reflect.ownKeys(renderFnPropsView)),
      getOwnPropertyDescriptor: (_, key) =>
        read(() => {
          const descriptor = Reflect.getOwnPropertyDescriptor(renderFnPropsView, key);
          return descriptor && { ...descriptor, configurable: true };
        }),
    });

    // The branch follows the `render` prop, as React re-evaluates it every render. A render
    // function re-runs (re-creating its element) only for state read at its top level, as React
    // re-renders for a conditional return; reads inside its JSX update the element in place.
    return (
      <>
        {(() => {
          const render = renderProp();
          if (typeof render === 'function') {
            return render(renderFnProps, renderFnState);
          }
          return (
            <Dynamic {...dynamicProps} component={tag()}>
              {resolvedChildren()}
            </Dynamic>
          );
        })()}
      </>
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
