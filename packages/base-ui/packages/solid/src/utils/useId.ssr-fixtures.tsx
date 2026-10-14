import { createSignal } from 'solid-js';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';
import { useId } from './useId';

// The id prop the hydrated fixtures read, as React's `setProps` updates a rendered element's props.
// The server renders its own copy of this module, so it always renders the initial values.
const [providedId, setProvidedId] = createSignal<string | undefined>('some-id');
const [overrideId, setOverrideId] = createSignal<string | undefined>(undefined);
export { setProvidedId, setOverrideId };

function TestComponent(props: { id?: string | undefined }) {
  const id = useId(() => props.id);
  return <span data-testid="target" id={id()} />;
}

export default defineSsrFixtures(import.meta.url, {
  providedId: () => <TestComponent id={providedId()} />,
  generatedId: () => <TestComponent id={overrideId()} />,
  serverId: () => <TestComponent />,
});
