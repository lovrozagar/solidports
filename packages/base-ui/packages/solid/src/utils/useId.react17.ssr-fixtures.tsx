import { untrack } from 'solid-js';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';
import { useId } from './useId';

export function TestComponent(props: {
  id?: string | undefined;
  prefix?: string | undefined;
  onId?: ((id: string) => void) | undefined;
}) {
  // The prefix is read once, as React's `useId` reads it on the first render.
  const id = useId(() => props.id, untrack(() => props.prefix));
  return (
    <span
      data-testid="target"
      id={(() => {
        const value = id();
        props.onId?.(value);
        return value;
      })()}
    />
  );
}

export default defineSsrFixtures(import.meta.url, {
  generated: () => <TestComponent />,
});
