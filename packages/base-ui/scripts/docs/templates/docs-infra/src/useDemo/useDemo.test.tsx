/*
 * A demo server-renders its highlighted code, hydrates every element the server rendered, and its
 * demo, code tabs, variants, expansion and copy work once hydrated.
 */
import { fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { flush } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateEntry, serverHtml } from '../__fixtures__/hydration';
import type { Hydrated } from '../__fixtures__/hydration';
import { DemoFixture } from './useDemo.fixture';

const ENTRY = 'useDemo/useDemo.server.tsx';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function hydrated(): Promise<Hydrated> {
  const result = await hydrateEntry(ENTRY, () => <DemoFixture />);
  cleanup = result.dispose;
  return result;
}

function code(container: HTMLElement) {
  return container.querySelector('.DemoSourceBrowser code')?.textContent ?? '';
}

describe('useDemo', () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  it('server-renders the code with its first lines highlighted', () => {
    const template = document.createElement('template');
    template.innerHTML = serverHtml(ENTRY);
    const lines = [...template.content.querySelectorAll('.DemoSourceBrowser code .line')];
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].querySelector('[class^="pl-"]')).not.toBeNull();
    expect(template.content.querySelector('.DemoSourceBrowser code')?.textContent).toContain(
      'export default function',
    );
  });

  it('hydrates every server-rendered element', async () => {
    const { warnings, unclaimed } = await hydrated();
    expect(warnings).toEqual([]);
    expect(unclaimed.map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('keeps the demo it hydrated when the demo is used', async () => {
    const { container } = await hydrated();
    const trigger = container.querySelector('.DemoPlaygroundInner button')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    flush();
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
    expect(trigger.isConnected).toBe(true);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('shows the code of the file tab it selects', async () => {
    const { container } = await hydrated();
    expect(code(container)).toContain('export default function');
    const cssTab = [...container.querySelectorAll('[role="tab"]')].find(
      (tab) => tab.textContent === 'index.module.css',
    );
    expect(cssTab).not.toBeUndefined();
    fireEvent.click(cssTab!);
    flush();
    await waitFor(() => {
      expect(code(container)).toContain('.Popup');
    });
  });

  it('switches to the variant it selects', async () => {
    // jsdom has no layout: the docs CSS it applies says nothing about what a pointer can reach.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const { container } = await hydrated();
    const figure = () => container.querySelector('.DemoPlaygroundInner')!;
    expect(figure().getAttribute('data-demo')).toBe('css-modules');
    await user.click(container.querySelector('[aria-label="Styling method"]')!);
    const option = await waitFor(() => {
      const found = [...document.querySelectorAll('[role="option"]')].find((item) =>
        item.textContent?.includes('Tailwind'),
      );
      expect(found).not.toBeUndefined();
      return found!;
    });
    await user.click(option);
    await waitFor(() => {
      expect(figure().getAttribute('data-demo')).toBe('tailwind');
    });
    // The Tailwind variant has one file: no file tabs, and its code has no CSS module.
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(code(container)).not.toContain('index.module.css');
  });

  it('expands and collapses the code', async () => {
    const { container } = await hydrated();
    const viewport = () => container.querySelector('.DemoCodeBlockViewport')!;
    expect(viewport().getAttribute('data-closed')).toBe('');
    fireEvent.click(container.querySelector('.DemoCollapseButton')!);
    flush();
    await waitFor(() => {
      expect(viewport().hasAttribute('data-closed')).toBe(false);
    });
    expect(code(container)).toContain('export default function');
  });

  it('copies the selected file', async () => {
    const { container } = await hydrated();
    fireEvent.click(container.querySelector('[aria-label="Copy code"]')!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText.mock.calls[0][0]).toContain('export default function');
  });
});
