/*
 * The unit-suite warning census (plan 3, leaf 1.10): every `console.warn` and `console.error` a
 * test run produces, recorded with its suite, test, Solid diagnostic code and origin before the
 * shared console check or the harness filter sees it, so what the harness swallows is counted
 * too. `setupSolid.ts` installs it when `SOLID_WARNING_CENSUS` names a file (JSONL, jsdom only);
 * `scripts/warning-census.mjs` turns the file into a per-suite report.
 */

/** Where a message came from: the first stack frame outside dependencies and this module. */
export type Origin = 'library' | 'harness' | 'test' | 'dependency';

export interface CensusEntry {
  /** The test file, relative to the package. */
  file: string;
  /** The test's full name. */
  test: string;
  kind: 'warn' | 'error';
  /** A Solid diagnostic code (`[FLUSH_IN_EFFECT_CALLBACK] …`), or `null`. */
  code: string | null;
  /** The message's first line, at most 200 characters. */
  message: string;
  origin: Origin;
  /** Whether the harness drops it (`setupSolid.ts`'s filter for its own flushes). */
  swallowed: boolean;
}

/** The location in one V8 stack line: `at fn (location)` or `at location`. */
const locationOf = (line: string) => {
  const match = /\((.*)\)\s*$/.exec(line) ?? /at\s+(.*)$/.exec(line);
  return match ? match[1] : '';
};

const HARNESS_PACKAGES =
  /node_modules\/(@solidjs\/testing-library|@testing-library\/|@mui\/internal-test-utils)/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?(\?|:|$)/;

/** The origin of the code that logged, from its stack (jsdom paths or browser-mode URLs). */
export function originOf(stack: string): Origin {
  for (const line of stack.split('\n').slice(1)) {
    const location = locationOf(line.trim());
    if (!location || /warningCensus\.ts/.test(location)) {
      continue;
    }
    if (HARNESS_PACKAGES.test(location)) {
      return 'harness';
    }
    if (location.includes('node_modules/') || location.startsWith('node:')) {
      continue;
    }
    if (TEST_FILE.test(location)) {
      return 'test';
    }
    if (/(^|\/)test\//.test(location.replace(/^[a-z]+:\/\/[^/]+/, ''))) {
      return 'harness';
    }
    if (/(^|\/)src\//.test(location.replace(/^[a-z]+:\/\/[^/]+/, ''))) {
      return 'library';
    }
  }
  return 'dependency';
}

/** The Solid diagnostic code a message starts with, or `null`. */
export function codeOf(message: string): string | null {
  return /^\[([A-Z_]+)\]/.exec(message)?.[1] ?? null;
}

interface CensusOptions {
  /** The console to wrap. */
  target: Pick<Console, 'warn' | 'error'>;
  write: (entry: CensusEntry) => void;
  /** The running test's file and full name. */
  context: () => { file: string; test: string };
  /** Whether the harness will drop this message. */
  swallowed: (message: string) => boolean;
}

/** A census over `target`: `install` wraps its `warn` and `error` and returns the uninstall. */
export function createCensus(options: CensusOptions) {
  return {
    install() {
      const { target } = options;
      const original = { warn: target.warn, error: target.error };
      const wrap =
        (kind: 'warn' | 'error') =>
        (...args: unknown[]) => {
          const message = String(args[0] ?? '');
          const { file, test } = options.context();
          options.write({
            file,
            test,
            kind,
            code: codeOf(message),
            message: message.split('\n')[0].slice(0, 200),
            origin: originOf(new Error().stack ?? ''),
            swallowed: options.swallowed(message),
          });
          original[kind].apply(target, args);
        };
      target.warn = wrap('warn');
      target.error = wrap('error');
      return () => {
        target.warn = original.warn;
        target.error = original.error;
      };
    },
  };
}
