import { createMemo, createSignal, omit, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import type { DemoVariant } from './types';
import { DemoContext } from './DemoContext';

export function DemoRoot(props: DemoRoot.Props) {
  const other = omit(props, 'variants', 'children');
  if (untrack(() => props.variants).length === 0) {
    throw new Error('No demo variants provided');
  }
  const [selectedVariant, setSelectedVariant] = createSignal(() =>
    untrack(() => initialState(props.variants[0])),
  );
  const selectedFile = createMemo(() => selectedVariant().files[0]);
  const contextValue = createMemo<DemoContext>(
    () =>
      ({
        variants: props.variants,
        selectedVariant: selectedVariant(),
        selectedFile: selectedFile(),
        setSelectedVariant,
      }) satisfies DemoContext,
  );
  return (
    <DemoContext value={contextValue}>
      <div {...other}>{props.children}</div>
    </DemoContext>
  );
}
export namespace DemoRoot {
  export interface Props extends ReactProps<JSX.HTMLAttributes<HTMLDivElement>> {
    variants: DemoVariant[];
  }
}
