/** @vitest-environment node */
/*
 * Server rendering: parts that render on the first pass (an app-root toast portal) must not touch
 * `document`. Compiles the fixture with Solid's SSR transform through Vite, as an SSR app does.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solidPlugin from '@solidjs/vite-plugin';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../..');
let server: ViteDevServer;

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
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe('server rendering', () => {
  it('renders a page with a toast portal without touching document', async () => {
    const fixture = (await server.ssrLoadModule(resolve(here, 'toast-portal.fixture.tsx'))) as {
      render: () => string;
    };
    expect(fixture.render()).toContain('page');
  }, 60_000);

  it('renders uncontrolled defaults as the value attribute', async () => {
    const fixture = (await server.ssrLoadModule(resolve(here, 'default-value.fixture.tsx'))) as {
      render: () => string;
    };
    const html = fixture.render();
    expect(html).toMatch(/<input[^>]*value="ada@acme\.dev"/);
    expect(html).toMatch(/<input[^>]*value="3"/);
    expect(html.toLowerCase()).not.toContain('defaultvalue');
  }, 60_000);

  it('renders a known input value in the server HTML', async () => {
    const fixture = (await server.ssrLoadModule(resolve(here, 'default-value.fixture.tsx'))) as {
      render: () => string;
    };
    const html = fixture.render();
    const mismatches = [
      ['combo-query', 'initech-query'],
      ['combo-selected', 'Initech'],
      ['combo-controlled', 'controlled-text'],
      ['combo-override', 'override-text'],
      ['autocomplete-text', 'acme-co'],
      ['otp-0', '4'],
      ['otp-1', '2'],
      ['number-text', '3'],
      ['agree', 'yes'],
      ['alerts', 'on'],
      ['size-m', 'm'],
      ['toolbar-text', 'toolbar-text'],
    ].flatMap(([id, expected]) => {
      const actual = inputValue(html, id);
      return actual === expected
        ? []
        : [`#${id}: expected "${expected}", got ${formatValue(actual)}`];
    });
    const range = inputBy(html, (tag) => tag.includes('aria-label="Volume"'));
    if (!range) {
      mismatches.push('range input: missing');
    } else if (!range.includes('value="37"')) {
      mismatches.push(`range input: expected value="37" on ${range}`);
    }
    const fruit = inputBy(html, (tag) => tag.includes('name="fruit"'));
    if (!fruit) {
      mismatches.push('select input: missing');
    } else if (!fruit.includes('value="kiwi"')) {
      mismatches.push(`select input: expected value="kiwi" on ${fruit}`);
    }
    const otpHidden = inputBy(html, (tag) => tag.includes('name="otp"'));
    if (!otpHidden) {
      mismatches.push('otp hidden input: missing');
    } else if (!otpHidden.includes('value="42"')) {
      mismatches.push(`otp hidden input: expected value="42" on ${otpHidden}`);
    }
    const company = inputBy(html, (tag) => tag.includes('name="company"'));
    if (!company) {
      mismatches.push('combobox hidden input: missing');
    } else if (!company.includes('value="Initech"')) {
      mismatches.push(`combobox hidden input: expected value="Initech" on ${company}`);
    }
    if (!html.includes('kiwi')) {
      mismatches.push('select label: expected the selected text in the HTML');
    }
    expect(mismatches, html).toEqual([]);
  }, 60_000);
});

function inputBy(html: string, predicate: (tag: string) => boolean): string | undefined {
  return (html.match(/<input\b[^>]*>/gi) ?? []).find(predicate);
}

function inputValue(html: string, id: string): string | undefined {
  const tag = inputBy(html, (candidate) => candidate.includes(`id="${id}"`));
  if (!tag) {
    return undefined;
  }
  return tag.match(/\bvalue="([^"]*)"/)?.[1];
}

function formatValue(value: string | undefined): string {
  return value === undefined ? 'no value attribute' : `"${value}"`;
}
