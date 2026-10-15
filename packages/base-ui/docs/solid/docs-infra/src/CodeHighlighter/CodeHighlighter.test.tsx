/*
 * A precomputed code block renders the same markup on the server and the client, hydrates every
 * element the server rendered, shows its title, and highlights at its `highlightAfter` time.
 */
import { waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hydrateEntry,
  normalizeMarkup,
  renderClient,
  serverHtml,
} from '../__fixtures__/hydration';
import { CodeBlocksFixture } from './CodeHighlighter.fixture';

const ENTRY = 'CodeHighlighter/CodeHighlighter.server.tsx';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

const highlighted = (block: Element | null) => block?.querySelector('code [class^="pl-"]') ?? null;

describe('CodeHighlighter', () => {
  // An `init` block decodes its full tree once mounted (its first paint is the highlighted
  // fallback), so the client's settled render differs from the server's by design; an `idle` block
  // renders the same until the browser is idle.
  it('renders an idle code block on the server as on the client', () => {
    const client = renderClient(() => <CodeBlocksFixture />);
    cleanup = client.dispose;
    const template = document.createElement('template');
    template.innerHTML = serverHtml(ENTRY);
    expect(normalizeMarkup(template.content.querySelector('.idle')!.innerHTML)).toEqual(
      normalizeMarkup(client.container.querySelector('.idle')!.innerHTML),
    );
  });

  it('hydrates every server-rendered element', async () => {
    const { warnings, unclaimed, dispose } = await hydrateEntry(ENTRY, () => <CodeBlocksFixture />);
    cleanup = dispose;
    expect(warnings).toEqual([]);
    expect(unclaimed.map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('shows the title and code a block was given', async () => {
    const { container, dispose } = await hydrateEntry(ENTRY, () => <CodeBlocksFixture />);
    cleanup = dispose;
    const block = container.querySelector('.init');
    expect(block?.textContent).toContain('index.css');
    expect(block?.querySelector('code')?.textContent).toContain('.root');
  });

  it('highlights an init block from the server, and an idle block once the browser is idle', async () => {
    const template = document.createElement('template');
    template.innerHTML = serverHtml(ENTRY);
    expect(highlighted(template.content.querySelector('.init'))).not.toBeNull();
    expect(highlighted(template.content.querySelector('.idle'))).toBeNull();
    const { container, dispose } = await hydrateEntry(ENTRY, () => <CodeBlocksFixture />);
    cleanup = dispose;
    await waitFor(() => {
      expect(highlighted(container.querySelector('.idle'))).not.toBeNull();
    });
  });
});
