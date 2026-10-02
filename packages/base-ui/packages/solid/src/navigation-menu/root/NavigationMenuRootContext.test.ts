import { afterEach, expect, vi, describe, it } from 'vitest';
import { isJSDOM } from '#test-utils';

describe('NavigationMenuRootContext', () => {
  // Solid: `vi.resetModules()` makes the dynamic import load a second solid-js instance, which warns.
  async function importContextModule() {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      return await import('./NavigationMenuRootContext');
    } finally {
      warnSpy.mockRestore();
    }
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sets a development display name', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();

    const { NavigationMenuRootContext } = await importContextModule();
    expect(NavigationMenuRootContext.displayName).toBe('NavigationMenuRootContext');
  });

  it.skipIf(!isJSDOM)('omits the display name in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    const { NavigationMenuRootContext } = await importContextModule();
    expect(NavigationMenuRootContext.displayName).toBe(undefined);
  });
});
