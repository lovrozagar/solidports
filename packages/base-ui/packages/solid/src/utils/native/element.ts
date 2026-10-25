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
  isHydrating,
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
import { HandlerRecord, isHandlerKey as isConsumerHandlerKey, isStaticKey } from './consumer';
import type { Dispatch } from './consumer';
import { serverElement } from './serverElement';
import { afterHydration, attributesOf, checkHydratedAttributes } from './hydrationState';
import {
  clientFormStateAttributes,
  isFormControl,
  releaseFormStateAttributes,
} from '../releaseServerFormState';
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
   * factory is called on first use with `handlerTarget`, so a part whose consumer passes no function
   * never builds it, and a module-level factory reads it from the target.
   */
  state?: State | ((target: any) => State) | undefined;
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
  /**
   * The part's attributes that follow reactive sources; runs inside the attribute effect, with
   * `handlerTarget`, so a part passes a module-level function and no closure per element.
   */
  attributes?: ((set: SetAttribute, target: any) => void) | undefined;
  /**
   * Attributes of a second props source that win over the consumer's (as a props source merged to
   * the consumer's right does), with `handlerTarget`; runs inside the attribute effect. A key it
   * stops setting gets the consumer's value back, or the part's own, or is removed. Not `class` or
   * `style` (`styleOverride` is the style's).
   */
  attributeOverrides?: ((set: SetAttribute, target: any) => void) | undefined;
  /**
   * Form-state attributes only the server renderer writes (a control's current value, which the
   * client holds as a property: an OTP slot's character), with `handlerTarget`. Never written on
   * the client; a hydrating control releases them once `hydrate()` returns
   * (`releaseFormStateAttributes`), as a client render has none. Only `value`, `checked` or
   * `selected`.
   */
  serverFormState?: ((set: SetAttribute, target: any) => void) | undefined;
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
  /**
   * The part's dispatch for any other handler key (module-level, one per key): it binds every
   * consumer handler key the tables do not, and every handler key `attributeOverrides` sets, so a
   * second props source's handler runs in the part's order beside the consumer's. An override's
   * handler key is never written as a listener of its own.
   */
  handlerFor?: ((key: string) => Dispatch<any>) | undefined;
  /**
   * What `handlers`, `attributes` and a `state` factory act on: the part's model, the same object
   * for every key.
   */
  handlerTarget?: unknown;
  /** A part style combined below the consumer's (the consumer's keys win), e.g. measured CSS variables. */
  partStyle?: (() => JSX.CSSProperties | undefined) | undefined;
  /** A part style combined above the consumer's (its keys win), e.g. a temporary `animation-name`. */
  styleOverride?: (() => JSX.CSSProperties | undefined) | undefined;
  /**
   * A part class combined after the consumer's (`consumer part`), as the slow path's merge puts a
   * props source's class beside the consumer's, e.g. a toast's `actionProps.class`.
   */
  partClass?: (() => string | undefined) | undefined;
  /**
   * The part's write reads a value no signal tracks (a measured animation type), which can change
   * while hydrating without re-running the attribute effect: reconcile after hydration in any case.
   * Other parts reconcile only when their effect applied again while hydrating.
   */
  reconcileAfterHydration?: boolean | undefined;
  /**
   * Attributes the part's prehydration script may set or remove on the server's element before
   * hydration (an indicator's position and `hidden`). The development check of the server's
   * attributes skips them: the element no longer holds the server's markup there. Writes diff
   * them against what the element holds, not the server's record (a `style`, once the client has
   * one, is written whole), and the element reconciles them once `hydrate()` returns, so a value
   * the client computes as the server did still undoes the script's.
   */
  scriptedAttributes?: readonly string[] | undefined;
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
        for (const attribute in custom) {
          if (Object.hasOwn(custom, attribute)) {
            set.set(attribute, custom[attribute]);
          }
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

/**
 * The current element write: a number every write (client or server) takes anew, so a state view
 * can reuse a value it read earlier in the same write and never across writes.
 */
let writePass = 0;
export const currentWritePass = () => writePass;

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
          // `for…in` over the mapper's plain object: no key array per write.
          for (const attribute in custom) {
            if (Object.hasOwn(custom, attribute)) {
              set.set(attribute, custom[attribute]);
            }
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
  // A class instance's own fields are not its state (its accessors live on the prototype): mapped
  // as state, they render as stray `data-*` attributes. Checked once per call; the writer is cached
  // per shape below.
  const prototype = Object.getPrototypeOf(state);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(
      'Base UI: A native part passed a class instance as its state without a `stateWriter`. ' +
        "The default writer maps the state's own keys to `data-*` attributes, which for a class " +
        "instance are its fields, not its state. Pass the part's `compileStateWriter(keys)` as " +
        '`stateWriter` with the instance as `stateView`.',
    );
  }
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

// The element and refs `applyPartRefs` hands to its module-level runners.
let refsElement: Element | undefined;
let pendingRefs: readonly unknown[] | undefined;

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
  // The element and its refs go to module-level runners, so no closure is made per element; saved
  // and restored around the call, in case a ref renders another part.
  const previousElement = refsElement;
  const previousRefs = pendingRefs;
  refsElement = el;
  pendingRefs = refs;
  try {
    runWithOwner(null, untrackedPartRefs);
  } finally {
    refsElement = previousElement;
    pendingRefs = previousRefs;
  }
  return true;
}

function callPartRefs() {
  const el = refsElement!;
  for (const ref of pendingRefs!) {
    (ref as (element: Element) => void)(el);
  }
}

function untrackedPartRefs() {
  untrack(callPartRefs);
}

/** Form controls, whose properties (`value`, `checked`) Solid writes apart from attributes. */
const STATEFUL_TAGS: ReadonlySet<string> = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'OPTION']);

/**
 * The element properties Solid's `assignProp` re-sets on every write, unchanged or not (its
 * `DOMWithState` entries marked 1): the element's own state (typed text, a toggled box) can drift
 * from the last write.
 */
const RESET_EVERY_WRITE: Readonly<Record<string, Readonly<Record<string, true>>>> = {
  INPUT: { value: true, checked: true },
  SELECT: { value: true },
  OPTION: { value: true, selected: true },
  TEXTAREA: { value: true },
  VIDEO: { muted: true },
  AUDIO: { muted: true },
};
const NO_RESETS: Readonly<Record<string, true>> = Object.freeze({});

/**
 * A diffing run's change, kept on its element for the `apply` that follows (Solid runs other
 * effects' computes between one effect's compute and its apply): the changed keys, their previous
 * values, how many of them are new, and the held keys the run dropped. Only a run that changes
 * something allocates one.
 */
class PendingChange {
  declare changed: Record<string, unknown>;
  declare before: Record<string, unknown>;
  declare added: number;
  declare dropped: string[] | undefined;

  constructor() {
    this.changed = {};
    this.before = {};
    this.added = 0;
    this.dropped = undefined;
  }
}

/*
 * The diffing run in progress, at module level so an element keeps none of it: one compute at a
 * time (an attribute effect's compute never runs inside another's; development asserts it). The
 * run's token marks each attribute name's first write (`lastWritten`), with no record per element.
 */
const lastWritten = new Map<string, number>();
let writeRun = 0;
let runWriter: object | undefined;
let runChange: PendingChange | undefined;
let runMatched = 0;
let runResets: Readonly<Record<string, true>> = NO_RESETS;

/** The running diff's change, created on its first changed or dropped key. */
function currentChange(): PendingChange {
  if (runChange === undefined) {
    runChange = new PendingChange();
  }
  return runChange;
}

/**
 * Starts `writer`'s diffing run. A run inside another would overwrite the other's state, in any
 * build, so it throws.
 */
function beginRun(writer: object, el: Element) {
  if (runWriter !== undefined) {
    throw new Error(
      'Base UI: a native element wrote its attributes while another element was writing. ' +
        'The diffing write keeps its run at module level and needs one run at a time.',
    );
  }
  writeRun += 1;
  runWriter = writer;
  runChange = undefined;
  runMatched = 0;
  runResets = RESET_EVERY_WRITE[el.nodeName] ?? NO_RESETS;
}

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

/** A style no property of which was written: Solid's style writer copies it, never changes it. */
const EMPTY_STYLE: Readonly<Record<string, string>> = Object.freeze({});

/** The part's state for consumer functions, created on first use from a factory and kept. */
function partState<State extends object>(spec: NativeElementSpec<State>): State | undefined {
  const state = spec.state;
  if (typeof state === 'function') {
    // The spec is the element's own object: the created state replaces its factory.
    const created = (state as (target: unknown) => State)(spec.handlerTarget);
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

/** The keys the element's `attributeOverrides` set this write, which its other writes skip. */
let serverOverrides: Record<string, unknown> | undefined;

const setServerAttribute: SetAttribute = {
  set(key, value) {
    if (
      value == null ||
      serverKeys.has(key) ||
      (serverOverrides !== undefined && key in serverOverrides)
    ) {
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
 * A consumer key that names an attribute in another case (`tabIndex` for `tabindex`) is that
 * attribute, as on the client, where the runtime sets it through the property: it replaces a
 * template or part literal attribute of that name in the server's attribute object, and the
 * part's own writes skip it. Returns the keys the part's writes skip: `keys`, plus each such
 * key's lowercase name.
 */
function claimCaseVariants(keys: ReadonlySet<string>): ReadonlySet<string> {
  let claimed: Set<string> | undefined;
  for (const key of keys) {
    if (isHandlerKey(key)) {
      continue;
    }
    const lower = key.toLowerCase();
    if (lower === key || keys.has(lower)) {
      continue;
    }
    if (lower in serverObject) {
      delete ownServerObject()[lower];
    }
    (claimed ??= new Set(keys)).add(lower);
  }
  return claimed ?? keys;
}

/** A consumer's class with a part's after it, as the slow path's merge combines them. */
function combineClass(consumer: unknown, part: string | undefined): unknown {
  if (part === undefined || part === '') {
    return consumer;
  }
  return consumer === undefined || consumer === '' ? part : `${consumer} ${part}`;
}

/** Collects a part's `attributeOverrides` into one record (undefined values dropped). */
class OverrideCollector implements SetAttribute {
  declare record: Record<string, unknown> | undefined;

  set(key: string, value: unknown) {
    if (value !== undefined) {
      (this.record ??= {})[key] = value;
    }
  }
}

const overrideCollector = new OverrideCollector();

/** The record `spec`'s overrides set now, or undefined when they set none. */
function collectOverrides<State extends object>(
  spec: NativeElementSpec<State>,
): Record<string, unknown> | undefined {
  const collect = spec.attributeOverrides;
  if (collect === undefined) {
    return undefined;
  }
  overrideCollector.record = undefined;
  collect(overrideCollector, spec.handlerTarget);
  const record = overrideCollector.record;
  overrideCollector.record = undefined;
  return record;
}

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
  const consumer = classifyConsumerProps(
    props,
    spec.own,
    undefined,
    spec.attributeOverrides !== undefined,
  );
  const keys = top ? withKeys(consumer.keys, top) : consumer.keys;
  const reactive = top ? keysNotIn(consumer.reactive, top) : consumer.reactive;

  const previousObject = serverObject;
  const previousShared = serverObjectShared;
  const previousKeys = serverKeys;
  const previousOverrides = serverOverrides;
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
    serverKeys = claimCaseVariants(keys);

    writePass += 1;
    // The overrides first, so the part's own writes skip their keys; written last, over the
    // consumer's values.
    serverOverrides = collectOverrides(spec);
    stateWriterOf(spec)?.(writtenStateOf(spec), setServerAttribute);
    spec.attributes?.(setServerAttribute, spec.handlerTarget);
    spec.serverFormState?.(setServerAttribute, spec.handlerTarget);
    const overrides = serverOverrides;
    if (overrides !== undefined) {
      for (const key in overrides) {
        if (isServerAttribute(key, overrides[key])) {
          ownServerObject()[key] = overrides[key];
        }
      }
    }

    const partClass = spec.partClass?.();
    if ('class' in props || partClass !== undefined) {
      const value = combineClass(
        'class' in props
          ? resolveClass(source.class, consumerState(spec, source.class))
          : undefined,
        partClass,
      );
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
    serverOverrides = previousOverrides;
  }

  let children: unknown;
  // Escaped as compiled JSX escapes a child expression: `ssrElement` writes the children it is
  // given as they are, so text with markup characters would become markup.
  if (spec.children) {
    children = escape(spec.children);
  } else if (spec.consumerChildren !== false && 'children' in props) {
    children = isStaticKey(props, 'children')
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

/** A template attribute's other spelling a consumer may pass. */
const CASE_VARIANTS: Readonly<Record<string, string>> = { tabindex: 'tabIndex' };

/** Whether the consumer passes a key a template's literal attributes hold, in either spelling. */
function passesTemplateAttribute(props: object, attributes: Record<string, unknown>): boolean {
  // eslint-disable-next-line guard-for-in -- a template's own attribute record
  for (const key in attributes) {
    if (key in props) {
      return true;
    }
    const variant = CASE_VARIANTS[key];
    if (variant !== undefined && variant in props) {
      return true;
    }
  }
  return false;
}

/** A template with no literal attributes, for `tagTemplate`. */
const BARE: NativeElementTemplate = { tag: '', attributes: undefined, create: () => null as never };

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
  if (isTemplate(element) && element.attributes && passesTemplateAttribute(props, element.attributes)) {
    // The consumer's value for a template attribute wins, even `undefined` (which removes it, as on
    // the slow path): the element comes from its bare tag, the template's other literals become
    // part literals, below the consumer's props.
    spec = { ...spec, literal: { ...element.attributes, ...spec.literal } };
    element = tagTemplate(element.tag, BARE);
  }
  if ('render' in props && !isStaticKey(props, 'render')) {
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
  const writer = createClientWriter(props, spec, template.attributes, top, true);
  const literal = writer.literal;
  const needsEffect = writer.needsEffect;
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
    if (isStaticKey(props, 'children')) {
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
 * The client's attribute writer for one element (`createClientWriter`). `write` writes everything
 * that can change into the object it is given; `set`, which parts call, writes into that object
 * the keys the consumer does not set, `undefined` values only when `keepUndefined` (the effect's
 * writes, which remove an attribute) and not in the literal pass. Solid: both are methods on the
 * prototype and the inputs are fields, so an element allocates one object, not closures and the
 * scope they would keep.
 */
class ElementWriter<State extends object> implements SetAttribute {
  /**
   * The attributes written once, and whether anything can change (an attribute effect is needed):
   * set by `createClientWriter`. Shared by the part's own element and a consumer's element.
   */
  declare literal: Record<string, unknown>;
  declare needsEffect: boolean;
  /** The element and the attributes its effect last wrote (`attach`); unset on a consumer's element. */
  declare protected el: Element;
  declare protected previous: Record<string, unknown>;
  declare private target: Record<string, unknown>;
  /**
   * What `compute` kept for the `apply` that follows it: a whole record, or a diffing run's change
   * (none when the run changed nothing).
   */
  declare private pending: Record<string, unknown> | PendingChange | undefined;
  declare private runs: number;
  declare private keepUndefined: boolean;
  declare private readonly keys: ReadonlySet<string>;
  declare private readonly props: Record<string, any>;
  declare private readonly spec: NativeElementSpec<State>;
  declare private readonly reactive: readonly string[];
  declare private readonly writeState: StateWriter | undefined;
  declare private readonly writtenState: object | undefined;
  declare private readonly hasClass: boolean;
  declare private readonly hasStyle: boolean;
  /** The keys `attributeOverrides` set in the current write (only while it writes). */
  declare private overrides: Record<string, unknown> | undefined;
  /** With `handlerFor`: the element's handler record, and the listeners bound for override keys. */
  declare handlerRecord: HandlerRecord | undefined;
  declare private overrideHandlers: Record<string, unknown> | undefined;
  /**
   * How many keys `previous` holds. A diffing run that wrote fewer of them than are held dropped
   * one, the only run that walks `previous`.
   */
  declare private held: number;

  constructor(
    keys: ReadonlySet<string>,
    props: object,
    spec: NativeElementSpec<State>,
    reactive: readonly string[],
    writeState: StateWriter | undefined,
    writtenState: object | undefined,
  ) {
    this.target = NO_ATTRIBUTES;
    this.pending = undefined;
    this.runs = 0;
    this.keepUndefined = false;
    this.keys = keys;
    this.props = props as Record<string, any>;
    this.spec = spec;
    this.reactive = reactive;
    this.writeState = writeState;
    this.writtenState = writtenState;
    this.hasClass = 'class' in props;
    this.hasStyle = 'style' in props;
    this.overrides = undefined;
    this.handlerRecord = undefined;
    this.overrideHandlers = undefined;
    this.held = 0;
  }

  /**
   * An override's handler key: nothing to write when the element's literal handlers already
   * dispatch it (the dispatch reads the override when the event fires), else the part's dispatch
   * for it, the same value every run so the listener is bound once and removed when the key goes.
   */
  private putOverrideHandler(key: string) {
    if (key in this.literal) {
      return;
    }
    if (this.overrideHandlers === undefined) {
      this.overrideHandlers = {};
    }
    const bound = this.overrideHandlers;
    // Bound already: Solid's `assign` holds its own wrapper for an event key, so the diff cannot
    // tell the same listener apart. Count the key as written this run (so it is not removed) and
    // write nothing.
    if (bound[key] !== undefined && runWriter === this && key in this.previous) {
      this.markWritten(key);
      return;
    }
    if (bound[key] === undefined) {
      bound[key] = [this.spec.handlerFor!(key), this.handlerRecord];
    }
    this.put(key, bound[key]);
  }

  /** A diffing run's bookkeeping for a key it keeps as it is. */
  private markWritten(key: string) {
    if (lastWritten.get(key) !== writeRun) {
      lastWritten.set(key, writeRun);
      if (key in this.previous) {
        runMatched += 1;
      }
    }
  }

  /** The element the effect writes to, with a fresh record of what it wrote. */
  attach(el: Element) {
    this.el = el;
    this.previous = {};
  }

  /**
   * Whether a run writes the whole record (`applyWrite`) instead of diffing as it writes: the first
   * run, which holds nothing to diff against, so every key would be a change.
   */
  protected writesWholeRecord(): boolean {
    return this.runs === 1;
  }

  /**
   * The attribute effect's compute: writes everything that can change, keeping for `apply` only
   * what differs from what the element holds (Solid's `assign` received the whole record, and each
   * re-run for one changed input cost a fresh record and two `for…in` passes over it), and returns
   * the run's number. A primitive, so the runtime does not check the result for a promise or an
   * async iterator, which it does for an object through a closure per run. A new number each run,
   * so every run applies.
   */
  compute(): number {
    this.runs += 1;
    if (this.writesWholeRecord()) {
      this.pending = this.write({}, true);
      return this.runs;
    }
    beginRun(this, this.el);
    try {
      this.write(NO_ATTRIBUTES, true);
      if (runMatched < this.held) {
        this.dropKeys();
      }
      this.pending = runChange;
    } finally {
      runWriter = undefined;
      runChange = undefined;
    }
    return this.runs;
  }

  /**
   * The held keys this run did not write: removed, as `assign` removes a key missing from its
   * record, and no longer held.
   */
  private dropKeys() {
    const previous = this.previous;
    for (const key in previous) {
      if (Object.hasOwn(previous, key) && lastWritten.get(key) !== writeRun) {
        if (previous[key] != null) {
          this.keepChange(key, null);
        }
        const change = currentChange();
        (change.dropped ??= []).push(key);
      }
    }
  }

  /** The attribute effect's apply: writes what the run before it kept. */
  apply() {
    const pending = this.pending;
    if (pending === undefined) {
      return;
    }
    this.pending = undefined;
    if (!(pending instanceof PendingChange)) {
      this.applyWrite(pending);
      this.countHeld();
      return;
    }
    const before = pending.before;
    // `assign` writes each key's applied value back into `before`, which then joins `previous`.
    assign(this.el, pending.changed, true, before, true);
    const dropped = pending.dropped;
    if (pending.added === 0 && dropped === undefined) {
      const previous = this.previous;
      for (const key in before) {
        if (Object.hasOwn(before, key)) {
          previous[key] = before[key];
        }
      }
      return;
    }
    // A run that adds or drops keys builds a fresh record, as a whole-record write does: adding to
    // and deleting from the held one in place leaves it larger for the element's whole life.
    const previous = this.previous;
    const next: Record<string, unknown> = {};
    for (const key in previous) {
      if (Object.hasOwn(previous, key) && !dropped?.includes(key)) {
        next[key] = Object.hasOwn(before, key) ? before[key] : previous[key];
      }
    }
    for (const key in before) {
      if (Object.hasOwn(before, key) && !Object.hasOwn(next, key) && !dropped?.includes(key)) {
        next[key] = before[key];
      }
    }
    this.previous = next;
    this.held += pending.added - (dropped?.length ?? 0);
  }

  /** Counts the keys a whole-record write left in `previous`, for the diffing runs after it. */
  protected countHeld() {
    let held = 0;
    for (const key in this.previous) {
      if (Object.hasOwn(this.previous, key)) {
        held += 1;
      }
    }
    this.held = held;
  }

  /**
   * One key of a diffing run. It changed when its value is not the one the element holds, as
   * `assignProp` skips an unchanged value, except where Solid writes it anyway: a property it
   * re-sets every write, and an object `class` or `style`, which it diffs against what it applied
   * (so an object mutated in place still writes). A key written twice in a run keeps the last value.
   */
  private diff(key: string, value: unknown) {
    if (lastWritten.get(key) !== writeRun) {
      lastWritten.set(key, writeRun);
      if (key in this.previous) {
        runMatched += 1;
      }
    }
    const changed = runChange?.changed;
    if (changed !== undefined && key in changed) {
      changed[key] = value;
      return;
    }
    if (
      value !== this.previous[key] ||
      runResets[key] === true ||
      ((key === 'class' || key === 'style') && value !== null && typeof value === 'object')
    ) {
      this.keepChange(key, value);
    }
  }

  private keepChange(key: string, value: unknown) {
    const change = currentChange();
    if (!(key in this.previous)) {
      change.added += 1;
    }
    change.changed[key] = value;
    change.before[key] = this.previous[key];
  }

  /** One key of a write: diffed in this element's diffing run, else written into the record. */
  private put(key: string, value: unknown) {
    if (runWriter === this) {
      this.diff(key, value);
    } else {
      this.target[key] = value;
    }
  }

  /**
   * Writes a record to the element. Solid's `assign` re-sets a string `style` as `cssText` on every
   * run (no equality check), which would wipe properties a part writes to the element directly (a
   * panel's measured CSS variables) whenever any other input changes. The slow path's per-key view
   * only re-writes `style` when its sources change, so an unchanged string style is left out.
   */
  protected applyWrite(next: Record<string, unknown>) {
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
    if (
      (this.keepUndefined || value !== undefined) &&
      !this.keys.has(key) &&
      (this.overrides === undefined || !(key in this.overrides))
    ) {
      this.put(key, value);
    }
  }

  write(into: Record<string, unknown>, keepUndefined: boolean): Record<string, unknown> {
    writePass += 1;
    this.target = into;
    this.keepUndefined = keepUndefined;
    const spec = this.spec;
    const source = this.props;
    // The overrides first: the part's own writes and the consumer's keys skip theirs.
    const overrides = collectOverrides(spec);
    this.overrides = overrides;
    this.writeState?.(this.writtenState!, this);
    spec.attributes?.(this, spec.handlerTarget);
    if (overrides !== undefined) {
      const reactive = this.reactive;
      for (let i = 0; i < reactive.length; i += 1) {
        const key = reactive[i];
        if (!(key in overrides)) {
          const value = source[key];
          if (runWriter === this) {
            this.diff(key, value);
          } else {
            into[key] = value;
          }
        }
      }
      for (const key in overrides) {
        if (Object.hasOwn(overrides, key)) {
          if (this.handlerRecord !== undefined && isConsumerHandlerKey(key)) {
            this.putOverrideHandler(key);
          } else {
            this.put(key, overrides[key]);
          }
        }
      }
      this.overrides = undefined;
    } else if (runWriter === this) {
      const reactive = this.reactive;
      for (let i = 0; i < reactive.length; i += 1) {
        this.diff(reactive[i], source[reactive[i]]);
      }
    } else {
      readReactiveProps(source, this.reactive, into);
    }
    const partClass = spec.partClass?.();
    if (this.hasClass || partClass !== undefined) {
      const value = combineClass(
        this.hasClass ? resolveClass(source.class, consumerState(spec, source.class)) : undefined,
        partClass,
      );
      if (keepUndefined || value !== undefined) {
        this.put('class', value);
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
        this.put('style', value);
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
  declare private scriptedAttributes: readonly string[] | undefined;

  hydrate(
    templateAttributes: Record<string, unknown>,
    scriptedAttributes: readonly string[] | undefined,
  ) {
    this.firstWrite = undefined;
    this.scheduled = false;
    this.templateAttributes = templateAttributes;
    this.scriptedAttributes = scriptedAttributes;
  }

  takeFirstWrite(written: Record<string, unknown>) {
    this.firstWrite = written;
    const el = this.el;
    if (isFormControl(el)) {
      // The server's form-state attributes stay through hydration, then become what a client
      // render has: its own `defaultValue` or `defaultChecked` attribute, the rest properties.
      const keep = clientFormStateAttributes({ ...this.literal, ...written });
      afterHydration(el, () => releaseFormStateAttributes(el, keep));
    }
    if (this.scriptedAttributes !== undefined) {
      // A prehydration script may have changed these on the server's element: reconcile them
      // against what it holds once `hydrate()` returns, even if the client's first write equals
      // the server's record (a script that showed what the client hides).
      this.scheduleReconcile();
    }
    if (process.env.NODE_ENV !== 'production') {
      // Now, while the element still holds the server markup.
      checkHydratedAttributes(this.el, this.scriptedAttributes, this.templateAttributes, {
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

  /**
   * The first write and every write while hydrating are whole records: the first stands for the
   * server's markup (kept by reference), and a claimed element only records its writes. Once
   * hydration has ended, the element diffs as any other does.
   */
  protected override writesWholeRecord(): boolean {
    return this.firstWrite === undefined || isHydrating();
  }

  protected override applyWrite(next: Record<string, unknown>) {
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
      if (this.scriptedAttributes !== undefined) {
        this.holdScripted(previous, next);
      }
    } else {
      super.applyWrite(next);
    }
  }

  /**
   * A prehydration script may have changed the scripted attributes on the server's element, so a
   * write must not diff them against the server's record (`base`), which would skip a value the
   * client computes as the server did. As the slow path's one write after hydration
   * (`useRenderElement`), each holds what the element holds now, and a `style` holds an empty style:
   * the client's style properties are all written and none the script set is removed (Solid's style
   * writer starts its own record from it). A style the client has not computed yet (a part that
   * has not measured) holds nothing, so it writes nothing.
   */
  private holdScripted(base: Record<string, unknown>, next: Record<string, unknown>) {
    for (const key of this.scriptedAttributes!) {
      if (key !== 'style') {
        base[key] = domAttribute(this.el, key);
      } else {
        base.style = next.style == null ? undefined : EMPTY_STYLE;
      }
    }
  }

  private reconcile() {
    const written = this.needsEffect ? attributesOf(untrack(() => this.write({}, true))) : {};
    const hydratedWrite = { ...attributesOf(this.literal), ...attributesOf(this.firstWrite ?? {}) };
    if (this.scriptedAttributes !== undefined) {
      this.holdScripted(hydratedWrite, written);
    }
    assign(this.el, { ...attributesOf(this.literal), ...written }, true, hydratedWrite, true);
    Object.assign(this.previous, written);
    this.countHeld();
  }
}

/** An attribute as a write holds it: `true` for a present boolean attribute, else its value. */
function domAttribute(el: Element, key: string): unknown {
  const value = el.getAttribute(key);
  if (value === null) {
    return undefined;
  }
  return value === '' ? true : value;
}

/**
 * The classification's `wrap`: claims the keys of a spec's handler tables (bound from them) and
 * leaves the rest, cached per table pair (parts pass module-level tables).
 */
const tableWraps = new WeakMap<object, WeakMap<object, (key: string) => unknown>>();
const NO_TABLE: Readonly<Record<string, unknown>> = Object.freeze({});
/** Every consumer handler key is the part's to bind (`handlerFor`). */
const claimEveryHandler = () => true;

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
): ElementWriter<State> {
  const source = props as Record<string, any>;
  // The tables' keys are bound below, the always-bound ones whether or not the consumer passes them;
  // with `handlerFor`, every consumer handler key is.
  let claim: ((key: string) => unknown) | undefined;
  if (spec.handlerFor) {
    claim = claimEveryHandler;
  } else if (spec.handlers || spec.handlersIfPassed) {
    claim = tableHandled(spec);
  }
  const consumer = classifyConsumerProps(
    props,
    spec.own,
    claim,
    spec.attributeOverrides !== undefined,
  );
  const keys = top ? withKeys(consumer.keys, top) : consumer.keys;
  const reactive = top ? keysNotIn(consumer.reactive, top) : consumer.reactive;

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
  const handlerFor = spec.handlerFor;
  let record: HandlerRecord | undefined;
  if ((handlers || handlersIfPassed || handlerFor) && !isServer) {
    // One record for every key.
    record = new HandlerRecord(props, spec.handlerTarget);
    if (handlers) {
      bindHandlers(literal, handlers, undefined, record, top, handlerFunctions);
    }
    if (handlersIfPassed) {
      bindHandlers(literal, handlersIfPassed, consumer.keys, record, top, handlerFunctions);
    }
    if (handlerFor) {
      // The consumer's other handler keys, through the part's dispatch for that key.
      for (const key of consumer.keys) {
        if (literal[key] === true && !(top && key in top)) {
          const dispatch = handlerFor(key);
          literal[key] = handlerFunctions ? handlerFunction(dispatch, record) : [dispatch, record];
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
    spec.attributeOverrides !== undefined ||
    spec.partClass !== undefined ||
    styleOverride !== undefined ||
    partStyle !== undefined ||
    reactive.length > 0 ||
    (hasClass && (!isStaticKey(props, 'class') || typeof source.class === 'function')) ||
    (hasStyle && (!isStaticKey(props, 'style') || typeof source.style === 'function'));

  const writer = new (hydrating ? HydratingWriter : ElementWriter)(
    keys,
    props,
    spec,
    reactive,
    writeState,
    writtenState,
  );
  writer.literal = literal;
  writer.needsEffect = needsEffect;
  if (handlerFor && record) {
    writer.handlerRecord = record;
  }
  return writer;
}

/**
 * Binds a module-level handler table into `literal` (`for…in`: no key array per element), the keys
 * of `passed` only when given and none `top` sets. A consumer's element gets plain functions
 * (`functions`): its render function may call `props.onClick(event)` itself, as a React consumer's
 * does; the part's own element gets `[dispatch, record]` tuples. No closure here, so a call
 * allocates no context.
 */
function bindHandlers(
  literal: Record<string, unknown>,
  table: Readonly<Record<string, Dispatch<any>>>,
  passed: ReadonlySet<string> | undefined,
  record: HandlerRecord,
  top: Record<string, unknown> | undefined,
  functions: boolean,
) {
  for (const key in table) {
    if (Object.hasOwn(table, key) && (!passed || passed.has(key)) && !(top && key in top)) {
      literal[key] = functions ? handlerFunction(table[key], record) : [table[key], record];
    }
  }
}

function handlerFunction(dispatch: Dispatch<any>, record: HandlerRecord) {
  return (event: Event) => dispatch(record, event);
}

/** The keys `top` does not set (a closure here would give `createClientWriter` a context). */
function keysNotIn(keys: readonly string[], top: Record<string, unknown>): readonly string[] {
  return keys.filter((key) => !(key in top));
}

/** `keys` with `extra`'s keys added (a render config's attributes, which the part must not write). */
function withKeys(keys: ReadonlySet<string>, extra: Record<string, unknown>): ReadonlySet<string> {
  const all = new Set(keys);
  for (const key of Object.keys(extra)) {
    all.add(key);
  }
  return all;
}

// Frozen: one options object for every element's effect, which the runtime only reads.
const TRANSPARENT = Object.freeze({ transparent: true });

function renderClientElement<State extends object>(
  element: Element | NativeElementTemplate,
  props: object,
  spec: NativeElementSpec<State>,
  top?: Record<string, unknown>,
): Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing. It creates no
  // closure (the refs' cleanup and the children's accessor are made in helpers), so a call
  // allocates no context for captured variables.
  const source = props as Record<string, any>;
  const hydrating = isHydrating();
  const writer = createClientWriter(props, spec, undefined, top, false, hydrating);
  const literal = writer.literal;
  const needsEffect = writer.needsEffect;
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
      spec.scriptedAttributes,
    );
  }

  if (!needsEffect) {
    writer.write(literal, false);
    if (hydration && process.env.NODE_ENV !== 'production') {
      hydration.takeFirstWrite({});
    }
  }
  attachNativeAttributes(el, literal, undefined, null);
  if (needsEffect) {
    // As `attachNativeAttributes`' effect, its compute and apply the writer's methods (see
    // `ElementWriter.applyWrite` for the one difference), under the part's owner, which is current here.
    // Transparent: the server has no counterpart, so it takes no hydration id.
    createRenderEffect(writer.compute.bind(writer), writer.apply.bind(writer), TRANSPARENT);
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
    attachPartRefs(el, refs);
  }

  if (spec.children) {
    insert(el, spec.children);
  } else if (consumerChildren) {
    insertConsumerChildren(el, props);
  }
  return el;
}

/** Applies the part's refs and releases them with `null` on cleanup (React's ref contract). */
function attachPartRefs(el: Element, refs: readonly unknown[]) {
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

/** Inserts the consumer's children: as they are when literal, else through an accessor. */
function insertConsumerChildren(el: Element, props: object) {
  const source = props as Record<string, any>;
  if (isStaticKey(props, 'children')) {
    insert(el, source.children);
  } else {
    insert(el, () => source.children);
  }
}
