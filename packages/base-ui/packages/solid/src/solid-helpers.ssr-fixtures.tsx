import { createContext, createSignal, Show, useContext } from 'solid-js';
import { defineSsrFixtures } from '../test/defineSsrFixtures';
import { provideContext } from './solid-helpers';

// `provideContext` on every side (D5): the server and hydration render the context's provider,
// the client after hydration one transparent owner. `lateMounts` shows readers once hydration is
// done, under the provider hydration created and under one the client creates then.

const Label = createContext('none');
const [late, setLate] = createSignal(false);

/** Shows the readers that mount after hydration. */
export const showLateReaders = setLate;

function Reader(props: { id: string }) {
  const label = useContext(Label);
  return <span data-testid={props.id}>{label}</span>;
}

export default defineSsrFixtures(import.meta.url, {
  lateMounts: () =>
    provideContext(Label, 'hydrated', () => (
      <div>
        <Reader id="early" />
        <Show when={late()}>
          <Reader id="late-under-hydrated" />
          {provideContext(Label, 'client', () => (
            <Reader id="late-under-client" />
          ))}
        </Show>
      </div>
    )),
});
