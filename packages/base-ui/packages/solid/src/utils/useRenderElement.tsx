/* eslint-disable typescript/no-explicit-any -- generic render-element handles arbitrary State and tag types; tightening to unknown forces consumers to assert at every state-attribute mapping */
import {
  $PROXY,
  Show,
  createMemo,
  createRenderEffect,
  createRoot,
  getObserver,
  getOwner,
  isHydrating,
  isStatic,
  onCleanup,
  runWithOwner,
  untrack,
  type Accessor,
} from 'solid-js';
import type { JSX, ValidComponent } from '@solidjs/web';
import { assign, Dynamic, dynamic, isServer } from '@solidjs/web';
import type { DynamicProps } from '@solidjs/web';
import { MERGED_REFS } from '../merge-props/mergeProps';
import { access, shallowEqual, type MaybeAccessor, createLayoutEffect } from '../solid-helpers';
import { EMPTY_OBJECT } from './constants';
import { type StateAttributesMapping } from './getStateAttributesProps';
import {
  createPropsView,
  createStateAttributesSource,
  isPropsSourceAccessor,
  isStaticPropsViewKey,
  propsViewKeys,
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
/** The views drop a `render={{ component }}` config's `component` (one shared `omit` array). */
const OMIT_COMPONENT = ['component'] as const;
/** A previous value no prop equals, so `assign` removes or rewrites a server attribute. */
const SERVER_ATTRIBUTE = {};
const ATTRIBUTE_ALIASES: Record<string, string> = { className: 'class', htmlFor: 'for' };
const IMG_DEFAULTS = { alt: '' } as const;
const isHandlerKey = (key: string) => key.length > 2 && key[0] === 'o' && key[1] === 'n';

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
    // No `render` prop, or one that can never change: read it once, no memo (plan 7 step 3.7).
    // Server and hydration renders always take the memo paths below: the server and the client
    // compile can disagree on which props are static, and both renders must create the same owners
    // (hydration keys).
    const serverOrHydrating = isServer || isHydrating();
    const staticRenderProp =
      !serverOrHydrating &&
      untrack(() => !('render' in componentProps) || isStatic(componentProps, 'render'));
    const renderValue = staticRenderProp ? untrack(() => componentProps.render) : undefined;
    const renderProp = staticRenderProp
      ? () => renderValue
      : createMemo(() => componentProps.render);
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
      // A fixed props list is read from its one build, not from the `props` parameter again.
      const partProps =
        staticPartSources ?? (Array.isArray(params.props) ? params.props.flat() : [params.props]);
      partProps.forEach((partProp) => {
        // An accessor source (`propsSourceAccessor`) contributes the refs of the props it resolves to.
        const props = isPropsSourceAccessor(partProp) ? partProp() : partProp;
        if (props != null && typeof props === 'object') {
          collectRefs((props as { ref?: unknown }).ref, callbacks, objects);
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
    // A plain `state` object (not a getter, not a store) and a plain mapping keep their key sets.
    const fixedStateLayout = untrack(() => {
      if (serverOrHydrating) {
        return false;
      }
      const stateDescriptor = Object.getOwnPropertyDescriptor(params, 'state');
      const mappingDescriptor = Object.getOwnPropertyDescriptor(params, 'stateAttributesMapping');
      const value = stateDescriptor?.value as Record<PropertyKey, unknown> | undefined;
      return (
        !stateDescriptor?.get &&
        !mappingDescriptor?.get &&
        (value == null || (typeof value === 'object' && !value[$PROXY]))
      );
    });
    const stateAttributesSource = createStateAttributesSource(
      state,
      () => params.stateAttributesMapping as Record<string, (value: any) => any> | undefined,
      fixedStateLayout,
    );
    // Part props. As React's `mergeProps`, a function entry receives the part props before it and
    // its result replaces them (the function merges them into what it returns).
    const computePartSources = () => {
      const entries = Array.isArray(params.props) ? params.props.flat() : [params.props];
      let result: unknown[] = [];
      for (const entry of entries) {
        if (typeof entry === 'function' && !isPropsSourceAccessor(entry)) {
          const previous = createPropsView(result);
          const callback = entry as (props: Record<string, any>) => object | null | undefined;
          result = [propsSourceAccessor(() => callback(previous))];
        } else {
          result.push(entry);
        }
      }
      return result;
    };
    // A plain props list without function entries never changes: build it once, no memo.
    const staticPartSources = untrack(() => {
      if (serverOrHydrating || Object.getOwnPropertyDescriptor(params, 'props')?.get) {
        return undefined;
      }
      const entries = Array.isArray(params.props) ? params.props.flat() : [params.props];
      return entries.some((entry) => typeof entry === 'function' && !isPropsSourceAccessor(entry))
        ? undefined
        : (entries as unknown[]);
    });
    const partSources = staticPartSources
      ? () => staticPartSources
      : createMemo(computePartSources, { equals: shallowEqual });
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
    const computeSources = () => {
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
    };
    // Static tag, `render` and part props: the source list never changes, so no memo.
    const sources =
      typeof element !== 'function' && staticRenderProp && staticPartSources
        ? (() => {
            const list = untrack(computeSources);
            return () => list;
          })()
        : createMemo(computeSources, { equals: shallowEqual });
    const elementProps = createPropsView(sources, { omit: OMIT_COMPONENT });

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
    const staticComponent = staticRender ? untrack(tag) : undefined;

    // A part that rebuilds its props (e.g. a new inline ref) re-syncs the attached element's refs.
    // When no ref source can change (fixed render prop and part props, a literal or absent `ref`
    // prop, no `ref` getter on the params), the refs are applied once on attach and need no effect.
    // A static intrinsic element whose only changing ref sources are accessor sources re-syncs from
    // its attribute effect, which already follows them.
    // Server and hydration renders keep the effect, so both create the same owners (hydration keys).
    const refsCanChange = untrack(
      () =>
        serverOrHydrating ||
        !staticRenderProp ||
        !staticPartSources ||
        ('ref' in componentProps && !isStatic(componentProps, 'ref')) ||
        Boolean(Object.getOwnPropertyDescriptor(params, 'ref')?.get),
    );
    const accessorRefs =
      !refsCanChange && staticPartSources!.some((entry) => isPropsSourceAccessor(entry));
    const refsFollowAttributes = accessorRefs && typeof staticComponent === 'string';
    if (refsCanChange || (accessorRefs && !refsFollowAttributes)) {
      createLayoutEffect(readRefs, (refs) => {
        if (attachedElement != null) {
          syncRefs(refs);
        }
      });
    }

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

    // The element gets a single ref, `applyRef`, which applies every element ref once per element.
    const elementRef = { ref: applyRef };
    // Render functions and component tags receive these: the element props with `applyRef`, plus
    // the part's children for render functions (as `<Dynamic>` passed them before the Solid 2
    // port). A render function runs in a tracking scope and re-runs only for state its own body
    // reads (e.g. `state.pressed`); a prop it reads in its JSX updates only that prop.
    // Component tags and render functions read these; an intrinsic element never does, so they
    // are created on first use, owned by the part (not by the computation that first asks).
    const partOwner = getOwner();
    // Server and hydration renders create them up front, in place: creating them later through
    // the part's owner shifts hydration keys.
    const lazyOwned = <T,>(create: () => T) => {
      if (serverOrHydrating) {
        const value = create();
        return () => value;
      }
      let value: T | undefined;
      let created = false;
      return () => {
        if (!created) {
          created = true;
          value = runWithOwner(partOwner, create) as T;
        }
        return value as T;
      };
    };
    const componentTagProps = lazyOwned(() =>
      createPropsView(() => [...sources(), elementRef], { omit: OMIT_COMPONENT }),
    );
    const renderFnPropsView = lazyOwned(() =>
      createPropsView(
        () => [
          ...sources(),
          elementRef,
          // `children` is answered by `renderFnProps` below; this only declares the key.
          { children: undefined },
        ],
        { omit: OMIT_COMPONENT },
      ),
    );
    // Render functions treat these as plain props: handlers and ref callbacks read them
    // imperatively, so reads outside a tracking scope are untracked (no stale-read diagnostics).
    // The proxy target is an empty object so property-invariant checks never read the view.
    const read = <R,>(fn: () => R) => (getObserver() === null ? untrack(fn) : fn());
    // A stable view of the current state for render functions: the function itself tracks only
    // the state keys it reads, not the identity of the part's state object.
    const renderFnState = lazyOwned(
      () =>
        new Proxy({} as State, {
          get: (_, key) => read(() => Reflect.get(state(), key)),
          has: (_, key) => read(() => Reflect.has(state(), key)),
          ownKeys: () => read(() => Reflect.ownKeys(state())),
          getOwnPropertyDescriptor: (_, key) =>
            read(() => {
              const descriptor = Reflect.getOwnPropertyDescriptor(state(), key);
              return descriptor && { ...descriptor, configurable: true };
            }),
        }),
    );
    // `children` bypasses the view: it depends only on what resolves it, so an element spreading
    // these props creates the children once (inside its own context providers), as in Solid.
    const renderFnProps = lazyOwned(() => {
      const childrenDescriptor = {
        configurable: true,
        enumerable: true,
        get: () => read(resolveChildren),
      };
      return new Proxy({} as Record<string, any>, {
        get: (_, key) =>
          key === 'children'
            ? read(resolveChildren)
            : read(() => Reflect.get(renderFnPropsView(), key)),
        has: (_, key) => key === 'children' || read(() => Reflect.has(renderFnPropsView(), key)),
        ownKeys: () => read(() => Reflect.ownKeys(renderFnPropsView())),
        getOwnPropertyDescriptor: (_, key) =>
          key === 'children'
            ? childrenDescriptor
            : read(() => {
                const descriptor = Reflect.getOwnPropertyDescriptor(renderFnPropsView(), key);
                return descriptor && { ...descriptor, configurable: true };
              }),
      });
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
          const attributeKeys = () =>
            propsViewKeys(elementProps).filter((key) => key !== 'ref' && key !== 'children');
          // One structure effect follows the key set (the view memoizes it) and the props sources.
          // Per key:
          // - an event handler gets one stable dispatcher that reads the current chain when the
          //   event fires (handlers never subscribe), assigned with no computation;
          // - a value whose answering source holds it as a literal (Solid's `isStatic`, through
          //   the props views) is assigned once, with no computation;
          // - any other value gets one render effect of its own, so a change re-reads and writes
          //   only that key. A key that goes away reads `undefined` and its attribute is removed.
          const attributeOwner = getOwner();
          const reactiveKeys = new Set<string>();
          const staticApplied: Record<string, unknown> = {};
          let accessorProps: unknown[] = [];
          let refsStale = false;
          const dispatchers = new Map<string, (...args: unknown[]) => unknown>();
          const dispatcherFor = (key: string) => {
            let dispatch = dispatchers.get(key);
            if (!dispatch) {
              dispatch = (...args: unknown[]) =>
                (untrack(() => elementProps[key]) as ((...a: unknown[]) => unknown) | undefined)?.(
                  ...args,
                );
              dispatchers.set(key, dispatch);
            }
            return dispatch;
          };
          createRenderEffect(
            () => {
              // An accessor source that resolves to new props re-evaluates which keys are static
              // (and, when the element's refs follow this effect, which refs it has).
              const next: unknown[] = [];
              for (const source of sources()) {
                if (isPropsSourceAccessor(source)) {
                  next.push(source());
                }
              }
              if (
                refsFollowAttributes &&
                (next.length !== accessorProps.length ||
                  next.some((props, index) => props !== accessorProps[index]))
              ) {
                refsStale = true;
              }
              accessorProps = next;
              return attributeKeys();
            },
            (keys) => {
              if (!attached) {
                return;
              }
              if (refsStale) {
                refsStale = false;
                if (attachedElement === el) {
                  syncRefs(untrack(readRefs));
                }
              }
              const staticProps: Record<string, unknown> = {};
              for (const key of keys) {
                if (reactiveKeys.has(key)) {
                  continue;
                }
                if (isHandlerKey(key)) {
                  staticProps[key] = dispatcherFor(key);
                } else if (isStaticPropsViewKey(elementProps, key)) {
                  staticProps[key] = untrack(() => elementProps[key]);
                } else {
                  reactiveKeys.add(key);
                  delete staticApplied[key];
                  const applied: Record<string, unknown> = {};
                  runWithOwner(attributeOwner, () =>
                    createRenderEffect(
                      () => elementProps[key],
                      (value) => {
                        if (attached) {
                          assign(el, { [key]: value }, true, applied, true);
                        }
                      },
                    ),
                  );
                }
              }
              assign(el, staticProps, true, staticApplied, true);
            },
          );
          // Solid skips attribute writes for the whole synchronous `hydrate()` call (it trusts
          // the server markup), so a value that changes inside that call is lost: an id another
          // part registers in an effect, like a tab's `aria-controls`. A microtask runs once
          // `hydrate()` has returned; re-apply the current attributes then.
          if (isHydrating()) {
            // The server markup's attributes as claimed: after hydration, one the client no longer
            // renders (its key went away or became `undefined`, as `Field.Label`'s `for` once the
            // control registers) is removed, as React's hydration does. Only an attribute still
            // holding its server value is removed, so DOM work done during hydration stays.
            const serverAttributes = new Map<string, string>();
            for (const name of el.getAttributeNames()) {
              if (name !== '_hk' && name !== 'data-hk') {
                serverAttributes.set(name, el.getAttribute(name)!);
              }
            }
            queueMicrotask(() => {
              if (!attached) {
                return;
              }
              const current: Record<string, unknown> = {};
              const previous: Record<string, unknown> = {};
              for (const key of untrack(attributeKeys)) {
                if (!(key.length > 2 && key[0] === 'o' && key[1] === 'n')) {
                  current[key] = untrack(() => elementProps[key]);
                  if (current[key] == null && serverAttributes.get(key) === el.getAttribute(key)) {
                    previous[key] = SERVER_ATTRIBUTE;
                  }
                }
              }
              // Attribute names are case-insensitive (`tabIndex` renders `tabindex`), and React-style
              // aliases render their attribute (`className` → `class`, `htmlFor` → `for`).
              const renderedNames = new Set(
                Object.keys(current).map((key) => ATTRIBUTE_ALIASES[key] ?? key.toLowerCase()),
              );
              for (const [name, value] of serverAttributes) {
                if (!renderedNames.has(name) && el.getAttribute(name) === value) {
                  previous[name] = SERVER_ATTRIBUTE;
                }
              }
              assign(el, current, true, previous, true);
            });
          }
        }),
      );
    };
    const hostRef = (el: Element) => {
      attachAttributes(el);
      applyRef(el);
    };

    if (staticRender) {
      const component = staticComponent;
      const Tag = dynamic(() => component, { static: true }) as (props: any) => JSX.Element;
      if (typeof component === 'string') {
        // Literal text children (a string or number the consumer wrote, not JSX) are inserted
        // as they are: no memo, no insert effect.
        const literalChildren = untrack(() => {
          if ('children' in params || !isStatic(componentProps, 'children')) {
            return undefined;
          }
          const render = componentProps.render;
          if (render != null && typeof render === 'object' && 'children' in render) {
            return undefined;
          }
          const children = componentProps.children;
          return typeof children === 'string' || typeof children === 'number'
            ? { children }
            : undefined;
        });
        if (literalChildren) {
          const children = literalChildren.children;
          return <Tag ref={hostRef}>{children}</Tag>;
        }
        const resolvedChildren = createMemo(resolveChildren) as Accessor<JSX.Element>;
        return <Tag ref={hostRef}>{resolvedChildren()}</Tag>;
      }
      const resolvedChildren = createMemo(resolveChildren) as Accessor<JSX.Element>;
      // A plain value, not a call in the spread: the compiler wraps a call in a reactive spread.
      const tagProps = componentTagProps();
      return <Tag {...tagProps}>{resolvedChildren()}</Tag>;
    }

    // The branch follows the `render` prop, as React re-evaluates it every render. A render
    // function re-runs (re-creating its element) only for state read at its top level, as React
    // re-renders for a conditional return; reads inside its JSX update the element in place.
    return (
      <>
        {(() => {
          const render = renderProp();
          if (typeof render === 'function') {
            const fnProps = renderFnProps();
            const fnState = renderFnState();
            return render(fnProps, fnState);
          }
          // Reading JSX children creates them: resolve them once per branch, as Solid's `children`
          // helper, here inside the part's context providers.
          const resolvedChildren = createMemo(resolveChildren) as Accessor<JSX.Element>;
          const component = tag();
          if (isServer || typeof component !== 'string') {
            const tagProps = componentTagProps();
            return (
              <Dynamic {...tagProps} component={component}>
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
