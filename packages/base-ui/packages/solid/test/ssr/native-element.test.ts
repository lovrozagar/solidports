/** @vitest-environment node */
/*
 * A native element's server markup: the part's own attribute writes go straight into the markup,
 * escaped as Solid escapes attributes and once per key. A part write overrides a template
 * attribute, a consumer prop wins over a part write, and a key written twice keeps its last
 * write, as the client's attribute object does (development also warns).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;
let fixture: {
  renderWrites: (twice: boolean) => string;
  renderEscaped: (value: string) => string;
  renderCollision: () => string;
  renderCaseCollision: (reactive: boolean) => string;
  renderTemplateOverride: (type: string | undefined) => string;
};
let takeServerMarkup: (keys: string[], values: unknown[], start: number) => string;

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
  fixture = (await server.ssrLoadModule(resolve(here, 'native-element.fixture.tsx'))) as never;
  ({ takeServerMarkup } = (await server.ssrLoadModule(
    resolve(pkg, 'src/utils/native/element.ts'),
  )) as never);
}, 60_000);

afterAll(async () => {
  await server?.close();
});

/** Every value of attribute `name` in `html`, entities decoded. */
function attributeValues(html: string, name: string) {
  return [...html.matchAll(new RegExp(` ${name}="([^"]*)"`, 'g'))].map((match) =>
    match[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&'),
  );
}

/** The attribute names of the first element in `html`, read as HTML does (quoted values skipped). */
function attributeNames(html: string) {
  const names: string[] = [];
  let at = html.indexOf(' ');
  while (at !== -1 && at < html.length) {
    while (html[at] === ' ') {
      at += 1;
    }
    if (html[at] === '>' || html[at] === '/') {
      break;
    }
    const start = at;
    while (at < html.length && !' =>'.includes(html[at])) {
      at += 1;
    }
    names.push(html.slice(start, at));
    if (html[at] === '=') {
      at += 1;
      if (html[at] === '"') {
        at = html.indexOf('"', at + 1) + 1;
      } else {
        while (at < html.length && !' >'.includes(html[at])) {
          at += 1;
        }
      }
    }
  }
  return names;
}

describe('native element server markup', () => {
  it('renders each attribute once, a part write replacing the template attribute', () => {
    const view = fixture.renderWrites(false);
    expect(attributeValues(view, 'role')).toEqual(['region']);
    expect(attributeValues(view, 'data-a')).toEqual(['1']);
  });

  it('escapes part and consumer attribute values, so no value breaks out of its attribute', () => {
    const value = `x" onclick="alert(1)" y='<b>&amp;</b>'`;
    const view = fixture.renderEscaped(value);
    expect(attributeValues(view, 'data-value')).toEqual([value]);
    expect(attributeValues(view, 'title')).toEqual([value]);
    expect(attributeNames(view)).toEqual(['_hk', 'role', 'title', 'data-value']);
  });

  it('renders a consumer prop that collides with a part attribute once, with the consumer value', () => {
    const view = fixture.renderCollision();
    expect(attributeValues(view, 'aria-expanded')).toEqual(['consumer']);
    expect(attributeValues(view, 'id')).toEqual(['consumer-id']);
    expect(view.match(/ data-panel-open/g)).toHaveLength(1);
  });

  it("lets a consumer prop replace a template attribute, an undefined one removing it", () => {
    expect(attributeValues(fixture.renderTemplateOverride('submit'), 'type')).toEqual(['submit']);
    const view = fixture.renderTemplateOverride(undefined);
    expect(attributeNames(view)).not.toContain('type');
    // The template's other literals stay.
    expect(attributeValues(view, 'tabindex')).toEqual(['0']);
  });

  it("lets a consumer prop replace a template attribute it names in another case", () => {
    for (const reactive of [false, true]) {
      const view = fixture.renderCaseCollision(reactive);
      // HTML attribute names are case-insensitive: the browser reads `tabIndex` as `tabindex`.
      const names = attributeNames(view).filter((name) => name.toLowerCase() === 'tabindex');
      expect(names, `reactive: ${reactive}`).toHaveLength(1);
      expect(attributeValues(view, names[0]), `reactive: ${reactive}`).toEqual(['-1']);
    }
  });

  it('keeps the last write of a key written twice, and warns in development', () => {
    const report = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const view = fixture.renderWrites(true);
      expect(attributeValues(view, 'data-a')).toEqual(['2']);
      expect(report.mock.calls.flat().join(' ')).toContain(
        'A native part wrote the `data-a` attribute twice on the server',
      );
    } finally {
      report.mockRestore();
    }
  });

  it('keeps the last write of a key written twice in production, as the client does', () => {
    const environment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(takeServerMarkup(['data-a', 'role', 'data-a'], ['1', 'region', '2'], 0)).toBe(
        ' role="region" data-a="2"',
      );
    } finally {
      process.env.NODE_ENV = environment;
    }
  });
});
