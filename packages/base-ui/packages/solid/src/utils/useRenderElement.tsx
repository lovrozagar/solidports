/* eslint-disable typescript/no-explicit-any -- generic render-element handles arbitrary State and tag types; tightening to unknown forces consumers to assert at every state-attribute mapping */
import {
  Show,
  createMemo,
  createRenderEffect,
  createRoot,
  getObserver,
  isHydrating,
  isStatic,
  mapArray,
  onCleanup,
  runWithOwner,
  untrack,
  type Accessor,
} from 'solid-js';
import type { JSX, ValidComponent } from '@solidjs/web';
import { assign, Dynamic, dynamic, isServer, spread } from '@solidjs/web';
import type { DynamicProps } from '@solidjs/web';
import { MERGED_REFS } from '../merge-props/mergeProps';
import { access, shallowEqual, type MaybeAccessor } from '../solid-helpers';
import { EMPTY_OBJECT } from './constants';
import { type StateAttributesMapping } from './getStateAttributesProps';
import {
  createPropsView,
  createStateAttributesSource,
  isPropsSourceAccessor,
  propsSourceAccessor,
} from './propsView';
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
    // replaced callback is not called with `null`: Solid refs never receive `null`. The consumer's ref usually also reaches the element props
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
    // Reads only the `ref` of each props source (the sources the element props combine), so a change to any
    // other prop does not re-run the ref sync. Tracking every prop would make a ref
    // that writes state those props read (a part registering its element) re-run its own sync.
    const readRefs = () => {
      const callbacks = new Set<Function>();
      const objects = new Set<{ current: unknown }>();
      collectRefs(componentProps.ref, callbacks, objects);
      collectRefs((renderProps as { ref?: unknown }).ref, callbacks, objects);
      const render = renderProp();
      if (render != null && typeof render === 'object') {
        collectRefs((render as { ref?: unknown }).ref, callbacks, objects);
      }
      const partProps = Array.isArray(params.props) ? params.props.flat() : [params.props];
      partProps.forEach((partProp) => {
        if (partProp != null && typeof partProp === 'object') {
          collectRefs((partProp as { ref?: unknown }).ref, callbacks, objects);
        }
      });
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

    // The element's props, lowest priority first, as one lazy per-key view (`createPropsView`): a
    // read of one prop tracks only that prop's sources, and the key set only which keys exist.
    // `component` (from a `render={{ component }}` config) is dropped, not set to `undefined`:
    // a render function spreading these props onto `<Dynamic component={X}>` would otherwise
    // have its own `component` overwritten.
    const stateAttributesSource = createStateAttributesSource(
      state,
      () => params.stateAttributesMapping as Record<string, (value: any) => any> | undefined,
    );
    // Part props. As React's `mergeProps`, a function entry receives the part props before it and
    // its result replaces them (the function merges them into what it returns).
    const partSources = createMemo(
      () => {
        const entries = Array.isArray(params.props) ? params.props.flat() : [params.props];
        let result: unknown[] = [];
        for (const entry of entries) {
          if (typeof entry === 'function' && !isPropsSourceAccessor(entry)) {
            const previous = createPropsView(result);
            const callback = entry as (props: Record<string, any>) => object | null | undefined;
            result = [propsSourceAccessor(createMemo(() => callback(previous)))];
          } else {
            result.push(entry);
          }
        }
        return result;
      },
      { equals: shallowEqual },
    );
    // `class` and `style` exist only when the part's props have them, so an element without them
    // gets no attribute work for either.
    const resolveClassStyle = (key: string | symbol) =>
      key === 'class'
        ? resolveClassName(componentProps.class, state())
        : key === 'style'
          ? resolveStyle(componentProps.style, state())
          : undefined;
    const hasClassStyle = (key: string | symbol) =>
      (key === 'class' || key === 'style') && key in componentProps;
    const classStyleSource = new Proxy({} as Record<string, unknown>, {
      get: (_, key) => (hasClassStyle(key) ? resolveClassStyle(key) : undefined),
      has: (_, key) => hasClassStyle(key),
      ownKeys: () => ['class', 'style'].filter(hasClassStyle),
      getOwnPropertyDescriptor: (_, key) =>
        hasClassStyle(key)
          ? { configurable: true, enumerable: true, get: () => resolveClassStyle(key) }
          : undefined,
    });
    // The render object and React's `renderTag` defaults (`type="button"` / `alt=""` at the lowest
    // priority) are read here, so a prop read subscribes to one memo for them.
    const sources = createMemo(
      () => {
        const intrinsicTag = access(element);
        const render = renderProp();
        return [
          intrinsicTag === 'button'
            ? BUTTON_DEFAULTS
            : intrinsicTag === 'img'
              ? IMG_DEFAULTS
              : undefined,
          renderProps,
          render != null && typeof render === 'object' && !(render instanceof Node)
            ? render
            : undefined,
          stateAttributesSource,
          ...partSources(),
          classStyleSource,
        ];
      },
      { equals: shallowEqual },
    );
    const elementProps = createPropsView(sources, { omit: ['component'] });

    // A part that rebuilds its props (e.g. a new inline ref) re-syncs the attached element's refs.
    createRenderEffect(readRefs, (refs) => {
      if (attachedElement != null) {
        syncRefs(refs);
      }
    });

    const resolveChildren = () => {
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
      // CompositeItem) only carry them in the element props. The JSX child below overrides the
      // spread, and Solid 2 lets an `undefined` override win, so fall back to the element props.
      return componentProps.children ?? (elementProps.children as JSX.Element);
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

    // The element gets a single ref, `applyRef`, which applies every element ref once per element.
    const elementRef = { ref: applyRef };
    // Render functions and component tags receive these: the element props with `applyRef`, plus
    // the part's children for render functions (as `<Dynamic>` passed them before the Solid 2
    // port). A render function runs in a tracking scope and re-runs only for state its own body
    // reads (e.g. `state.pressed`); a prop it reads in its JSX updates only that prop.
    const componentTagProps = createPropsView(() => [...sources(), elementRef], {
      omit: ['component'],
    });
    const renderFnPropsView = createPropsView(
      () => [
        ...sources(),
        elementRef,
        // `children` is answered by `renderFnProps` below; this only declares the key.
        { children: undefined },
      ],
      { omit: ['component'] },
    );
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
    // `children` bypasses the view: it depends only on what resolves it, so an element spreading
    // these props creates the children once (inside its own context providers), as in Solid.
    const childrenDescriptor = {
      configurable: true,
      enumerable: true,
      get: () => read(resolveChildren),
    };
    const renderFnProps = new Proxy({} as Record<string, any>, {
      get: (_, key) =>
        key === 'children'
          ? read(resolveChildren)
          : read(() => Reflect.get(renderFnPropsView, key)),
      has: (_, key) => key === 'children' || read(() => Reflect.has(renderFnPropsView, key)),
      ownKeys: () => read(() => Reflect.ownKeys(renderFnPropsView)),
      getOwnPropertyDescriptor: (_, key) =>
        key === 'children'
          ? childrenDescriptor
          : read(() => {
              const descriptor = Reflect.getOwnPropertyDescriptor(renderFnPropsView, key);
              return descriptor && { ...descriptor, configurable: true };
            }),
    });

    // An intrinsic element on the client gets one small effect per attribute (Solid's own `spread`
    // for that key), so a change applies only that attribute and no computation subscribes to
    // every prop. Keys that appear later get their effect then; a key that goes away is removed
    // from the element. Detaching (unmount or a new element) leaves the old element as it was, as
    // React does. The server renders the element props as one spread.
    // The attribute root is unowned so the component's cleanup marks it detached before it
    // disposes (an owned child root would dispose first and strip the detached element).
    // Event handlers need no effect: each gets one listener that calls the current chain when the
    // event fires (handlers never subscribe), so only attribute values track their sources.
    let disposeAttributes: (() => void) | undefined;
    onCleanup(() => disposeAttributes?.());
    const attachAttributes = (el: Element) => {
      disposeAttributes?.();
      runWithOwner(null, () =>
        createRoot((dispose) => {
          let attached = true;
          disposeAttributes = () => {
            attached = false;
            dispose();
          };
          const attributeKeys = createMemo(
            () =>
              (Reflect.ownKeys(elementProps) as string[]).filter(
                (key) => key !== 'ref' && key !== 'children',
              ),
            { equals: shallowEqual },
          );
          const applied = mapArray(attributeKeys, (key) => {
            let appliedProps: Record<string, unknown>;
            if (key.length > 2 && key[0] === 'o' && key[1] === 'n') {
              const dispatch = (...args: unknown[]) =>
                (untrack(() => elementProps[key]) as ((...a: unknown[]) => unknown) | undefined)?.(
                  ...args,
                );
              appliedProps = { [key]: dispatch };
              assign(el, appliedProps, true, {}, true);
            } else {
              // `spread` returns the props it applied; a key that goes away is removed with them.
              appliedProps = spread(
                el,
                () => ({ [key]: elementProps[key] }),
                true,
              ) as unknown as Record<string, unknown>;
            }
            onCleanup(() => {
              if (attached) {
                assign(el, {}, true, appliedProps, true);
              }
            });
          });
          createMemo(applied);
        }),
      );
    };
    const hostRef = (el: Element) => {
      attachAttributes(el);
      applyRef(el);
    };

    // A part whose tag and `render` prop never change (no `render`, a string, or a config object)
    // renders its element directly: no branch memo, so a list of parts gives its parent nothing
    // to track per row. Render functions keep the branch: their top-level reads re-run them.
    const staticRender = untrack(() => {
      // The server and hydration render through `<Dynamic>`, so both create the same owners.
      if (
        isServer ||
        isHydrating() ||
        typeof element === 'function' ||
        ('render' in componentProps && !isStatic(componentProps, 'render'))
      ) {
        return false;
      }
      const render = componentProps.render;
      return typeof render !== 'function' && !(render instanceof Node);
    });
    if (staticRender) {
      const component = untrack(tag);
      const Tag = dynamic(() => component, { static: true }) as (props: any) => JSX.Element;
      const resolvedChildren = createMemo(resolveChildren) as Accessor<JSX.Element>;
      return typeof component === 'string' ? (
        <Tag ref={hostRef}>{resolvedChildren()}</Tag>
      ) : (
        <Tag {...componentTagProps}>{resolvedChildren()}</Tag>
      );
    }

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
          // Reading JSX children creates them: resolve them once per branch, as Solid's `children`
          // helper, here inside the part's context providers.
          const resolvedChildren = createMemo(resolveChildren) as Accessor<JSX.Element>;
          const component = tag();
          if (isServer || typeof component !== 'string') {
            return (
              <Dynamic {...componentTagProps} component={component}>
                {resolvedChildren()}
              </Dynamic>
            );
          }
          return (
            <Dynamic component={component} ref={hostRef}>
              {resolvedChildren()}
            </Dynamic>
          );
        })()}
      </>
    );
  };

  // A part without `enabled` always renders, so it skips the `<Show>` layer.
  const Component =
    'enabled' in params
      ? (props: HTMLProps) => (
          <Show when={access(params.enabled) ?? true}>
            <Resolved {...props} />
          </Show>
        )
      : Resolved;

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
