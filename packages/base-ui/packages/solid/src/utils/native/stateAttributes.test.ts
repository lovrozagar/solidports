import { describe, expect, it } from 'vitest';
import { compileStateAttributes, writeStateAttributes } from './element';

const collect = (write: (set: (key: string, value: unknown) => void) => void) => {
  const out: Record<string, unknown> = {};
  write((key, value) => {
    out[key] = value;
  });
  return out;
};

describe('compileStateAttributes', () => {
  const transitionStatus = (value: unknown): Record<string, string> | null => {
    if (value === 'starting') {
      return { 'data-starting-style': '' };
    }
    if (value === 'ending') {
      return { 'data-ending-style': '' };
    }
    return null;
  };
  const mapping = { transitionStatus } as never;

  it('writes what writeStateAttributes writes, for every value kind and a custom mapper', () => {
    let open: unknown = true;
    const state = {
      get open() {
        return open;
      },
      disabled: false,
      orientation: 'vertical',
      index: 0,
      label: '',
      value: undefined,
      transitionStatus: 'starting',
      camelCaseKey: 'x',
    };
    const compiled = compileStateAttributes(state, mapping);
    expect(collect((set) => compiled(state, set))).toEqual(
      collect((set) => writeStateAttributes(state, mapping, set)),
    );
    open = false;
    expect(collect((set) => compiled(state, set))).toEqual(
      collect((set) => writeStateAttributes(state, mapping, set)),
    );
  });

  it('compiles once per mapping and state shape, and reads the state live', () => {
    const a = { open: true, disabled: false };
    const b = { open: false, disabled: true };
    expect(compileStateAttributes(a, undefined)).toBe(compileStateAttributes(b, undefined));
    expect(collect((set) => compileStateAttributes(b, undefined)(b, set))).toEqual({
      'data-disabled': '',
    });
  });
});
