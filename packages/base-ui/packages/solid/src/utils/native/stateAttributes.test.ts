import { describe, expect, it } from 'vitest';
import { compileStateAttributes, writeStateAttributes } from './element';
import type { SetAttribute } from './element';

const collect = (write: (set: SetAttribute) => void) => {
  const out: Record<string, unknown> = {};
  write({
    set(key, value) {
      out[key] = value;
    },
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

// The default writer maps every own key of the state, as the slow path's `getStateAttributesProps`
// does for a state object. A class instance's own fields are not its state: a native Tooltip
// trigger whose model was passed as state without a writer rendered `data-isopen`, `data-sources`
// and its other fields (D32). The kit refuses that shape instead of writing it.
describe('compileStateAttributes on a class instance', () => {
  it('throws, naming the explicit state writer to pass', () => {
    class Model {
      declare readonly isOpen: () => boolean;
      constructor() {
        this.isOpen = () => true;
      }

      get open() {
        return this.isOpen();
      }
    }
    expect(() => compileStateAttributes(new Model(), undefined)).toThrow(/stateWriter/);
  });

  it('still compiles a plain state object and an object without a prototype', () => {
    expect(() => compileStateAttributes({ open: true }, undefined)).not.toThrow();
    expect(() => compileStateAttributes(Object.create(null), undefined)).not.toThrow();
  });
});
