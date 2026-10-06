/* eslint-disable typescript/no-explicit-any -- the kit bridges arbitrary consumer props and Solid's untyped `assign`; values pass through as the props hold them */
/*
 * Native kit (plan 8): the plain functions a Solid-native part uses to render its element with
 * direct JSX instead of `useRenderElement`. Nothing here creates a reactive node of its own; the
 * part owns its one attribute effect (if any). Contract: `.kb/solid/native-parts.md`.
 */
import {
  $PROXY,
  createEffect,
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  onSettled,
  type Accessor,
  type Owner,
  isHydrating,
  isStatic,
  runWithOwner,
  untrack,
} from 'solid-js';
import { assign, createComponent, insert, isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import {
  CompositeRootContext,
  type CompositeRootContext as CompositeRootContextValue,
} from '../../internals/composite/root/CompositeRootContext';
import {
  useCompositeRoot,
  type UseCompositeRootParameters,
} from '../../internals/composite/root/useCompositeRoot';
import { MERGED_REFS, combineStyle } from '../../merge-props/mergeProps';
import { getAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { resolveClassName } from '../resolveClassName';
import { resolveStyle as resolveStyleProp } from '../resolveStyle';
import type { BaseUIEvent } from '../types';
import type { FieldRootState } from '../../field/root/FieldRoot';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  type FieldRootContext,
} from '../../field/root/FieldRootContext';
import {
  DEFAULT_LABELABLE_CONTEXT,
  type LabelableContext,
} from '../../internals/labelable-provider/LabelableContext';
import {
  useCompositeListContext,
  type CompositeListRegistration,
} from '../../internals/composite/list/CompositeListContext';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { classifyConsumerProps, composeHandler, readHandler, readReactiveProps } from './consumer';

type AnyProps = Record<string, any>;
type Handler = (...args: any[]) => unknown;

export {
  NATIVE_RESERVED_KEYS,
  classifyConsumerProps,
  composeHandler,
  isHandlerKey,
  readHandler,
  readReactiveProps,
  type ConsumerProps,
} from './consumer';

/**
 * Whether a part may render its element natively for these props. Decided once at setup from
 * static information: a client render that is not hydrating, no `render` key at all, a props object
 * that is not a Solid proxy (its key set could change), a static `ref`, and static `staticKeys`
 * (props the part reads once, as the slow path does). Anything else keeps `useRenderElement`.
 */
export function canRenderNative(props: object, staticKeys: readonly string[] = []): boolean {
  if (isServer || isHydrating()) {
    return false;
  }
  if ((props as Record<PropertyKey, unknown>)[$PROXY]) {
    return false;
  }
  if ('render' in props || !isStatic(props, 'ref')) {
    return false;
  }
  for (const key of staticKeys) {
    if (!isStatic(props, key)) {
      return false;
    }
  }
  return true;
}

/** `class` for the element: a function form receives the part's state; empty strings are no class. */
export function resolveClass<State>(
  value: string | ((state: State) => string | undefined) | undefined,
  state: State,
): string | undefined {
  return resolveClassName(value, state) || undefined;
}

/**
 * `style` for the element: a function form receives the part's state; a part style is combined
 * below the consumer's (the consumer's keys win), as the props view combines sources in order.
 */
export function resolveStyle<State>(
  value: JSX.CSSProperties | string | ((state: State) => JSX.CSSProperties | undefined) | undefined,
  state: State,
  partStyle?: JSX.CSSProperties | string | undefined,
): JSX.CSSProperties | string | undefined {
  const resolved = resolveStyleProp(value as any, state) as JSX.CSSProperties | string | undefined;
  if (partStyle && resolved) {
    return combineStyle(partStyle, resolved);
  }
  return partStyle || resolved || undefined;
}

/** A state value as its default `data-*` attribute: `''` for `true`, the string for other truthy values. */
export function stateAttr(value: unknown): string | undefined {
  if (value === true) {
    return '';
  }
  return value ? String(value) : undefined;
}

/** Flattens a ref prop (callback, `mergeProps` chain, array, object ref) into its parts. */
export function collectRefs(
  ref: unknown,
  callbacks: Set<Function>,
  objects: Set<{ current: unknown }>,
): void {
  if (typeof ref === 'function') {
    const chained = (ref as { [MERGED_REFS]?: Function[] })[MERGED_REFS];
    if (chained) {
      chained.forEach((callback) => collectRefs(callback, callbacks, objects));
    } else {
      callbacks.add(ref);
    }
  } else if (Array.isArray(ref)) {
    ref.forEach((entry) => collectRefs(entry, callbacks, objects));
  } else if (ref != null && typeof ref === 'object' && 'current' in ref) {
    objects.add(ref as { current: unknown });
  }
}

/**
 * Applies refs to the element as Solid applies refs (ownerless, untracked): each distinct callback
 * once with the element, object refs set. Callback refs are never called with `null` here.
 */
export function applyRefs(el: Element, ...refs: unknown[]): void {
  // One plain callback or object ref (the common case): no sets, no owner switch needed beyond
  // the untracked, ownerless call.
  if (refs.length === 1) {
    const ref = refs[0];
    if (typeof ref === 'function' && !(ref as { [MERGED_REFS]?: unknown })[MERGED_REFS]) {
      runWithOwner(null, () => untrack(() => ref(el)));
      return;
    }
    if (ref != null && typeof ref === 'object' && !Array.isArray(ref) && 'current' in ref) {
      (ref as { current: unknown }).current = el;
      return;
    }
  }
  const callbacks = new Set<Function>();
  const objects = new Set<{ current: unknown }>();
  refs.forEach((ref) => collectRefs(ref, callbacks, objects));
  runWithOwner(null, () =>
    untrack(() => {
      callbacks.forEach((callback) => callback(el));
      objects.forEach((ref) => {
        ref.current = el;
      });
    }),
  );
}

/**
 * React calls a part's own refs with `null` when the element unmounts and the ported hooks rely on
 * it; consumer refs keep Solid's contract. An object ref is cleared only while it still points at
 * the outgoing element.
 */
export function releasePartRefs(el: Element, ...refs: unknown[]): void {
  if (refs.length === 1) {
    const ref = refs[0];
    if (typeof ref === 'function' && !(ref as { [MERGED_REFS]?: unknown })[MERGED_REFS]) {
      runWithOwner(null, () => untrack(() => ref(null)));
      return;
    }
    if (ref != null && typeof ref === 'object' && !Array.isArray(ref) && 'current' in ref) {
      const object = ref as { current: unknown };
      if (object.current === el) {
        object.current = null;
      }
      return;
    }
  }
  const callbacks = new Set<Function>();
  const objects = new Set<{ current: unknown }>();
  refs.forEach((ref) => collectRefs(ref, callbacks, objects));
  runWithOwner(null, () =>
    untrack(() => {
      callbacks.forEach((callback) => callback(null));
      objects.forEach((ref) => {
        if (ref.current === el) {
          ref.current = null;
        }
      });
    }),
  );
}

/**
 * Writes the element's attributes: `literal` once now, and `dynamic` (when given) from one render
 * effect owned by `owner` (the part), through Solid's `assign` with its own previous-value record,
 * so attribute, property, `class`, `style` and event semantics are the runtime's. A key whose value
 * becomes `undefined` is removed. Nothing is written when the part is disposed (React leaves the
 * detached element as it was).
 */
export function attachNativeAttributes(
  el: Element,
  literal: Record<string, unknown>,
  dynamic: (() => Record<string, unknown>) | undefined,
  owner: Owner | null,
  afterApply?: () => void,
  onAttach?: () => void,
): void {
  assign(el, literal, true, {}, true);
  if (!dynamic) {
    onAttach?.();
    return;
  }
  const previous: Record<string, unknown> = {};
  let attached = false;
  runWithOwner(owner, () =>
    createRenderEffect(dynamic, (props) => {
      assign(el, props, true, previous, true);
      if (!attached) {
        // Refs are applied once the attributes are, from the render effect, as Solid applies JSX
        // refs: a ref that interacts with the element at once finds it complete.
        attached = true;
        onAttach?.();
      }
      afterApply?.();
    }),
  );
}

/**
 * The refs of a native element: the part's refs (released with `null` on dispose) and the
 * consumer's, applied together by `attachNativeAttributes`'s `onAttach`.
 */
export function elementRefs(
  el: Element,
  partRefs: readonly unknown[] | undefined,
  consumerRef: unknown,
): (() => void) | undefined {
  const hasPart = partRefs !== undefined && partRefs.length > 0;
  if (hasPart) {
    onCleanup(() => releasePartRefs(el, ...partRefs));
  }
  if (!hasPart && consumerRef == null) {
    return undefined;
  }
  return () => {
    if (hasPart) {
      applyRefs(el, ...partRefs);
    }
    if (consumerRef != null) {
      applyRefs(el, consumerRef);
    }
  };
}

/**
 * Runs the consumer's handler for `key` as the props hold it when the event fires (a part's
 * `[handler, data]` tuple handler calls this where React's `mergeProps` called the consumer).
 * Returns whether the consumer called `event.preventBaseUIHandler()`: the part's own logic then
 * stays off. The event must already be preventable (`makeEventPreventable`).
 */
export function runConsumerHandler(
  props: object,
  key: string,
  event: BaseUIEvent<Event>,
  ...rest: unknown[]
): boolean {
  const handler = readHandler(props, key);
  if (handler) {
    untrack(() => handler(event, ...rest));
  }
  return Boolean(event.baseUIHandlerPrevented);
}

/** Field state keys a Field-aware part exposes beyond its own (`FieldRootState` minus `disabled`). */
export const FIELD_STATE_KEYS = ['touched', 'dirty', 'valid', 'filled', 'focused'] as const;

/**
 * The Field `data-*` attributes of a part's state (`fieldValidityMapping` for `valid`, the default
 * mapping for the rest), written into `target`. Outside a `Field.Root` the state is constant and
 * yields no attribute, so parts call this only inside one.
 */
export function fieldStateAttributes(state: FieldRootState, target: Record<string, unknown>) {
  target['data-touched'] = stateAttr(state.touched);
  target['data-dirty'] = stateAttr(state.dirty);
  const valid = state.valid;
  target['data-valid'] = valid === true ? '' : undefined;
  target['data-invalid'] = valid === false ? '' : undefined;
  target['data-filled'] = stateAttr(state.filled);
  target['data-focused'] = stateAttr(state.focused);
  return target;
}

/**
 * The props a labelable control gets from its `LabelableProvider` (`aria-describedby`) and its
 * `Field.Root` (`aria-invalid`), as `getDescriptionProps` and `getValidationProps` add them above
 * the consumer's props: the description ids follow the consumer's `aria-describedby`; `aria-invalid`
 * is `'true'` while the field is invalid and neither it nor the control is disabled, else the
 * consumer's value. Read inside the part's attribute effect.
 */
export function fieldAttributes(
  labelable: LabelableContext,
  field: FieldRootContext,
  disabled: boolean,
  consumer: Record<string, unknown> | undefined,
  target: Record<string, unknown>,
) {
  if (labelable !== DEFAULT_LABELABLE_CONTEXT) {
    target['aria-describedby'] = labelable.describedBy(consumer?.['aria-describedby']);
  }
  if (field !== DEFAULT_FIELD_ROOT_CONTEXT) {
    target['aria-invalid'] =
      field.state.valid === false && !field.state.disabled && !disabled
        ? 'true'
        : consumer?.['aria-invalid'];
  }
  return target;
}

/** The consumer keys `fieldAttributes` computes itself: a part treats them as its own inside a Field. */
export function fieldOwnedKeys(labelable: LabelableContext, field: FieldRootContext): string[] {
  const keys: string[] = [];
  if (labelable !== DEFAULT_LABELABLE_CONTEXT) {
    keys.push('aria-describedby');
  }
  if (field !== DEFAULT_FIELD_ROOT_CONTEXT) {
    keys.push('aria-invalid');
  }
  return keys;
}

/**
 * Applies a part's own refs to its element now and calls them with `null` when the part is
 * disposed (React's unmount call, which the ported registration hooks rely on).
 */
export function attachPartRefs(el: Element, refs: readonly unknown[]): void {
  applyRefs(el, ...refs);
  onCleanup(() => releasePartRefs(el, ...refs));
}

export interface CompositeItemRegistration {
  /** The item's index in its `CompositeList` (guessed from the render order, corrected by the list). */
  index: Accessor<number>;
  /** Registers `el` with the list (a part ref: `null` is ignored); unregistered on dispose. */
  attach: (el: HTMLElement | null) => void;
}

/**
 * `useCompositeListItem` for a native part: registers the element with the surrounding
 * `CompositeList` and follows its index. The index is guessed from the render order (as
 * `IndexGuessBehavior.GuessFromOrder`), so a flat list needs no update after its first flush; the
 * list's flush corrects a wrong guess. The map subscription is made at setup (before the list's
 * first flush, as a child layout effect runs before its parent's) and removed on dispose. Only a
 * `metadata` accessor needs an effect: a changed value re-registers the element, as React
 * re-attaches the callback ref.
 */
export function createCompositeItemRegistration<Metadata>(
  metadata?: Accessor<Metadata | undefined>,
): CompositeItemRegistration {
  const { register, unregister, subscribeMapChange, nextIndexRef } = useCompositeListContext();
  const guessed = nextIndexRef.current;
  nextIndexRef.current += 1;
  const [index, setIndex] = createSignal(guessed);
  const owner = {};
  let node: HTMLElement | null = null;
  let last: CompositeListRegistration<Metadata> | null = null;

  const registration = (value: Metadata | null): CompositeListRegistration<Metadata> => ({
    metadata: value,
    index: null,
    label: undefined,
    textRef: undefined,
  });

  if (metadata) {
    createEffect(
      () => metadata() ?? null,
      (value) => {
        if (node && last && last.metadata !== value) {
          last = registration(value);
          register(node, last, owner);
        }
      },
    );
  }

  onCleanup(
    subscribeMapChange((map: Map<Element, CompositeMetadata<Metadata>>) => {
      const next = node ? map.get(node)?.index : null;
      if (next != null) {
        setIndex(next);
      }
    }),
  );
  onCleanup(() => {
    if (node) {
      unregister(node, owner);
    }
  });

  return {
    index,
    attach(el) {
      if (!el) {
        return;
      }
      node = el;
      last = registration(untrack(() => metadata?.() ?? null));
      register(el, last, owner);
    },
  };
}

export interface NativeElementSpec<State> {
  /** The element (a cloned template with its static attributes). */
  el: Element;
  /** The consumer's props. */
  props: object;
  /** The part's own prop keys (never forwarded). */
  own: ReadonlySet<string>;
  /** The part's state for `class`/`style` functions. */
  state?: State | undefined;
  /** Part attributes that never change (a consumer key wins; `undefined` values are skipped). */
  literal?: Record<string, unknown> | undefined;
  /**
   * Part attributes read inside the element's one render effect, written into `target`; `set`
   * skips keys the consumer passes. Absent when nothing of the part's can change.
   */
  dynamic?:
    | ((target: Record<string, unknown>, set: (key: string, value: unknown) => void) => void)
    | undefined;
  /** Part handlers by camel-case key, as `[handler, data]` tuples (they call the consumer themselves). */
  handlers?: Record<string, unknown> | undefined;
  /** Part refs: called with the element now and `null` on dispose. */
  partRefs?: readonly unknown[] | undefined;
  /** The children to insert: the consumer's (default), or none (`false`). */
  children?: boolean | undefined;
}

/**
 * Renders a part's element natively: literal attributes and handlers once, one render effect for
 * the part's reactive attributes, the consumer's reactive props and `class`/`style` (none when
 * nothing can change), part refs with React's `null` on dispose, the consumer's ref, children.
 */
export function renderNativeElement<State>(spec: NativeElementSpec<State>): JSX.Element {
  const { el, props, state } = spec;
  const source = props as AnyProps;
  const partHandlers = spec.handlers;
  // A tuple part handler calls the consumer itself; a plain function runs after the consumer's
  // handler (React's `mergeProps` order) unless the consumer prevented it. Keys are matched as
  // given; a consumer's other casing (`onclick`) falls back to a case-insensitive scan.
  const consumer = classifyConsumerProps(
    props,
    spec.own,
    partHandlers
      ? (key, read) => {
          let part = partHandlers[key];
          if (part === undefined) {
            const lower = key.toLowerCase();
            for (const name in partHandlers) {
              if (name.toLowerCase() === lower) {
                part = partHandlers[name];
                break;
              }
            }
          }
          return typeof part === 'function'
            ? composeHandler(read, part as (event: never) => void)
            : part;
        }
      : undefined,
  );
  const keys = consumer.keys;
  const hasKeys = keys.size > 0;
  const literal: Record<string, unknown> = {};
  const partLiteral = spec.literal;
  if (partLiteral) {
    for (const key in partLiteral) {
      const value = partLiteral[key];
      if (value !== undefined && !(hasKeys && keys.has(key))) {
        literal[key] = value;
      }
    }
  }
  if (partHandlers) {
    for (const key in partHandlers) {
      if (!hasKeys || (!keys.has(key) && !keys.has(key.toLowerCase()))) {
        literal[key] = partHandlers[key];
      }
    }
  }
  if (hasKeys) {
    Object.assign(literal, consumer.literal);
  }
  const hasClass = 'class' in props;
  const hasStyle = 'style' in props;
  const classIsStatic = !hasClass || (isStatic(props, 'class') && typeof source.class !== 'function');
  const styleIsStatic = !hasStyle || (isStatic(props, 'style') && typeof source.style !== 'function');
  if (hasClass && classIsStatic) {
    const value = resolveClass(source.class, state);
    if (value !== undefined) {
      literal.class = value;
    }
  }
  if (hasStyle && styleIsStatic) {
    const value = resolveStyle(source.style, state);
    if (value !== undefined) {
      literal.style = value;
    }
  }
  const partDynamic = spec.dynamic;
  const needsEffect =
    partDynamic !== undefined || consumer.reactive.length > 0 || !classIsStatic || !styleIsStatic;
  const dynamic = needsEffect
    ? () => {
        const target: Record<string, unknown> = {};
        if (partDynamic) {
          partDynamic(target, hasKeys ? (key, value) => {
            if (!keys.has(key)) {
              target[key] = value;
            }
          } : (key, value) => {
            target[key] = value;
          });
        }
        if (consumer.reactive.length > 0) {
          readReactiveProps(props, consumer.reactive, target);
        }
        if (!classIsStatic) {
          target.class = resolveClass(source.class, state);
        }
        if (!styleIsStatic) {
          target.style = resolveStyle(source.style, state);
        }
        return target;
      }
    : undefined;
  attachNativeAttributes(
    el,
    literal,
    dynamic,
    getOwner(),
    undefined,
    elementRefs(el, spec.partRefs, source.ref),
  );
  if (spec.children !== false && 'children' in props) {
    if (isStatic(props, 'children')) {
      insert(el, source.children);
    } else {
      insert(el, () => source.children);
    }
  }
  return el as unknown as JSX.Element;
}

export interface NativeCompositeRoot<Metadata> {
  /** The root's own handlers (`useCompositeRoot`'s props): keydown navigation, focus-in. */
  handlers: Record<string, unknown>;
  /** The root element's ref (a part ref). */
  setRootRef: (element: HTMLElement | null | undefined) => void;
  highlightedIndex: Accessor<number>;
  onMapChange: (
    map: Array<{ element: Element; metadata: Record<string, unknown> | null }>,
  ) => void;
  metadata?: Metadata;
}

/**
 * `CompositeRoot` for a native part: `useCompositeRoot`, its context and the `CompositeList` the
 * items register with, around the element `render` builds (inside both, as `CompositeRoot` renders
 * its element). `highlightItemOnHover` and `onMapChange` as the component's props.
 */
export function renderCompositeRoot<Metadata>(
  params: UseCompositeRootParameters,
  render: (root: NativeCompositeRoot<Metadata>) => JSX.Element,
  options: {
    highlightItemOnHover?: Accessor<boolean> | undefined;
    onMapChange?: NativeCompositeRoot<Metadata>['onMapChange'] | undefined;
  } = {},
): JSX.Element {
  // `CompositeRoot` stops the propagation of handled keys by default.
  const root = useCompositeRoot<Metadata>({ stopEventPropagation: true, ...params });
  const contextValue: CompositeRootContextValue = {
    highlightItemOnHover: options.highlightItemOnHover ?? (() => false),
    highlightedIndex: root.highlightedIndex,
    onHighlightedIndexChange: root.onHighlightedIndexChange,
    relayKeyboardEvent: root.relayKeyboardEvent,
  };
  const onMapChange: NativeCompositeRoot<Metadata>['onMapChange'] = (map) => {
    options.onMapChange?.(map);
    root.onMapChange(map as never);
  };
  return createComponent(CompositeRootContext as never, {
    value: contextValue,
    get children() {
      return createComponent(CompositeList as never, {
        refs: root.refs,
        onMapChange,
        get children() {
          return render({
            handlers: root.props as Record<string, unknown>,
            setRootRef: root.setRootRef,
            highlightedIndex: root.highlightedIndex,
            onMapChange,
          });
        },
      });
    },
  } as never) as JSX.Element;
}


/**
 * `useAriaLabelledBy`'s DOM fallback for a native part: when neither the prop nor a `Field.Label`
 * names the control, a wrapping or sibling `<label>` does. The lookup needs the mounted DOM: the
 * first run (the element is not inserted yet) defers to `onSettled`; later runs, from the attribute
 * effect's apply (its inputs are the effect's dependencies), look up at once.
 */
export function createLabelFallback(
  el: HTMLElement,
  labelSource: HTMLInputElement,
  explicit: () => string | false | undefined,
  labelId: () => string | undefined,
  controlId: () => string | undefined,
): () => void {
  let first = true;
  const apply = () => {
    const value = explicit();
    if ((value != null && value !== false) || labelId() != null) {
      return;
    }
    const control = controlId();
    const found = getAriaLabelledBy(labelSource, control ? `${control}-label` : undefined);
    if (found) {
      el.setAttribute('aria-labelledby', found);
    } else {
      el.removeAttribute('aria-labelledby');
    }
  };
  return () => {
    if (first) {
      first = false;
      onSettled(() => untrack(apply));
      return;
    }
    untrack(apply);
  };
}

/**
 * What a native part's module-level attribute functions read for one element: the consumer's
 * classified props, the part's model and its static-ness flags (part-defined bits). One record per
 * element replaces a closure per attribute group.
 */
export interface NativeLayout<Model> {
  m: Model;
  props: AnyProps;
  keys: ReadonlySet<string>;
  hasKeys: boolean;
  reactive: readonly string[];
  /** The consumer's literal props and handler dispatchers (assigned once, above the part's). */
  consumerLiteral: Record<string, unknown>;
  state: unknown;
  classIsStatic: boolean;
  styleIsStatic: boolean;
  flags: number;
}

/** Builds the layout: classifies the consumer's props once and resolves the `class`/`style` form. */
export function createLayout<Model>(
  props: object,
  own: ReadonlySet<string>,
  model: Model,
  state: unknown,
  wrap: (key: string, consumer: () => Handler | undefined) => unknown,
): NativeLayout<Model> {
  const consumer = classifyConsumerProps(props, own, wrap);
  const source = props as AnyProps;
  const staticProp = (key: string) => !(key in props) || isStatic(props, key);
  return {
    m: model,
    props: source,
    keys: consumer.keys,
    hasKeys: consumer.keys.size > 0,
    reactive: consumer.reactive,
    consumerLiteral: consumer.literal,
    state,
    classIsStatic: staticProp('class') && typeof source.class !== 'function',
    styleIsStatic: staticProp('style') && typeof source.style !== 'function',
    flags: 0,
  };
}

/** Whether the consumer passes `key` (any casing for a handler). */
export function consumerHas(l: NativeLayout<unknown>, key: string): boolean {
  return l.hasKeys && (l.keys.has(key) || l.keys.has(key.toLowerCase()));
}

/**
 * Writes a part attribute unless the consumer passes the key; on the literal pass (`once`) an
 * absent value is left out (a fresh element has nothing to remove).
 */
export function put(
  l: NativeLayout<unknown>,
  target: Record<string, unknown>,
  once: boolean,
  key: string,
  value: unknown,
): void {
  if ((!l.hasKeys || !l.keys.has(key)) && (!once || value !== undefined)) {
    target[key] = value;
  }
}

/** The literal pass's `class`/`style` (static forms resolved once). */
export function literalClassStyle(l: NativeLayout<unknown>, literal: Record<string, unknown>): void {
  const props = l.props;
  if (l.classIsStatic && 'class' in props) {
    const value = resolveClass(props.class, l.state);
    if (value !== undefined) {
      literal.class = value;
    }
  }
  if (l.styleIsStatic && 'style' in props) {
    const value = resolveStyle(props.style, l.state);
    if (value !== undefined) {
      literal.style = value;
    }
  }
}

/** The dynamic pass's tail: the consumer's reactive keys, then `class`/`style` when they can change. */
export function finishAttributes(l: NativeLayout<unknown>, target: Record<string, unknown>): Record<string, unknown> {
  const props = l.props;
  if (l.reactive.length > 0) {
    readReactiveProps(props, l.reactive, target);
  }
  if (!l.classIsStatic) {
    target.class = resolveClass(props.class, l.state);
  }
  if (!l.styleIsStatic) {
    target.style = resolveStyle(props.style, l.state);
  }
  return target;
}

/**
 * A native part's element, created in the document (not cloned from a `<template>`: a clone lives
 * in the template's inert document until it is inserted, so an event dispatched on it before
 * then has no window). `attributes` are the static ones.
 */
export function createNativeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attributes) {
    for (const key in attributes) {
      el.setAttribute(key, attributes[key]);
    }
  }
  return el;
}
