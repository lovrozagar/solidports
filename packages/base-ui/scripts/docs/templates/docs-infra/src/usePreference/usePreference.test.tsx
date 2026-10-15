/*
 * A preference is unset on the server and through hydration (so the markup matches), then reads
 * `localStorage`; setting it writes through and updates every reader of the same key.
 */
import { fireEvent, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hydrateEntry, serverHtml } from '../__fixtures__/hydration';
import { PreferenceFixture } from './usePreference.fixture';

const ENTRY = 'usePreference/usePreference.server.tsx';
const KEY = '_docs_variant_pref:CssModules:Tailwind';

let cleanup: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('usePreference', () => {
  it('is unset on the server', () => {
    const template = document.createElement('template');
    template.innerHTML = serverHtml(ENTRY);
    expect(template.content.querySelector('.first')?.textContent).toBe('null');
    expect(template.content.querySelector('.second')?.textContent).toBe('null');
  });

  it('hydrates unset, then reads the stored value', async () => {
    localStorage.setItem(KEY, 'Tailwind');
    const { container, warnings, unclaimed, dispose } = await hydrateEntry(ENTRY, () => (
      <PreferenceFixture />
    ));
    cleanup = dispose;
    expect(warnings).toEqual([]);
    expect(unclaimed).toEqual([]);
    await waitFor(() => {
      expect(container.querySelector('.first')?.textContent).toBe('Tailwind');
    });
    expect(container.querySelector('.second')?.textContent).toBe('Tailwind');
  });

  it('falls back to the initializer when nothing is stored', async () => {
    const { container, dispose } = await hydrateEntry(ENTRY, () => <PreferenceFixture />);
    cleanup = dispose;
    await waitFor(() => {
      expect(container.querySelector('.first')?.textContent).toBe('CssModules');
    });
    expect(container.querySelector('.second')?.textContent).toBe('null');
  });

  it('writes through and updates every reader of the key', async () => {
    const { container, dispose } = await hydrateEntry(ENTRY, () => <PreferenceFixture />);
    cleanup = dispose;
    fireEvent.click(container.querySelector('button')!);
    await waitFor(() => {
      expect(container.querySelector('.second')?.textContent).toBe('Tailwind');
    });
    expect(container.querySelector('.first')?.textContent).toBe('Tailwind');
    expect(localStorage.getItem(KEY)).toBe('Tailwind');
  });
});
