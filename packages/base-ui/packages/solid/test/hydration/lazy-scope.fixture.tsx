import { Errored, getOwner } from 'solid-js';
import { runInLazyScope } from '../../src/utils/runInLazyScope';

/** The error the fixture's boundary caught, if any. */
export const caught: { error?: unknown } = {};

/**
 * Breaks the lazy-scope contract on purpose: an element rendered inside `runInLazyScope`, where
 * scope ids differ between the server and the client. A boundary on both sides catches the error.
 */
export function LazyScopeElement() {
  const owner = getOwner();
  return (
    <Errored
      fallback={(error) => {
        caught.error = error();
        return null;
      }}
    >
      <div>{runInLazyScope(owner, () => <span data-testid="inside" />)}</div>
    </Errored>
  );
}
