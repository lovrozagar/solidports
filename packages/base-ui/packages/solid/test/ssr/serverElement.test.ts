/** @vitest-environment node */
/*
 * The native kit's server element writer (`src/utils/native/serverElement.ts`, D18) writes what
 * `ssrElement` writes for a native part's element, byte for byte, or leaves the case to it. Each
 * side renders in a fresh `renderToString`, so both take the same hydration key.
 */
import { renderToString, ssrElement } from '@solidjs/web';
import { describe, expect, it } from 'vitest';
import { serverAttributesMarkup, serverElement } from '../../src/utils/native/serverElement';

const html = (render: () => unknown) => renderToString(render as never);

const viaSsrElement = (
  tag: string,
  attributes: Record<string, unknown>,
  children: unknown,
  markup: string,
) => html(() => ssrElement(tag, attributes, children as never, true, undefined, markup));

const viaWriter = (
  tag: string,
  attributes: Record<string, unknown>,
  children: unknown,
  markup: string,
  shared = false,
) => html(() => serverElement(tag, attributes, children, markup, shared));

// Attribute objects as a native part builds them: the template's literals, then the consumer's
// keys (an id, a class, a style, data attributes), every value kind those can hold.
const ATTRIBUTES: Record<string, Record<string, unknown>> = {
  empty: {},
  literals: { type: 'button', tabindex: '0' },
  'class string': { class: 'a b' },
  'class empty': { class: '' },
  'class with markup characters': { class: 'a"<b>&c' },
  'class object': { class: { a: true, b: false, 'c d': true } },
  'class array': { class: ['a', { b: true, c: false }, ['d']] },
  'class number': { class: 0 },
  'style string': { style: 'color: red; --x: "1"' },
  'style object': { style: { color: 'red', '--x': 1, width: null, height: undefined } },
  'style empty object': { style: {} },
  'style with markup characters': { style: { content: '"<x>"' } },
  'id string': { id: 'x' },
  'id empty': { id: '' },
  'id with markup characters': { id: 'x"<y>&z' },
  'id number': { id: 0 },
  booleans: { hidden: true, inert: false },
  'null and undefined': { title: null, lang: undefined },
  'prop: namespace': { 'prop:value': 'x', 'data-a': 'b' },
  'data attributes': { 'data-state': 'open', 'data-empty': '', 'data-n': 3 },
  'part literal, consumer class, style and id together': {
    type: 'button',
    tabindex: '0',
    id: 'trigger',
    class: ['x', { y: true }],
    style: { color: 'red' },
    'data-testid': 't',
  },
};

const CHILDREN: Record<string, unknown> = {
  none: undefined,
  null: null,
  text: 'text',
  'text with markup characters (already escaped by the caller)': '&lt;b&gt;',
  number: 5,
  zero: 0,
  boolean: true,
  node: { t: '<i>x</i>' },
  function: () => 'from a function',
  array: ['a', { t: '<b>b</b>' }, 3, null, ['nested']],
};

const MARKUP = ['', ' data-open aria-expanded="true"'];

describe('native server element writer', () => {
  for (const tag of ['div', 'button', 'span']) {
    for (const [attributesName, attributes] of Object.entries(ATTRIBUTES)) {
      for (const markup of MARKUP) {
        it(`<${tag}> ${attributesName}, markup ${JSON.stringify(markup)}: as ssrElement, for every kind of children`, () => {
          for (const children of Object.values(CHILDREN)) {
            expect(viaWriter(tag, attributes, children, markup)).toBe(
              viaSsrElement(tag, attributes, children, markup),
            );
          }
        });
      }
    }
  }

  it('serializes a shared template object once and writes the same bytes from the cache', () => {
    const literals = { type: 'button', tabindex: '0' };
    const first = viaWriter('button', literals, 'x', ' data-open', true);
    expect(viaWriter('button', literals, 'x', ' data-open', true)).toBe(first);
    expect(first).toBe(viaSsrElement('button', literals, 'x', ' data-open'));
  });

  it('leaves to ssrElement the tags and keys it writes another way', () => {
    for (const tag of ['input', 'img', 'textarea', 'option', 'script', 'style', 'a', 'br']) {
      expect(html(() => serverElement(tag, {}, undefined, '', false) ?? 'fallback')).toBe(
        'fallback',
      );
    }
    for (const key of ['children', 'innerHTML', 'textContent', 'innerText']) {
      expect(serverAttributesMarkup({ [key]: 'x' })).toBeUndefined();
    }
  });
});
