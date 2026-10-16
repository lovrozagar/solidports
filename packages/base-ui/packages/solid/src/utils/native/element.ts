/*
 * Native element renderer: the one routine a Solid-native part runs to turn an element it created
 * with direct JSX into its rendered element. It generalizes the Button pilot: literal attributes
 * once, one owned render effect for everything that can change, handlers composed in React's
 * order, part refs with `null` on unmount, children inserted directly.
 * Contract: `context/architecture/render-pipeline.md`. Nothing here creates a reactive node beyond
 * the one attribute effect (when needed) and the children insert.
 */
import {
  createRenderEffect,
  getOwner,
  isHydrating,
  isStatic,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js';
import { assign, insert, isServer, ssrElement } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { MERGED_REFS, combineStyle } from '../../merge-props/mergeProps';
import type { StateAttributesMapping } from '../getStateAttributesProps';
import {
  applyRefs,
  attachNativeAttributes,
  classifyConsumerProps,
  readReactiveProps,
  releasePartRefs,
  resolveClass,
  resolveStyle,
} from './index';

type Handler = (...args: any[]) => unknown;

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
export type SetAttribute = (key: string, value: unknown) => void;

export interface NativeElementSpec<State extends object> {
  /** The part's own props: never forwarded to the element. */
  own: ReadonlySet<string>;
  /**
   * The part's state: `class`/`style` functions receive it and, unless `stateAttributes` is
   * `false`, every key becomes a `data-*` attribute as `getStateAttributesProps` maps it.
   */
  state?: State | undefined;
  mapping?: StateAttributesMapping<State> | undefined;
  stateAttributes?: boolean | undefined;
  /** Literal part attributes (`role`, …), written once below `attributes`. */
  literal?: Record<string, unknown> | undefined;
  /** The part's attributes that follow reactive sources; runs inside the attribute effect. */
  attributes?: ((set: SetAttribute) => void) | undefined;
  /** Whether the state or the part attributes can change (an attribute effect is created). */
  reactive: boolean;
  /**
   * Composes a handler key the part takes part in: `read` resolves the consumer's handler at
   * event time (`undefined` when the consumer has none). Returns `undefined` for keys the part
   * leaves alone.
   */
  wrapHandler?:
    | ((key: string, read: (() => Handler | undefined) | undefined) => Handler | undefined)
    | undefined;
  /** Handler keys the part needs even when the consumer passes none. */
  handlerKeys?: readonly string[] | undefined;
  /** A part style combined below the consumer's (the consumer's keys win), e.g. measured CSS variables. */
  partStyle?: (() => JSX.CSSProperties | undefined) | undefined;
  /** A part style combined above the consumer's (its keys win), e.g. a temporary `animation-name`. */
  styleOverride?: (() => JSX.CSSProperties | undefined) | undefined;
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
          set(attribute, custom[attribute]);
        }
      }
      continue;
    }
    if (value === true) {
      set(`data-${key.toLowerCase()}`, '');
    } else if (value) {
      set(`data-${key.toLowerCase()}`, String(value));
    }
  }
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

/** An element's attributes as the server rendered them (hydration keys aside). */
function readServerAttributes(el: Element): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const name of el.getAttributeNames()) {
    if (name !== '_hk' && name !== 'data-hk') {
      attributes.set(name, el.getAttribute(name)!);
    }
  }
  return attributes;
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
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const owner = getOwner();
  const source = props as Record<string, any>;
  const wrap = spec.wrapHandler;
  const consumer = classifyConsumerProps(props, spec.own, wrap);
  const keys = consumer.keys;

  const literal: Record<string, unknown> = {};
  const partLiteral = spec.literal;
  if (partLiteral) {
    for (const key in partLiteral) {
      if (!keys.has(key)) {
        literal[key] = partLiteral[key];
      }
    }
  }
  Object.assign(literal, consumer.literal);
  if (wrap && spec.handlerKeys) {
    for (const key of spec.handlerKeys) {
      if (!keys.has(key)) {
        const handler = wrap(key, undefined);
        if (handler) {
          literal[key] = handler;
        }
      }
    }
  }

  const state = spec.state;
  const hasClass = 'class' in props;
  const hasStyle = 'style' in props;
  const styleOverride = spec.styleOverride;
  const partStyle = spec.partStyle;
  const needsEffect =
    spec.reactive ||
    styleOverride !== undefined ||
    partStyle !== undefined ||
    consumer.reactive.length > 0 ||
    (hasClass && (!isStatic(props, 'class') || typeof source.class === 'function')) ||
    (hasStyle && (!isStatic(props, 'style') || typeof source.style === 'function'));

  // The writers are created once per element; `target` is the object being written.
  let target: Record<string, unknown> = literal;
  const setKeep: SetAttribute = (key, value) => {
    if (!keys.has(key)) {
      target[key] = value;
    }
  };
  const setDefined: SetAttribute = (key, value) => {
    if (value !== undefined && !keys.has(key)) {
      target[key] = value;
    }
  };
  const write = (into: Record<string, unknown>, keepUndefined: boolean) => {
    target = into;
    const set = keepUndefined ? setKeep : setDefined;
    if (state && spec.stateAttributes !== false) {
      writeStateAttributes(state, spec.mapping, set);
    }
    spec.attributes?.(set);
    readReactiveProps(props, consumer.reactive, target);
    if (hasClass) {
      const value = resolveClass(source.class, state);
      if (keepUndefined || value !== undefined) {
        target.class = value;
      }
    }
    if (hasStyle || styleOverride || partStyle) {
      let value = hasStyle ? resolveStyle(source.style, state, partStyle?.()) : partStyle?.();
      const override = styleOverride?.();
      if (override) {
        value = value ? combineStyle(value, override) : override;
      }
      if (keepUndefined || value !== undefined) {
        target.style = value;
      }
    }
    return target;
  };

  const consumerChildren = spec.consumerChildren !== false && 'children' in props;

  if (isServer) {
    // One pass, as the client's first write: the same attributes, no handlers, refs or effect.
    // `ssrElement` prints the hydration key the client's compiled template claims.
    if (!isTemplate(element)) {
      throw new Error(
        'Base UI: a native part rendered on the server needs an element template ({ tag, create }), not an element. Pass a template so the server can render the tag.',
      );
    }
    const attributes: Record<string, unknown> = { ...element.attributes };
    for (const key in literal) {
      if (key !== 'ref' && typeof literal[key] !== 'function' && !isHandlerKey(key)) {
        attributes[key] = literal[key];
      }
    }
    write(attributes, false);
    let children: unknown;
    if (spec.children) {
      children = spec.children;
    } else if (consumerChildren) {
      children = isStatic(props, 'children') ? source.children : () => source.children;
    }
    return ssrElement(element.tag, attributes, children as never, true) as unknown as Element;
  }

  const el = isTemplate(element) ? element.create() : element;
  const hydrating = isHydrating();
  // The server's attributes as claimed, to remove the ones the client no longer renders once
  // hydration is over (see the reconcile below).
  const serverAttributes = hydrating ? readServerAttributes(el) : undefined;

  if (!needsEffect) {
    write(literal, false);
  }
  attachNativeAttributes(el, literal, undefined, owner);
  const previous: Record<string, unknown> = {};
  if (needsEffect) {
    // As `attachNativeAttributes`' effect, with one difference: Solid's `assign` re-sets a string
    // `style` as `cssText` on every run (no equality check), which would wipe properties a part
    // writes to the element directly (a panel's measured CSS variables) whenever any other input
    // changes. The slow path's per-key view only re-writes `style` when its sources change, so an
    // unchanged string style is left out of the write here.
    // Transparent: the server has no counterpart, so it takes no hydration id.
    runWithOwner(owner, () =>
      createRenderEffect(
        () => write({}, true),
        (next) => {
          const style = next.style;
          if (typeof style === 'string' && style === previous.style) {
            delete next.style;
            delete previous.style;
            assign(el, next, true, previous, true);
            previous.style = style;
            return;
          }
          assign(el, next, true, previous, true);
        },
        { transparent: true },
      ),
    );
  }

  if (serverAttributes) {
    // Solid skips attribute writes for the whole synchronous `hydrate()` call (it trusts the server
    // markup) but records them as applied, so a value that differs from the server's, or changed
    // inside that call, would be lost. A microtask runs once `hydrate()` has returned: re-apply the
    // current attributes then, and remove server attributes the client no longer renders (only
    // those still holding their server value). Handlers attached during hydration stay.
    let disposed = false;
    void onCleanup(() => {
      disposed = true;
    });
    queueMicrotask(() => {
      if (disposed) {
        return;
      }
      const all = untrack(() => (needsEffect ? write({}, true) : literal));
      const current: Record<string, unknown> = {};
      for (const key in all) {
        if (
          key !== 'ref' &&
          key !== 'children' &&
          !isHandlerKey(key) &&
          typeof all[key] !== 'function'
        ) {
          current[key] = all[key];
        }
      }
      const rendered = new Set(Object.keys(current).map((key) => key.toLowerCase()));
      const stale: Record<string, unknown> = {};
      for (const [name, value] of serverAttributes) {
        if (!rendered.has(name) && el.getAttribute(name) === value) {
          stale[name] = value;
        }
      }
      assign(el, current, true, stale, true);
      Object.assign(previous, current);
    });
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
