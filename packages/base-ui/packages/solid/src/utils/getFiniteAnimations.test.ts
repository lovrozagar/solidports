import { describe, expect, it } from 'vitest';
import { getFiniteAnimations } from './getFiniteAnimations';

describe('getFiniteAnimations', () => {
  it('drops animations whose duration or iteration count never finishes', () => {
    const options = { subtree: true };
    const finite = animation({ duration: 200, iterations: 1 });
    const noEffect = { effect: null } as Animation;
    const element = {
      getAnimations(received: GetAnimationsOptions | undefined) {
        expect(received).toBe(options);
        return [
          finite,
          animation({ duration: Infinity, iterations: 1 }),
          animation({ duration: 200, iterations: Infinity }),
          noEffect,
        ];
      },
    } as Element;

    expect(getFiniteAnimations(element, options)).toEqual([finite, noEffect]);
  });
});

function animation(timing: { duration: number; iterations: number }): Animation {
  return { effect: { getTiming: () => timing } } as Animation;
}
