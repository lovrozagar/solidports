import { createContext, createMemo, useContext } from 'solid-js';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import { provideNativeContext, provideNativeContexts } from './context';

// Transparent context owners on every side (core spec S2): the server's `createOwner({ transparent:
// true })` must take no hydration id, as the client's does not, or every key under it shifts. Each
// reader creates an id-consuming memo and elements under the owner, so a mismatch leaves server
// nodes unclaimed and moves the sentinel.

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
