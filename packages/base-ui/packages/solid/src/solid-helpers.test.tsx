import { describe, it, expect } from 'vitest';
import { createContext, createRoot, flush, onCleanup, useContext } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { renderServer } from '../test/ssrFixtures';
import { createStore } from './solid-1-compat';
import { provideContext } from './solid-helpers';
import fixtures, { showLateReaders } from './solid-helpers.ssr-fixtures';

describe('provideContext', () => {
  const Context = createContext<string>('default');

  it('provides the value to everything render creates', () => {
    const seen: string[] = [];
    createRoot((dispose) => {
      provideContext(Context, 'outer', () => {
        seen.push(useContext(Context));
        return provideContext(Context, 'inner', () => {
          seen.push(useContext(Context));
          return null;
        });
      });
      seen.push(useContext(Context));
      dispose();
    });
    expect(seen).toEqual(['outer', 'inner', 'default']);
  });

  it("returns render's own result, not a memo over it", () => {
    createRoot((dispose) => {
      const node = document.createElement('div');
      expect(provideContext(Context, 'value', () => node)).toBe(node);
      dispose();
    });
  });

  it('disposes what render created with the parent owner', () => {
    let cleaned = 0;
    createRoot((dispose) => {
      provideContext(Context, 'value', () => {
        onCleanup(() => {
          cleaned += 1;
        });
        return null;
      });
      expect(cleaned).toBe(0);
      dispose();
    });
    expect(cleaned).toBe(1);
  });

  it('readers mounted after hydration read a provider hydration created and one the client creates', () => {
    // Hydration renders the provider (D5); a provider created after it is one transparent owner.
    const { hydrate } = renderServer(fixtures, 'lateMounts');
    hydrate();
    expect(screen.getByTestId('early')).toHaveTextContent('hydrated');
    try {
      showLateReaders(true);
      flush();
      expect(screen.getByTestId('late-under-hydrated')).toHaveTextContent('hydrated');
      expect(screen.getByTestId('late-under-client')).toHaveTextContent('client');
    } finally {
      showLateReaders(false);
      flush();
    }
  });
});

describe('compat createStore', () => {
  it('applies patches, key paths with values, and key paths with updaters', () => {
    const [store, setStore] = createRoot(() =>
      createStore<{ a: number; nested?: { count: number } }>({ a: 1 }),
    );
    setStore({ a: 2 });
    flush();
    expect(store.a).toBe(2);
    setStore('nested', 'count', 1);
    flush();
    expect(store.nested?.count).toBe(1);
    setStore('nested', 'count', (count: number) => count + 1);
    flush();
    expect(store.nested?.count).toBe(2);
  });
});
