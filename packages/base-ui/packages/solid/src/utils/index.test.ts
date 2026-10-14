import { isJSDOM } from '#test-utils';
import * as Utils from '@solidports/base-ui/utils';
import { expect, describe, it } from 'vitest';

describe('@solidports/base-ui/utils', () => {
  it('should have exports', () => {
    expect(typeof Utils).toBe('object');
  });

  it('should not have undefined exports', () => {
    Object.keys(Utils).forEach((exportKey) => {
      const value = (Utils as Record<string, unknown>)[exportKey];
      expect(value).not.toBe(undefined);
    });
  });

  it.skipIf(!isJSDOM)('should expose the expected util surface', () => {
    expect(Array.isArray(Utils.EMPTY_ARRAY)).toBe(true);
    expect(typeof Utils.NOOP).toBe('function');
    expect(typeof Utils.formatErrorMessage).toBe('function');
    expect(typeof Utils.expectType).toBe('function');
    expect(typeof Utils.useTimeout).toBe('function');
    expect(typeof Utils.useBaseUiId).toBe('function');
    expect(typeof Utils.PopupTriggerMap).toBe('function');
  });
});
