import { describe, expect, it, vi } from 'vitest';
import { warn } from '../src/utils/warn';
import { codeOf, createCensus, originOf } from './warningCensus';
import type { CensusEntry } from './warningCensus';

const frame = (path: string, fn = 'f') => `    at ${fn} (/repo/${path}:10:5)`;
const stack = (...frames: string[]) => ['Error', ...frames].join('\n');

describe('warning census', () => {
  describe('originOf', () => {
    it('attributes to the first frame outside node_modules: library source', () => {
      expect(
        originOf(
          stack(
            frame('node_modules/@solidjs/signals/dist/dev.js'),
            frame('packages/base-ui/packages/solid/src/utils/createLogOnce.ts'),
            frame('packages/base-ui/packages/solid/src/menu/root/MenuRoot.tsx'),
          ),
        ),
      ).toBe('library');
    });

    it('attributes the test harness: test helpers, setup, testing-library', () => {
      expect(
        originOf(
          stack(
            frame('node_modules/solid-js/dist/dev.js'),
            frame('packages/base-ui/packages/solid/test/setupSolid.ts'),
          ),
        ),
      ).toBe('harness');
      expect(originOf(stack(frame('node_modules/@solidjs/testing-library/dist/index.js')))).toBe(
        'harness',
      );
    });

    it('attributes test files', () => {
      expect(
        originOf(stack(frame('packages/base-ui/packages/solid/src/menu/root/MenuRoot.test.tsx'))),
      ).toBe('test');
    });

    it('leaves a warning no project frame raised to its dependency', () => {
      expect(originOf(stack(frame('node_modules/solid-js/dist/dev.js')))).toBe('dependency');
    });

    it('reads Firefox and WebKit stacks: `fn@location` frames, the first line a frame', () => {
      const url = (path: string) => `http://127.0.0.1:63315/repo/${path}?import:10:5`;
      // No `Error` line: the first line is the logging frame itself.
      expect(
        originOf(
          [
            `warn@${url('packages/base-ui/packages/solid/src/utils/warn.ts')}`,
            `@${url('packages/base-ui/packages/solid/src/menu/root/MenuRoot.tsx')}`,
          ].join('\n'),
        ),
      ).toBe('library');
      expect(
        originOf(
          [
            `runUpdates@${url('node_modules/@solidjs/signals/dist/dev.js')}`,
            `fireEvent@${url('node_modules/@solidjs/testing-library/dist/index.js')}`,
            `@[native code]`,
          ].join('\n'),
        ),
      ).toBe('harness');
      expect(originOf(`async*@${url('packages/base-ui/packages/solid/src/x.test.tsx')}`)).toBe(
        'test',
      );
    });

    it('skips its own frames', () => {
      expect(
        originOf(
          stack(
            frame('packages/base-ui/packages/solid/test/warningCensus.ts'),
            frame('packages/base-ui/packages/solid/src/utils/warn.ts'),
          ),
        ),
      ).toBe('library');
    });
  });

  it('codeOf reads a Solid diagnostic code', () => {
    expect(codeOf('[FLUSH_IN_EFFECT_CALLBACK] flush() was called')).toBe(
      'FLUSH_IN_EFFECT_CALLBACK',
    );
    expect(codeOf('Base UI: something')).toBe(null);
  });

  it('records every warning and error with its suite, test, code and origin, then passes it on', () => {
    const entries: CensusEntry[] = [];
    // The spies stand in for the console below the census (the shared console check would fail
    // the test on these messages).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const census = createCensus({
      target: console,
      write: (entry) => entries.push(entry),
      context: () => ({ file: 'src/x.test.tsx', test: 'x > y' }),
      swallowed: (message) => message.startsWith('[FLUSH_IN_EFFECT_CALLBACK]'),
    });
    const uninstall = census.install();
    let calls = { warn: 0, error: 0 };
    try {
      warn('library says');
      console.warn('[FLUSH_IN_EFFECT_CALLBACK] harness flush');
      console.error('an error');
      calls = { warn: warnSpy.mock.calls.length, error: errorSpy.mock.calls.length };
    } finally {
      uninstall();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
    expect(
      entries.map(({ kind, code, origin, swallowed, file, test }) => ({
        kind,
        code,
        origin,
        swallowed,
        file,
        test,
      })),
    ).toEqual([
      {
        kind: 'warn',
        code: null,
        origin: 'library',
        swallowed: false,
        file: 'src/x.test.tsx',
        test: 'x > y',
      },
      {
        kind: 'warn',
        code: 'FLUSH_IN_EFFECT_CALLBACK',
        origin: 'test',
        swallowed: true,
        file: 'src/x.test.tsx',
        test: 'x > y',
      },
      {
        kind: 'error',
        code: null,
        origin: 'test',
        swallowed: false,
        file: 'src/x.test.tsx',
        test: 'x > y',
      },
    ]);
    expect(entries[0].message).toContain('library says');
    // Each message still reaches the console below.
    expect(calls).toEqual({ warn: 2, error: 1 });
  });
});
