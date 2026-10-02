import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

export type MeterRootContext = {
  formattedValue: Accessor<string>;
  percentageValue: Accessor<number>;
  setLabelId: Setter<string | undefined>;
  value: Accessor<number>;
};

export const MeterRootContext = createContext<MeterRootContext | null>(null);

export function useMeterRootContext() {
  const context = useContext(MeterRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
    );
  }

  return context;
}
