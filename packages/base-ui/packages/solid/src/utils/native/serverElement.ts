/*
 * The native kit's server element writer (D18): what `ssrElement(tag, attributes, children, true,
 * undefined, markup)` returns for a native part's element, without its generic walk. A native part
 * hands `ssrElement` a plain attribute object (the template's literals, the consumer's `class`,
 * `style` and other props, never a handler, ref or proxy) and its own attributes already written
 * as markup, so most of that walk is for cases it never has: spread sources, proxies, slots and
 * claims, link and form attributes. This writes the same bytes for the cases it has, with the
 * template's literals serialized once per template, and leaves every other case to `ssrElement`.
 * `test/ssr/serverElement.test.ts` compares the two byte for byte across value kinds.
 */
import { sharedConfig } from 'solid-js/internal';
import { escape, resolveSSRNode, ssr, ssrClassName, ssrHydrationKey, ssrStyle } from '@solidjs/web';

/** As `@solidjs/web`'s server build, which keeps these private. */
const CHILD_PROPERTIES: ReadonlySet<string> = new Set([
  'innerHTML',
  'textContent',
  'innerText',
  'children',
]);
const NOT_NAME = /[\0-\x20\x7F-\x9F"'<>/=]/;
const isEventName = (name: string) => {
  const c = name.charCodeAt(2);
  return name.startsWith('on') && c > 64 && c < 91;
};

interface TagMarkup {
  open: string;
  close: string;
}

/**
 * Tags `ssrElement` writes the generic way: not void (`/>`), raw (`script`, `style`), a textarea
 * (value as children), a form control with default attributes (`input`, `option`) or a link
 * (claims an `href`). Native parts render none of the others.
 */
const SPECIAL_TAG =
  /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr|script|style|textarea|option|a)$/i;
const tags = new Map<string, TagMarkup | null>();

function tagMarkup(tag: string): TagMarkup | null {
  let markup = tags.get(tag);
  if (markup === undefined) {
    markup = SPECIAL_TAG.test(tag) ? null : { open: `<${tag}`, close: `</${tag}>` };
    tags.set(tag, markup);
  }
  return markup;
}

/** One attribute as `ssrElement` writes a plain object's key, or `undefined` when it cannot. */
function attributeMarkup(key: string, value: unknown): string | undefined {
  if (CHILD_PROPERTIES.has(key)) {
    return undefined;
  }
  if (
    value === null ||
    value === undefined ||
    key.startsWith('prop:') ||
    key === 'ref' ||
    isEventName(key)
  ) {
    return '';
  }
  if (key === 'style') {
    return ` style="${ssrStyle(value as never)}"`;
  }
  if (key === 'class') {
    return ` class="${ssrClassName(value as never)}"`;
  }
  if (key === '' || NOT_NAME.test(key)) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? ` ${key}` : '';
  }
  return value === '' ? ` ${key}` : ` ${key}="${escape(value as string, true)}"`;
}

/** A plain attribute object's markup, as `ssrElement` writes it, or `undefined` when it cannot. */
export function serverAttributesMarkup(attributes: Record<string, unknown>): string | undefined {
  let markup = '';
  for (const key of Object.keys(attributes)) {
    const part = attributeMarkup(key, attributes[key]);
    if (part === undefined) {
      return undefined;
    }
    markup += part;
  }
  return markup;
}

const literals = new WeakMap<object, string | null>();

/** A template's literal attributes as markup, serialized once per template object. */
function literalMarkup(attributes: Record<string, unknown>): string | undefined {
  let markup = literals.get(attributes);
  if (markup === undefined) {
    markup = serverAttributesMarkup(attributes) ?? null;
    literals.set(attributes, markup);
  }
  return markup ?? undefined;
}

/**
 * `ssrElement(tag, attributes, children, true, undefined, markup)` for a native part, or
 * `undefined` when only `ssrElement` writes this case (the caller then calls it). `shared` says
 * `attributes` is the template's own object, whose markup is cached.
 */
export function serverElement(
  tag: string,
  attributes: Record<string, unknown>,
  children: unknown,
  markup: string,
  shared: boolean,
): unknown {
  const tagParts = tagMarkup(tag);
  // Slots and claims: `ssrElement` writes behavior markers and object attributes another way.
  if (
    tagParts === null ||
    (sharedConfig.context as { claims?: unknown } | undefined)?.claims !== undefined
  ) {
    return undefined;
  }
  const attributesPart = shared ? literalMarkup(attributes) : serverAttributesMarkup(attributes);
  if (attributesPart === undefined) {
    return undefined;
  }
  const open = tagParts.open + ssrHydrationKey() + attributesPart + markup;
  let content = typeof children === 'function' ? (children as () => unknown)() : children;
  const type = typeof content;
  if (type === 'string' || type === 'number') {
    return { t: `${open}>${content as string}${tagParts.close}` };
  }
  if (content == null || type === 'boolean') {
    return { t: `${open}>${tagParts.close}` };
  }
  const node = content as { h?: unknown; t?: unknown };
  if (type === 'object' && !node.h && typeof node.t === 'string') {
    return { t: `${open}>${node.t}${tagParts.close}` };
  }
  content = resolveSSRNode(content as never, undefined, true);
  return ssr([`${open}>`, tagParts.close] as never, content as never);
}
