/**
 * Whether the test runs in JSDOM environment
 */
// Solid: the public `utils` entry re-exports this module (upstream ships it as its own subpath), so
// it must load on the server too.
export const isJSDOM = typeof window !== 'undefined' && /jsdom/.test(window.navigator.userAgent);

export type IfEquals<T, U, Y = unknown, N = never> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;

export function expectType<Expected, Actual>(_actual: IfEquals<Actual, Expected, Actual>): void {}
