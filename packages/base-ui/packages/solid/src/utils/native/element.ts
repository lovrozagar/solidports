/*
 * Native element renderer: the one routine a Solid-native part runs to turn an element it created
 * with direct JSX into its rendered element. It generalizes the Button pilot: literal attributes
 * once, one owned render effect for everything that can change, handlers composed in React's
 * order, part refs with `null` on unmount, children inserted directly.
 * Contract: `context/architecture/render-pipeline.md`. Nothing here creates a reactive node beyond
 * the one attribute effect (when needed) and the children insert.
 */
import {
  createMemo,
  createRenderEffect,
  getOwner,
  isHydrating,
  isStatic,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import {
  assign,
  createComponent,
  escape,
  getNextElement,
  insert,
  isServer,
  ssrElement,
} from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { MERGED_REFS, combineStyle } from '../../merge-props/mergeProps';
import { markRenderPath } from '../renderPath';
import { HandlerRecord, isHandlerKey as isConsumerHandlerKey } from './consumer';
import type { Dispatch } from './consumer';
import { serverElement } from './serverElement';
import { afterHydration, attributesOf, checkHydratedAttributes } from './hydrationState';
import type { StateAttributesMapping } from '../getStateAttributesProps';
import { warn } from '../warn';
import {
  applyRefs,
  attachNativeAttributes,
  classifyConsumerProps,
  readReactiveProps,
  releasePartRefs,
  resolveClass,
  resolveStyle,
} from './index';

/**
 * A part's element as a template: `create` makes it from compiled JSX on the client (claiming the
 * server's node while hydrating), and the server renders `tag` with the same attributes instead.
 */
export interface NativeElementTemplate {
  tag: string;
  /** The template's static attributes, which the compiled JSX holds on the client. */
  attributes?: Record<string, unknown> | undefined;
  create: () => Element;
}

const isTemplate = (value: Element | NativeElementTemplate): value is NativeElementTemplate =>
  typeof (value as NativeElementTemplate).create === 'function';

/** Event handler props (`onClick`), which the server does not render and hydration attaches. */
const isHandlerKey = (key: string) => {
  const c = key.charCodeAt(2);
  return key.startsWith('on') && c > 64 && c < 91;
};

/** Writes one attribute below the consumer's props (a consumer key always wins). */
/**
 * Writes one attribute of a native element's write (`undefined` removes it). A writer object:
 * parts call `w.set(key, value)`, with no closure per element.
 */
export interface SetAttribute {
  set(key: string, value: unknown): void;
}

export interface NativeElementSpec<State extends object> {
  /** The part's own props: never forwarded to the element. */
  own: ReadonlySet<string>;
  /**
   * The part's state: `class`/`style` functions receive it and, unless `stateAttributes` is
   * `false`, every key becomes a `data-*` attribute as `getStateAttributesProps` maps it. A
   * factory is called on first use, so a part whose consumer passes no function never builds it.
   */
  state?: State | (() => State) | undefined;
  mapping?: StateAttributesMapping<State> | undefined;
  /** `state`'s attributes precompiled at module level (`compileStateWriter`); else compiled here. */
  stateWriter?: StateWriter | undefined;
  /**
   * What `stateWriter` reads instead of `state`: an object with the same keys, which may be
   * prototype getters (a class instance costs far less to create than an object literal's own
   * getters). Requires `stateWriter`.
   */
  stateView?: object | undefined;
  stateAttributes?: boolean | undefined;
  /** Literal part attributes (`role`, …), written once below `attributes`. */
  literal?: Record<string, unknown> | undefined;
  /** The part's attributes that follow reactive sources; runs inside the attribute effect. */
  attributes?: ((set: SetAttribute) => void) | undefined;
  /** Whether the state or the part attributes can change (an attribute effect is created). */
  reactive: boolean;
  /**
   * The part's handlers by key, created once at module level (`partHandler`): each element binds
   * them as `[dispatch, record]` tuples over one `HandlerRecord` holding the consumer's props and
   * `handlerTarget`, so it allocates no closure per key.
   */
  handlers?: Readonly<Record<string, Dispatch<any>>> | undefined;
  /** Handlers as `handlers` binds them, for keys bound only when the consumer passes them. */
  handlersIfPassed?: Readonly<Record<string, Dispatch<any>>> | undefined;
  /** What `handlers` act on: the part's model, the same object for every key. */
  handlerTarget?: unknown;
  /** A part style combined below the consumer's (the consumer's keys win), e.g. measured CSS variables. */
  partStyle?: (() => JSX.CSSProperties | undefined) | undefined;
  /** A part style combined above the consumer's (its keys win), e.g. a temporary `animation-name`. */
  styleOverride?: (() => JSX.CSSProperties | undefined) | undefined;
  /**
   * The part's write reads a value no signal tracks (a measured animation type), which can change
   * while hydrating without re-running the attribute effect: reconcile after hydration in any case.
   * Other parts reconcile only when their effect applied again while hydrating.
   */
  reconcileAfterHydration?: boolean | undefined;
  /** Part refs: called with the element on attach and with `null` on unmount. */
  refs?: readonly unknown[] | undefined;
  /** Children the part owns; otherwise the consumer's `children` are inserted. */
  children?: (() => JSX.Element) | undefined;
  /** Whether the consumer's children are inserted (`false` for void or self-filled elements). */
  consumerChildren?: boolean | undefined;
}

/**
 * The state's `data-*` attributes, as `getStateAttributesProps` computes them, written through
 * `set` (reads every state key: tracked inside the attribute effect).
 */
export function writeStateAttributes<State extends object>(
  state: State,
  mapping: StateAttributesMapping<State> | undefined,
  set: SetAttribute,
): void {
  /* eslint-disable-next-line guard-for-in */
  for (const key in state) {
    const value = state[key];
    const mapper = mapping?.[key];
    if (mapper) {
      const custom = mapper(value as never);
      if (custom != null) {
        for (const attribute of Object.keys(custom)) {
          set.set(attribute, custom[attribute]);
        }
      }
      continue;
    }
    if (value === true) {
      set.set(`data-${key.toLowerCase()}`, '');
    } else if (value) {
      set.set(`data-${key.toLowerCase()}`, String(value));
    }
  }
}

/** Writes a state's `data-*` attributes, reading the state live (see `compileStateWriter`). */
export type StateWriter = (state: object, set: SetAttribute) => void;

/**
 * `writeStateAttributes` compiled for one state shape (`keys`, in the state object's order) and
 * mapping: attribute names and mappers are resolved once, so a write only reads each key and calls
 * `set`. A part compiles its writer once at module level and passes it as `stateWriter`.
 */
export function compileStateWriter(
  keys: readonly string[],
  mapping: StateAttributesMapping<any> | undefined,
): StateWriter {
  const count = keys.length;
  const names = keys.map((key) => `data-${key.toLowerCase()}`);
  const mappers = keys.map(
    (key) =>
      (
        mapping as
          Record<string, ((value: never) => Record<string, unknown> | null) | undefined> | undefined
      )?.[key],
  );
  return (target, set) => {
    const values = target as Record<string, unknown>;
    for (let i = 0; i < count; i += 1) {
      const value = values[keys[i]];
      const mapper = mappers[i];
      if (mapper) {
        const custom = mapper(value as never);
        if (custom != null) {
          for (const attribute of Object.keys(custom)) {
            set.set(attribute, custom[attribute]);
          }
        }
      } else if (value === true) {
        set.set(names[i], '');
      } else if (value) {
        set.set(names[i], String(value));
      }
    }
  };
}

const DEFAULT_MAPPING = {};
const compiledWriters = new WeakMap<object, Map<string, StateWriter>>();

/** `compileStateWriter` for a part that passes no `stateWriter`: cached per mapping and shape. */
export function compileStateAttributes<State extends object>(
  state: State,
  mapping: StateAttributesMapping<State> | undefined,
): StateWriter {
  const keys = Object.keys(state);
  const signature = keys.join('\0');
  let byShape = compiledWriters.get(mapping ?? DEFAULT_MAPPING);
  if (!byShape) {
    byShape = new Map();
    compiledWriters.set(mapping ?? DEFAULT_MAPPING, byShape);
  }
  let writer = byShape.get(signature);
  if (!writer) {
    writer = compileStateWriter(keys, mapping);
    byShape.set(signature, writer);
  }
  return writer;
}

/**
 * Applies a part's refs (plain callbacks, as parts pass them) ownerless and untracked, as
 * `applyRefs` does, without its per-call sets; anything else goes through `applyRefs`. Returns
 * whether the refs were plain (released directly on cleanup).
 */
function applyPartRefs(el: Element, refs: readonly unknown[]): boolean {
  for (const ref of refs) {
    if (typeof ref !== 'function' || (ref as { [MERGED_REFS]?: unknown })[MERGED_REFS]) {
      applyRefs(el, ...refs);
      return false;
    }
  }
  runWithOwner(null, () =>
    untrack(() => {
      for (const ref of refs) {
        (ref as (element: Element) => void)(el);
      }
    }),
  );
  return true;
}

/** Form controls, whose properties (`value`, `checked`) Solid writes apart from attributes. */
const STATEFUL_TAGS: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'OPTION']);

/**
 * Whether Solid's `assign` would only record `next` on `el`: a claimed (connected) element while
 * hydrating, with no object `class` (whose classes Solid records on the node even then) and no
 * form-control properties.
 */
const recordsOnly = (el: Element, next: Record<string, unknown>) =>
  isHydrating() &&
  el.isConnected &&
  !STATEFUL_TAGS.has(el.nodeName) &&
  (next.class == null || typeof next.class !== 'object');

/** The part's state for consumer functions, created on first use from a factory and kept. */
function partState<State extends object>(spec: NativeElementSpec<State>): State | undefined {
  const state = spec.state;
  if (typeof state === 'function') {
    // The spec is the element's own object: the created state replaces its factory.
    const created = (state as () => State)();
    spec.state = created;
    return created;
  }
  return state;
}

/** The writer of the part's state attributes, if it writes any. */
function stateWriterOf<State extends object>(
  spec: NativeElementSpec<State>,
): StateWriter | undefined {
  if (spec.state === undefined || spec.stateAttributes === false) {
    return undefined;
  }
  return spec.stateWriter ?? compileStateAttributes(partState(spec)!, spec.mapping);
}

/** What the part's state writer reads: the `stateView` it was compiled for, or the state. */
const writtenStateOf = <State extends object>(spec: NativeElementSpec<State>): object =>
  (spec.stateWriter && spec.stateView) || partState(spec)!;

/** A `class`/`style` value for `resolveClass`/`resolveStyle`: functions receive the state. */
const consumerState = <State extends object>(spec: NativeElementSpec<State>, value: unknown) =>
  typeof value === 'function' ? partState(spec) : undefined;

// The server writes one element's attributes at a time: one writer serves every element (saved and
// restored around each write, in case a state getter renders). The part's own writes (its state
// attributes and `attributes`) are collected and then written into the markup string, a later
// write of a key winning as on the client; a key the attribute object already holds (a template or
// literal attribute it overrides), `class` and `style` go into the object, copied before its first
// write since it starts as the template's shared attributes. The write lists are shared by every
// element: an element rendered while another writes appends after it and moves the top back. The
// lists never shrink, so their storage is allocated once, not per element.
const writeKeys: string[] = [];
const writeValues: unknown[] = [];
let writeTop = 0;
let serverObject: Record<string, unknown> = {};
let serverObjectShared = false;
let serverKeys: ReadonlySet<string> = new Set();

/** The element's attribute object, owned by this element from its first write. */
function ownServerObject() {
  if (serverObjectShared) {
    serverObject = { ...serverObject };
    serverObjectShared = false;
  }
  return serverObject;
}

const setServerAttribute: SetAttribute = {
  set(key, value) {
    if (value == null || serverKeys.has(key)) {
      return;
    }
    if (key in serverObject || key === 'class' || key === 'style') {
      ownServerObject()[key] = value;
      return;
    }
    writeKeys[writeTop] = key;
    writeValues[writeTop] = value;
    writeTop += 1;
  },
};

/**
 * The markup of the writes from `start` to `end`: each key once, its last write winning (the
 * client's object keeps the last write), every value escaped as `ssrElement` escapes attributes.
 * Development warns about a key written twice.
 */
export function takeServerMarkup(
  keys: string[],
  values: unknown[],
  start: number,
  end: number = keys.length,
): string {
  let markup = '';
  for (let i = start; i < end; i += 1) {
    const key = keys[i];
    if (lastIndexBefore(keys, key, i + 1, end) !== -1) {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          `A native part wrote the \`${key}\` attribute twice on the server; its last write is kept, as on the client. Write each attribute once per element.`,
        );
      }
      continue;
    }
    const value = values[i];
    if (typeof value === 'boolean') {
      if (value) {
        markup += ` ${key}`;
      }
    } else {
      markup += value === '' ? ` ${key}` : ` ${key}="${escape(value as string, true)}"`;
    }
  }
  return markup;
}

/** The index of `key` in `keys` from `from` to `end`, or -1. */
function lastIndexBefore(keys: string[], key: string, from: number, end: number) {
  for (let i = from; i < end; i += 1) {
    if (keys[i] === key) {
      return i;
    }
  }
  return -1;
}

/** A literal the server renders as an attribute: no ref, handler or function. */
const isServerAttribute = (key: string, value: unknown) =>
  key !== 'ref' && typeof value !== 'function' && !isHandlerKey(key);

const NO_ATTRIBUTES: Record<string, unknown> = Object.freeze({}) as Record<string, unknown>;

/**
 * `renderNativeElement` on the server: one pass with the same attributes as the client's first
 * write, and no handlers, refs or effect. `ssrElement` prints the hydration key the client's
 * compiled template claims, the attribute object (the template's literals and the consumer's
 * props) and then the part's own attributes, already written as markup.
 */
function renderServerElement<State extends object>(
  element: Element | NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
  top?: Record<string, unknown>,
): Element {
  if (!isTemplate(element)) {
    throw new Error(
      'Base UI: a native part rendered on the server needs an element template ({ tag, create }), not an element. Pass a template so the server can render the tag.',
    );
  }
  const source = props as Record<string, any>;
  const consumer = classifyConsumerProps(props, spec.own);
  const keys = top ? withKeys(consumer.keys, top) : consumer.keys;
  const reactive = top ? consumer.reactive.filter((key) => !(key in top)) : consumer.reactive;

  const previousObject = serverObject;
  const previousShared = serverObjectShared;
  const previousKeys = serverKeys;
  const start = writeTop;
  serverObject = element.attributes ?? NO_ATTRIBUTES;
  serverObjectShared = true;
  serverKeys = keys;
  let attributes: Record<string, unknown>;
  let markup: string;
  let shared: boolean;
  try {
    const partLiteral = spec.literal;
    if (partLiteral) {
      for (const key in partLiteral) {
        if (!keys.has(key) && isServerAttribute(key, partLiteral[key])) {
          ownServerObject()[key] = partLiteral[key];
        }
      }
    }
    const consumerLiteral = consumer.literal;
    for (const key in consumerLiteral) {
      if (isServerAttribute(key, consumerLiteral[key])) {
        ownServerObject()[key] = consumerLiteral[key];
      }
    }
    if (reactive.length > 0) {
      readReactiveProps(props, reactive, ownServerObject());
    }
    if (top) {
      Object.assign(ownServerObject(), top);
    }

    stateWriterOf(spec)?.(writtenStateOf(spec), setServerAttribute);
    spec.attributes?.(setServerAttribute);

    if ('class' in props) {
      const value = resolveClass(source.class, consumerState(spec, source.class));
      if (value !== undefined) {
        ownServerObject().class = value;
      }
    }
    const styleOverride = spec.styleOverride;
    const partStyle = spec.partStyle;
    const hasStyle = 'style' in props;
    if (hasStyle || styleOverride || partStyle) {
      let value = hasStyle
        ? resolveStyle(source.style, consumerState(spec, source.style), partStyle?.())
        : partStyle?.();
      const override = styleOverride?.();
      if (override) {
        value = value ? combineStyle(value, override) : override;
      }
      if (value !== undefined) {
        ownServerObject().style = value;
      }
    }
    attributes = serverObject;
    shared = serverObjectShared;
    markup = takeServerMarkup(writeKeys, writeValues, start, writeTop);
  } finally {
    writeTop = start;
    serverObject = previousObject;
    serverObjectShared = previousShared;
    serverKeys = previousKeys;
  }

  let children: unknown;
  // Escaped as compiled JSX escapes a child expression: `ssrElement` writes the children it is
  // given as they are, so text with markup characters would become markup.
  if (spec.children) {
    children = escape(spec.children);
  } else if (spec.consumerChildren !== false && 'children' in props) {
    children = isStatic(props, 'children')
      ? escape(source.children)
      : () => escape(source.children);
  }
  // The native kit's own writer for the cases a native element has (D18); `ssrElement` for the rest.
  const written = serverElement(element.tag, attributes, children, markup, shared);
  if (written !== undefined) {
    return written as unknown as Element;
  }
  return ssrElement(
    element.tag,
    attributes,
    children as never,
    true,
    undefined,
    markup,
  ) as unknown as Element;
}

/**
 * Renders `el` as the part's element for `props`: the consumer's literal keys and the handler
 * dispatchers once, the part's and the reactive keys from one effect (none when nothing can
 * change), refs, then the children. Returns `el`.
 */
export function renderNativeElement<State extends object>(
  element: Element | NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
): Element {
  if ('render' in props && !isStatic(props, 'render')) {
    return renderDynamicRender(element, props, spec);
  }
  // A static `render` the part let through `canRenderNative` (`isNativeRender`).
  const render = (props as { render?: unknown }).render;
  if (render != null) {
    return renderWithRender(element as NativeElementTemplate, props, spec, render);
  }
  // Separate functions: the client's writers live in a closure context that V8 allocates on entry.
  return isServer
    ? renderServerElement(element, props, spec)
    : renderClientElement(element, props, spec);
}

/**
 * A reactive `render` (a getter, as a wrapper forwarding `render={props.render}` passes) that the
 * part let through `canRenderNative` with `dynamicRender`: the server renders its value once; the
 * client renders it under one transparent branch memo (no hydration id, so the element claims the
 * server's as without it), which re-renders the element when the getter's value changes, the
 * element swapping between forms (a function, a tag, a config) as the slow path's branch does.
 */
function renderDynamicRender<State extends object>(
  element: Element | NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
): Element {
  const source = props as { render?: unknown };
  const renderValue = (value: unknown) => {
    if (process.env.NODE_ENV !== 'production' && value != null && !isNativeRender(value)) {
      warn(
        'A reactive `render` changed to a form the native path does not render (a config with handlers, a ref, children or getters).',
        'Pass that `render` statically, or as a function, so the part renders it.',
      );
    }
    if (value != null) {
      return renderWithRender(element as NativeElementTemplate, props, spec, value);
    }
    return isServer
      ? renderServerElement(element, props, spec)
      : renderClientElement(element, props, spec);
  };
  if (isServer) {
    return renderValue(source.render);
  }
  return createMemo(
    () => {
      const value = source.render;
      return untrack(() => renderValue(value));
    },
    { transparent: true },
  ) as unknown as Element;
}

type RenderFunction = (props: Record<string, unknown>, state: unknown) => JSX.Element;
type RenderConfig = { component: string | ((props: any) => JSX.Element) } & Record<string, unknown>;

/**
 * Whether the native path renders this static `render` value as the slow path would: a tag, a
 * `{ component, ...props }` config whose own props are plain attributes (the slow path chains a
 * config's handlers and refs and inserts its children, which this path does not), or a render
 * function. `tag` limits a tag (and a config's string `component`) to the part's own, for a part
 * whose element semantics depend on it (a trigger's `<button>`).
 */
export function isNativeRender(render: unknown, tag?: string): boolean {
  if (render == null || typeof render === 'function') {
    return true;
  }
  if (typeof render === 'string') {
    return tag === undefined || render === tag;
  }
  if (typeof render !== 'object' || Array.isArray(render) || !('component' in render)) {
    return false;
  }
  const config = render as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (key === 'ref' || key === 'children' || isConsumerHandlerKey(key)) {
      return false;
    }
    if (Object.getOwnPropertyDescriptor(config, key)?.get) {
      return false;
    }
  }
  const component = config.component;
  if (typeof component === 'string') {
    return tag === undefined || component === tag;
  }
  return typeof component === 'function';
}

/** `isNativeRender` for a trigger: its native path renders a `<button>`'s semantics. */
export const isNativeButtonRender = (render: unknown) => isNativeRender(render, 'button');

/**
 * The part's element for a static `render`: a tag (or a config naming one) is the part's element
 * created by that tag, rendered as without `render`; a component (in a config) or a render
 * function renders the consumer's element from the part's props (`renderConsumerElement`).
 */
function renderWithRender<State extends object>(
  template: NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
  render: unknown,
): Element {
  if (typeof render === 'function') {
    return renderConsumerElement(template, props, spec, render as RenderFunction, true);
  }
  let element = template;
  let elementProps = props;
  let top: Record<string, unknown> | undefined;
  let component: RenderConfig['component'] | undefined;
  if (typeof render === 'string') {
    component = render;
  } else {
    component = (render as RenderConfig).component;
    [elementProps, top] = withRenderConfig(props, render as RenderConfig);
  }
  if (typeof component !== 'string') {
    const Component = component;
    return renderConsumerElement(
      template,
      elementProps,
      spec,
      (view) => createComponent(Component, view) as JSX.Element,
      false,
      top,
    );
  }
  if (component !== template.tag || isServer) {
    element = tagTemplate(component, template);
  }
  return isServer
    ? renderServerElement(element, elementProps, spec, top)
    : renderClientElement(element, elementProps, spec, top);
}

/**
 * `template` for another tag: the element is created by tag (claimed from the server's markup
 * while hydrating, one hydration key as a compiled template takes) with the template's attributes.
 */
function tagTemplate(tag: string, template: NativeElementTemplate): NativeElementTemplate {
  const attributes = template.attributes;
  return {
    tag,
    attributes,
    create: () => {
      if (isHydrating()) {
        return getNextElement() as Element;
      }
      const el = document.createElement(tag);
      if (attributes) {
        for (const key of Object.keys(attributes)) {
          el.setAttribute(key, String(attributes[key]));
        }
      }
      return el;
    },
  };
}

/**
 * A render config's own props as the slow path merges them: its attributes win over the part's
 * and the consumer's (React merges `render.props` last), returned as the top layer; its `class`
 * comes after the consumer's resolved class and its `style` sits below the consumer's, merged into
 * the consumer's props.
 */
function withRenderConfig(
  props: object,
  config: RenderConfig,
): [object, Record<string, unknown> | undefined] {
  const source = props as Record<string, any>;
  let merged: Record<string, unknown> | undefined;
  let top: Record<string, unknown> | undefined;
  for (const key in config) {
    if (key === 'component') {
      continue;
    }
    const value = config[key];
    if (key === 'class' || key === 'style') {
      merged ??= Object.defineProperties({}, Object.getOwnPropertyDescriptors(props));
      if (!(key in source)) {
        merged[key] = value;
      } else if (key === 'class') {
        merged.class = (state: unknown) => {
          const own = resolveClass(source.class, state);
          return own ? `${own} ${value}` : value;
        };
      } else {
        merged.style = (state: unknown) => {
          const own = resolveStyle(source.style, state);
          return own ? combineStyle(value as never, own as never) : value;
        };
      }
    } else {
      (top ??= {})[key] = value;
    }
  }
  return [merged ?? props, top];
}

/**
 * The part's element rendered by the consumer: `make` (a render function, or a config's component)
 * receives one plain props object and creates the element itself, so the part binds through what
 * the consumer spreads, as the slow path and React do: attributes and handlers in the props, the
 * ref only as the ref. A consumer that drops the ref still gets every attribute.
 *
 * Literal attributes are data properties; everything that can change reads one transparent memo
 * holding the part's write, which takes the place of the part's attribute effect (the consumer's
 * spread is the only binding). A render function runs in its own memo, so state or a signal read
 * at its top level re-renders it, as the slow path's branch does, and nothing else does; reads
 * inside its JSX update in place. The server passes the same props, written once.
 */
function renderConsumerElement<State extends object>(
  template: NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
  make: RenderFunction,
  isFunction: boolean,
  top?: Record<string, unknown>,
): Element {
  const source = props as Record<string, any>;
  const { literal, writer, needsEffect } = createClientWriter(
    props,
    spec,
    template.attributes,
    top,
    true,
  );
  const view: Record<string, unknown> = Object.assign({}, literal);
  if (!needsEffect || isServer) {
    writer.write(view, false);
  } else {
    let defined: Set<string> | undefined;
    const current = createMemo(
      () => {
        const next = writer.write({}, true);
        for (const key in next) {
          if (!defined?.has(key)) {
            (defined ??= new Set()).add(key);
            Object.defineProperty(view, key, {
              get: () => current()[key],
              enumerable: true,
              configurable: true,
            });
          }
        }
        return next;
      },
      { transparent: true },
    );
    untrack(current);
  }

  if (spec.children) {
    const children = spec.children;
    Object.defineProperty(view, 'children', { get: children, enumerable: true });
  } else if (spec.consumerChildren !== false && 'children' in props) {
    if (isStatic(props, 'children')) {
      view.children = source.children;
    } else {
      Object.defineProperty(view, 'children', {
        get: () => source.children,
        enumerable: true,
      });
    }
  }

  if (!isServer) {
    const refs = spec.refs;
    const hasPartRefs = refs !== undefined && refs.length > 0;
    let attached: Element | undefined;
    if (hasPartRefs || source.ref != null) {
      view.ref = (el: Element) => {
        attached = el;
        if (process.env.NODE_ENV !== 'production') {
          markRenderPath(el, 'native');
        }
        if (source.ref != null) {
          applyRefs(el, source.ref);
        }
        if (hasPartRefs) {
          applyRefs(el, ...refs);
        }
      };
    } else if (process.env.NODE_ENV !== 'production') {
      view.ref = (el: Element) => markRenderPath(el, 'native');
    }
    if (hasPartRefs) {
      void onCleanup(() => {
        if (attached) {
          releasePartRefs(attached, ...refs);
        }
      });
    }
  }

  if (!isFunction) {
    return make(view, undefined) as unknown as Element;
  }
  const state = partState(spec);
  if (isServer) {
    return make(view, state) as unknown as Element;
  }
  // Its own transparent memo (no hydration id), created in the part's scope as the server called
  // it: the computation that resolves the part's output resolves its siblings' too (a parent's
  // children are one array), so a thunk would re-run for a sibling's reads and re-create this
  // element; while hydrating, it would also run under another owner path and miss its element.
  return createMemo(() => make(view, state), { transparent: true }) as unknown as Element;
}

/**
 * The client's attribute writer for one element: the attributes written once (`literal`) and
 * `write`, which writes everything that can change into the object it is given. `needsEffect` says
 * whether anything can change. Shared by the part's own element and a consumer's element.
 */
interface ClientWriter {
  literal: Record<string, unknown>;
  writer: ElementWriter<any>;
  needsEffect: boolean;
}

/**
 * The client's attribute writer for one element (`createClientWriter`). `write` writes everything
 * that can change into the object it is given; `set`, which parts call, writes into that object
 * the keys the consumer does not set, `undefined` values only when `keepUndefined` (the effect's
 * writes, which remove an attribute) and not in the literal pass. Solid: both are methods on the
 * prototype and the inputs are fields, so an element allocates one object, not closures and the
 * scope they would keep.
 */
class ElementWriter<State extends object> implements SetAttribute {
  /** The element and the attributes its effect last wrote (`attach`); unset on a consumer's element. */
  declare protected el: Element;
  declare protected previous: Record<string, unknown>;
  declare private target: Record<string, unknown>;
  declare private keepUndefined: boolean;
  declare private readonly keys: ReadonlySet<string>;
  declare private readonly props: Record<string, any>;
  declare private readonly spec: NativeElementSpec<State>;
  declare private readonly reactive: readonly string[];
  declare private readonly writeState: StateWriter | undefined;
  declare private readonly writtenState: object | undefined;
  declare private readonly hasClass: boolean;
  declare private readonly hasStyle: boolean;

  constructor(
    keys: ReadonlySet<string>,
    props: object,
    spec: NativeElementSpec<State>,
    reactive: readonly string[],
    writeState: StateWriter | undefined,
    writtenState: object | undefined,
  ) {
    this.target = NO_ATTRIBUTES;
    this.keepUndefined = false;
    this.keys = keys;
    this.props = props as Record<string, any>;
    this.spec = spec;
    this.reactive = reactive;
    this.writeState = writeState;
    this.writtenState = writtenState;
    this.hasClass = 'class' in props;
    this.hasStyle = 'style' in props;
  }

  /** The element the effect writes to, with a fresh record of what it wrote. */
  attach(el: Element) {
    this.el = el;
    this.previous = {};
  }

  /** The attribute effect's compute: everything that can change. */
  compute(): Record<string, unknown> {
    return this.write({}, true);
  }

  /**
   * The attribute effect's apply. Solid's `assign` re-sets a string `style` as `cssText` on every
   * run (no equality check), which would wipe properties a part writes to the element directly (a
   * panel's measured CSS variables) whenever any other input changes. The slow path's per-key view
   * only re-writes `style` when its sources change, so an unchanged string style is left out.
   */
  apply(next: Record<string, unknown>) {
    const el = this.el;
    const previous = this.previous;
    const style = next.style;
    if (typeof style === 'string' && style === previous.style) {
      delete next.style;
      delete previous.style;
      assign(el, next, true, previous, true);
      previous.style = style;
      return;
    }
    assign(el, next, true, previous, true);
  }

  set(key: string, value: unknown) {
    if ((this.keepUndefined || value !== undefined) && !this.keys.has(key)) {
      this.target[key] = value;
    }
  }

  write(into: Record<string, unknown>, keepUndefined: boolean): Record<string, unknown> {
    this.target = into;
    this.keepUndefined = keepUndefined;
    const spec = this.spec;
    const source = this.props;
    this.writeState?.(this.writtenState!, this);
    spec.attributes?.(this);
    readReactiveProps(source, this.reactive, into);
    if (this.hasClass) {
      const value = resolveClass(source.class, consumerState(spec, source.class));
      if (keepUndefined || value !== undefined) {
        into.class = value;
      }
    }
    const styleOverride = spec.styleOverride;
    const partStyle = spec.partStyle;
    if (this.hasStyle || styleOverride || partStyle) {
      let value = this.hasStyle
        ? resolveStyle(source.style, consumerState(spec, source.style), partStyle?.())
        : partStyle?.();
      const override = styleOverride?.();
      if (override) {
        value = value ? combineStyle(value, override) : override;
      }
      if (keepUndefined || value !== undefined) {
        into.style = value;
      }
    }
    // The last target is not kept: the element holds no reference to a write's result.
    this.target = NO_ATTRIBUTES;
    return into;
  }
}

/**
 * The writer of an element created while hydrating, which holds its hydration state too, so the
 * element allocates one object. The first write stands for what the server rendered: the same
 * writer on the same inputs (the development check compares them). Solid writes nothing to a
 * claimed element while hydrating and only records each write as applied, so an element whose
 * effect applies again before `hydrate()` returns holds a stale value: only then does it reconcile,
 * after `hydrate()` has returned, diffing its current attributes against the first write (kept by
 * reference) instead of reading the element back. A part whose write reads a value no signal tracks
 * reconciles in any case (`reconcileAfterHydration`).
 */
class HydratingWriter<State extends object> extends ElementWriter<State> {
  declare firstWrite: Record<string, unknown> | undefined;
  declare private scheduled: boolean;
  declare private templateAttributes: Record<string, unknown>;
  declare private literal: Record<string, unknown>;
  declare private needsEffect: boolean;

  hydrate(
    templateAttributes: Record<string, unknown>,
    literal: Record<string, unknown>,
    needsEffect: boolean,
  ) {
    this.firstWrite = undefined;
    this.scheduled = false;
    this.templateAttributes = templateAttributes;
    this.literal = literal;
    this.needsEffect = needsEffect;
  }

  takeFirstWrite(written: Record<string, unknown>) {
    this.firstWrite = written;
    if (process.env.NODE_ENV !== 'production') {
      // Now, while the element still holds the server markup.
      checkHydratedAttributes(this.el, this.templateAttributes, {
        ...attributesOf(this.literal),
        ...attributesOf(written),
      });
    }
  }

  scheduleReconcile() {
    if (!this.scheduled) {
      this.scheduled = true;
      afterHydration(this.el, () => this.reconcile());
    }
  }

  override apply(next: Record<string, unknown>) {
    if (this.firstWrite === undefined) {
      this.takeFirstWrite(next);
    } else if (isHydrating()) {
      this.scheduleReconcile();
    }
    if (recordsOnly(this.el, next)) {
      // Solid writes nothing to a claimed element while hydrating and only records the write as
      // applied (the reconcile above corrects what changed): record it here, without assign's
      // per-key work.
      const previous = this.previous;
      for (const key in previous) {
        if (!(key in next)) {
          previous[key] = null;
        }
      }
      Object.assign(previous, next);
      return;
    }
    super.apply(next);
  }

  private reconcile() {
    const written = this.needsEffect ? attributesOf(untrack(() => this.write({}, true))) : {};
    const hydratedWrite = { ...attributesOf(this.literal), ...attributesOf(this.firstWrite ?? {}) };
    assign(this.el, { ...attributesOf(this.literal), ...written }, true, hydratedWrite, true);
    Object.assign(this.previous, written);
  }
}

/**
 * The classification's `wrap`: claims the keys of a spec's handler tables (bound from them) and
 * leaves the rest, cached per table pair (parts pass module-level tables).
 */
const tableWraps = new WeakMap<object, WeakMap<object, (key: string) => unknown>>();
const NO_TABLE: Readonly<Record<string, unknown>> = Object.freeze({});
function tableHandled(spec: {
  handlers?: Readonly<Record<string, unknown>> | undefined;
  handlersIfPassed?: Readonly<Record<string, unknown>> | undefined;
}) {
  const always = spec.handlers ?? NO_TABLE;
  const ifPassed = spec.handlersIfPassed ?? NO_TABLE;
  let byPassed = tableWraps.get(always);
  if (!byPassed) {
    byPassed = new WeakMap();
    tableWraps.set(always, byPassed);
  }
  let wrap = byPassed.get(ifPassed);
  if (!wrap) {
    wrap = (key: string) => (key in always || key in ifPassed ? true : undefined);
    byPassed.set(ifPassed, wrap);
  }
  return wrap;
}

function createClientWriter<State extends object>(
  props: object,
  spec: NativeElementSpec<State>,
  base?: Record<string, unknown>,
  top?: Record<string, unknown>,
  handlerFunctions = false,
  hydrating = false,
): ClientWriter {
  const source = props as Record<string, any>;
  // The tables' keys are bound below, the always-bound ones whether or not the consumer passes them.
  const consumer = classifyConsumerProps(
    props,
    spec.own,
    spec.handlers || spec.handlersIfPassed ? tableHandled(spec) : undefined,
  );
  const keys = top ? withKeys(consumer.keys, top) : consumer.keys;
  const reactive = top ? consumer.reactive.filter((key) => !(key in top)) : consumer.reactive;

  const literal: Record<string, unknown> = {};
  if (base) {
    for (const key in base) {
      if (!keys.has(key)) {
        literal[key] = base[key];
      }
    }
  }
  const partLiteral = spec.literal;
  if (partLiteral) {
    for (const key in partLiteral) {
      if (!keys.has(key)) {
        literal[key] = partLiteral[key];
      }
    }
  }
  Object.assign(literal, consumer.literal, top);
  const handlers = spec.handlers;
  const handlersIfPassed = spec.handlersIfPassed;
  if ((handlers || handlersIfPassed) && !isServer) {
    // One record for every key. A consumer's element gets plain functions: its render function
    // may call `props.onClick(event)` itself, as a React consumer's does.
    const record = new HandlerRecord(props, spec.handlerTarget);
    const bind = (key: string, dispatch: Dispatch<any>) => {
      if (!(top && key in top)) {
        literal[key] = handlerFunctions
          ? (event: Event) => dispatch(record, event)
          : [dispatch, record];
      }
    };
    if (handlers) {
      for (const key of Object.keys(handlers)) {
        bind(key, handlers[key]);
      }
    }
    if (handlersIfPassed) {
      for (const key of Object.keys(handlersIfPassed)) {
        if (consumer.keys.has(key)) {
          bind(key, handlersIfPassed[key]);
        }
      }
    }
  }

  const writeState = stateWriterOf(spec);
  const writtenState = writeState && writtenStateOf(spec);
  const hasClass = 'class' in props;
  const hasStyle = 'style' in props;
  const styleOverride = spec.styleOverride;
  const partStyle = spec.partStyle;
  const needsEffect =
    spec.reactive ||
    styleOverride !== undefined ||
    partStyle !== undefined ||
    reactive.length > 0 ||
    (hasClass && (!isStatic(props, 'class') || typeof source.class === 'function')) ||
    (hasStyle && (!isStatic(props, 'style') || typeof source.style === 'function'));

  const writer = new (hydrating ? HydratingWriter : ElementWriter)(
    keys,
    props,
    spec,
    reactive,
    writeState,
    writtenState,
  );
  return { literal, writer, needsEffect };
}

/** `keys` with `extra`'s keys added (a render config's attributes, which the part must not write). */
function withKeys(keys: ReadonlySet<string>, extra: Record<string, unknown>): ReadonlySet<string> {
  const all = new Set(keys);
  for (const key of Object.keys(extra)) {
    all.add(key);
  }
  return all;
}

function renderClientElement<State extends object>(
  element: Element | NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
  top?: Record<string, unknown>,
): Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const owner = getOwner();
  const source = props as Record<string, any>;
  const hydrating = isHydrating();
  const { literal, writer, needsEffect } = createClientWriter(
    props,
    spec,
    undefined,
    top,
    false,
    hydrating,
  );
  const consumerChildren = spec.consumerChildren !== false && 'children' in props;

  const el = isTemplate(element) ? element.create() : element;
  writer.attach(el);
  // Only an element created while hydrating has server markup to match (`HydratingWriter`). The
  // literal attributes are written once, outside the effect, and the template's own attributes are
  // never written (the compiled element carries them).
  const hydration = hydrating ? (writer as HydratingWriter<State>) : undefined;
  if (hydration) {
    hydration.hydrate(
      (isTemplate(element) && element.attributes) || NO_ATTRIBUTES,
      literal,
      needsEffect,
    );
  }

  if (!needsEffect) {
    writer.write(literal, false);
    if (hydration && process.env.NODE_ENV !== 'production') {
      hydration.takeFirstWrite({});
    }
  }
  attachNativeAttributes(el, literal, undefined, owner);
  if (needsEffect) {
    // As `attachNativeAttributes`' effect, its compute and apply the writer's methods (see
    // `ElementWriter.apply` for the one difference). Transparent: the server has no counterpart, so
    // it takes no hydration id.
    runWithOwner(owner, () =>
      createRenderEffect(writer.compute.bind(writer), writer.apply.bind(writer), {
        transparent: true,
      }),
    );
  }

  if (hydration && needsEffect && spec.reconcileAfterHydration) {
    // The effect's later writes diff against its own attributes only, as outside hydration: the
    // literal ones are written once and must not read as removed.
    hydration.scheduleReconcile();
  }

  if (source.ref != null) {
    applyRefs(el, source.ref);
  }
  const refs = spec.refs;
  if (refs && refs.length > 0) {
    const plain = applyPartRefs(el, refs);
    void onCleanup(() => {
      if (plain) {
        runWithOwner(null, () =>
          untrack(() => {
            for (const ref of refs) {
              (ref as (element: null) => void)(null);
            }
          }),
        );
      } else {
        releasePartRefs(el, ...refs);
      }
    });
  }

  if (spec.children) {
    insert(el, spec.children);
  } else if (consumerChildren) {
    if (isStatic(props, 'children')) {
      insert(el, source.children);
    } else {
      insert(el, () => source.children);
    }
  }
  return el;
}
