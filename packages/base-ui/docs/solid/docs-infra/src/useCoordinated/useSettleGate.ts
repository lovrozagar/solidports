import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { SettleGate } from './createSettleGate';
import { pageSettleGate } from './pageSettleGate';

/**
 * Register the calling component as a source on a settle gate and release it
 * once `settled` is `true`. Generalizes `useCoordinatedLazy`: registration
 * happens on mount and the release is idempotent, so a component that unmounts
 * before settling can't hold the gate open. Defaults to the page-global
 * {@link pageSettleGate}; pass `null` to opt out of registration entirely (used
 * when a swap conditionally registers with a controller gate that may be
 * absent).
 */
export function useSettleGate(
  settled: Accessor<boolean>,
  _gate?: Accessor<SettleGate | null | undefined>,
): void {
  const gate = createMemo(() => {
    const _gate2 = _gate?.();
    return _gate2 === undefined ? pageSettleGate : _gate2;
  });
  const settleRef: {
    current: (() => void) | null;
  } = {
    current: null,
  };
  createEffect(
    () => [gate()],
    () => {
      const _gate3 = gate();
      if (!_gate3) {
        return undefined;
      }
      settleRef.current = _gate3.register();
      return () => {
        // Idempotent - doubles as a release when the component unmounts before it
        // ever settled, so it can't hold the gate open for the rest of the page.
        settleRef.current?.();
        settleRef.current = null;
      };
    },
  );
  createEffect(
    () => [settled()],
    () => {
      if (settled()) {
        settleRef.current?.();
      }
    },
  );
}
