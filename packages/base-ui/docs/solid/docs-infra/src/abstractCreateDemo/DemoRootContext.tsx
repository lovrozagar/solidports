import { createContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

export const DemoRootContext = createContext<
  Accessor<{
    current: HTMLDivElement | null;
  } | null>
>(() => null);

/** Provides the rendered demo root to client descendants. */
export function DemoRootProvider(props: { children: JSX.Element }) {
  const rootRef: {
    current: HTMLDivElement | null;
  } = {
    current: null,
  };
  return (
    <DemoRootContext value={() => rootRef}>
      <div
        ref={(element) => {
          rootRef.current = element;
        }}
        class="demo"
      >
        {props.children}
      </div>
    </DemoRootContext>
  );
}
