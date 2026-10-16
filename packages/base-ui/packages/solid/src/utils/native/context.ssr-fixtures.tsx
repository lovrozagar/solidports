import { createContext, createMemo, useContext } from 'solid-js';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import { provideNativeContext, provideNativeContexts } from './context';

// Native context provision on every side (core spec S2, D5): the server and hydration render the
// provider, the client after hydration a transparent owner. Each reader creates an id-consuming
// memo and elements under it, so a server and hydration mismatch leaves server nodes unclaimed and
// moves the sentinel.

const Label = createContext('none');
const Count = createContext(0);

function Reader() {
  const label = useContext(Label);
  const count = useContext(Count);
  const title = createMemo(() => `${label}:${count}`);
  return (
    <span data-testid="reader" title={title()}>
      {label}
    </span>
  );
}

export default defineSsrFixtures(import.meta.url, {
  transparentOwner: () => (
    <div>
      {provideNativeContext(Label, 'one', () => (
        <Reader />
      ))}
      <span>after</span>
    </div>
  ),
  transparentOwnerTwoContexts: () => (
    <div>
      {provideNativeContexts(Label, 'two', Count, 2, () => (
        <>
          <Reader />
          <Reader />
        </>
      ))}
    </div>
  ),
  nestedTransparentOwners: () =>
    provideNativeContext(Label, 'outer', () => (
      <section>
        {provideNativeContext(Label, 'inner', () => (
          <Reader />
        ))}
        <Reader />
      </section>
    )),
});
