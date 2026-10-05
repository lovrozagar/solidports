/**
 * Structural equality for position data (`@floating-ui/react-dom`'s `deepEqual`): plain objects,
 * arrays and primitives; functions compare by source.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'function' && a.toString() === (b as Function).toString()) {
    return true;
  }
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) {
        return false;
      }
      for (let i = a.length; i-- !== 0;) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b as object).length) {
      return false;
    }
    for (let i = keys.length; i-- !== 0;) {
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (let i = keys.length; i-- !== 0;) {
      const key = keys[i];
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }
  // eslint-disable-next-line no-self-compare -- NaN equals NaN.
  return a !== a && b !== b;
}
