/** @vitest-environment node */
/*
 * The native kit's server templates write an element's markup themselves instead of through
 * `ssrElement`. Every row of this table renders one native element on both paths and must give
 * the same bytes: every value kind in every position (template, part literal, part write,
 * consumer literal, consumer getter), class and style forms, namespaced keys, handlers and refs,
 * escape-sensitive values, collisions between positions, and child kinds. The rows the template
 * path does not cover render through `ssrElement`, and the table names them.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Row } from './server-template.fixture';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;
let markupOf: (row: Row) => string;
let element: {
  setServerTemplates: (enabled: boolean) => void;
  serverRenderPaths: { template: number; generic: number };
};

beforeAll(async () => {
  server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    plugins: [solidPlugin({ ssr: true }) as never],
    resolve: { alias: { '@solidports/base-ui': resolve(pkg, 'src') } },
    root: pkg,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  ({ markupOf } = (await server.ssrLoadModule(
    resolve(here, 'server-template.fixture.tsx'),
  )) as never);
  element = (await server.ssrLoadModule(resolve(pkg, 'src/utils/native/element.ts'))) as never;
}, 60_000);

afterAll(async () => {
  element?.setServerTemplates(true);
  await server?.close();
});

const fn = () => 'from a function';
const VALUES: Array<[string, unknown]> = [
  ['string', 'value'],
  ['empty string', ''],
  ['number', 1],
  ['zero', 0],
  ['true', true],
  ['false', false],
  ['null', null],
  ['undefined', undefined],
  ['NaN', Number.NaN],
  ['function', fn],
  ['object', { a: 1 }],
  ['array', [1, 2]],
  ['escape-sensitive', `"'<>&\n`],
];
const KEYS = [
  'title',
  'data-x',
  'aria-x',
  'disabled',
  'hidden',
  'inert',
  'open',
  'id',
  'for',
  'htmlFor',
];
const POSITIONS = ['consumer', 'reactive', 'literal', 'writes'] as const;

function at(position: (typeof POSITIONS)[number], key: string, value: unknown): Row {
  return position === 'writes' ? { writes: [[key, value]] } : { [position]: { [key]: value } };
}

const rows: Array<[string, Row]> = [];
for (const position of POSITIONS) {
  for (const key of KEYS) {
    for (const [kind, value] of VALUES) {
      rows.push([`${position} ${key} = ${kind}`, at(position, key, value)]);
    }
  }
}
for (const [kind, value] of [
  ['string', 'a b'],
  ['empty', ''],
  ['array', ['a', 'b']],
  ['object', { a: true, b: false }],
  ['function of state', () => 'from-state'],
  ['escape-sensitive', 'a"<&'],
] as const) {
  rows.push([`consumer class = ${kind}`, { consumer: { class: value } }]);
  rows.push([`reactive class = ${kind}`, { reactive: { class: value } }]);
}
for (const [kind, value] of [
  ['string', 'color: red'],
  ['object', { color: 'red', 'margin-top': '1px' }],
  ['empty object', {}],
  ['object with null', { color: null, width: '1px' }],
  ['escape-sensitive', 'content: "<&>"'],
] as const) {
  rows.push([`consumer style = ${kind}`, { consumer: { style: value } }]);
  rows.push([
    `consumer style = ${kind}, with part style`,
    { consumer: { style: value }, partStyle: { '--p': '1' } },
  ]);
  rows.push([
    `consumer style = ${kind}, with style override`,
    { consumer: { style: value }, styleOverride: { '--o': '2' } },
  ]);
}
rows.push(['part style only', { partStyle: { '--p': '1' } }]);
rows.push(['style override only', { styleOverride: { 'animation-name': 'none' } }]);
for (const key of ['prop:value', 'attr:x', 'bool:x', 'on:click', 'ref', 'onClick', 'onclick']) {
  rows.push([
    `consumer ${key}`,
    { consumer: { [key]: key.startsWith('on') || key === 'ref' ? fn : 'v' } },
  ]);
}
// Collisions, in each pair of positions that can write the same key.
const pairs: Array<[string, Row]> = [
  ['template then part literal', { template: { role: 'group' }, literal: { role: 'region' } }],
  ['template then part write', { template: { role: 'group' }, writes: [['role', 'region']] }],
  ['template then consumer', { template: { role: 'group' }, consumer: { role: 'tab' } }],
  ['part literal then consumer', { literal: { id: 'part' }, consumer: { id: 'consumer' } }],
  ['part write then consumer', { writes: [['id', 'part']], consumer: { id: 'consumer' } }],
  ['part write then getter', { writes: [['id', 'part']], reactive: { id: 'getter' } }],
  [
    'part literal then part write',
    { literal: { 'data-a': 'literal' }, writes: [['data-a', 'write']] },
  ],
  [
    'part literal then getter',
    { literal: { 'data-a': 'literal' }, reactive: { 'data-a': 'getter' } },
  ],
  [
    'template, part write and consumer',
    { template: { role: 'group' }, writes: [['role', 'region']], consumer: { role: 'tab' } },
  ],
];
rows.push(...pairs.map(([name, row]) => [`collision: ${name}`, row] as [string, Row]));
// Children.
for (const [kind, value] of [
  ['text with markup', '<b>x</b>'],
  ['decoded entities', 'Tom & Jerry <3'],
  ['number', 3],
  ['zero', 0],
  ['null', null],
  ['boolean', false],
  ['array of text', ['a<', 'b&']],
  ['function', () => 'late <i>'],
] as const) {
  rows.push([`children: ${kind}`, { children: value, consumer: { title: 't' } }]);
}
// Rows the template path hands to `ssrElement`.
const FALLBACK = [
  'consumer innerHTML',
  'consumer textContent',
  'consumer innerText',
  'tag input',
  'tag textarea',
  'tag option',
  'tag script',
  'tag style',
  'tag a',
];
rows.push(['consumer innerHTML', { consumer: { innerHTML: '<b>raw</b>' } }]);
rows.push(['consumer textContent', { consumer: { textContent: 'a<b' } }]);
rows.push(['consumer innerText', { consumer: { innerText: 'a<b' } }]);
for (const tag of ['input', 'textarea', 'option', 'script', 'style', 'a']) {
  rows.push([`tag ${tag}`, { tag, consumer: { value: 'v', href: '/x', title: 't' } }]);
}
// Void and ordinary tags on the template path.
for (const tag of ['br', 'img', 'button', 'span', 'h3', 'section']) {
  rows.push([`tag ${tag}`, { tag, consumer: { title: 't' } }]);
}

describe('native server templates', () => {
  it.each(rows)('matches ssrElement byte for byte: %s', (name, row) => {
    element.setServerTemplates(false);
    const generic = markupOf(row);
    element.setServerTemplates(true);
    const before = { ...element.serverRenderPaths };
    const templated = markupOf(row);
    expect(templated).toBe(generic);
    const used = element.serverRenderPaths.template > before.template ? 'template' : 'generic';
    expect(used).toBe(FALLBACK.includes(name) ? 'generic' : 'template');
  });
});
