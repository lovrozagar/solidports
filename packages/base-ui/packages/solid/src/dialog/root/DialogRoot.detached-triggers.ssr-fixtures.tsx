import { createMemo, Loading } from 'solid-js';
import { Dialog } from '@solidports/base-ui/dialog';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * The handle each fixture creates when it renders (on the server and again on hydration); the
 * test reads the client's.
 */
export const fixtureState = {
  handle: undefined as ReturnType<typeof Dialog.createHandle> | undefined,
};

/**
 * Holds the delayed trigger's hydration: while `suspend` is set, the trigger reads a pending
 * async value (React: a thrown promise under `Suspense`), so it hydrates after `resume()`.
 */
export const hydrationGate = {
  suspend: false,
  resume: undefined as (() => void) | undefined,
  promise: undefined as Promise<void> | undefined,
  reset() {
    this.suspend = false;
    this.promise = new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  },
};

function DelayedTrigger(props: { handle: ReturnType<typeof Dialog.createHandle> }) {
  const gate = hydrationGate.suspend ? hydrationGate.promise : undefined;
  const ready = createMemo(() => (gate ? gate.then(() => true) : true));
  return (
    <>
      {ready() && (
        <Dialog.Trigger handle={props.handle} id="trigger">
          Trigger
        </Dialog.Trigger>
      )}
    </>
  );
}

export default defineSsrFixtures(import.meta.url, {
  detachedTrigger: () => {
    const handle = Dialog.createHandle();
    fixtureState.handle = handle;
    return (
      <>
        <Dialog.Root handle={handle} defaultOpen defaultTriggerId="trigger" />
        <Dialog.Trigger handle={handle} id="trigger">
          Trigger
        </Dialog.Trigger>
      </>
    );
  },
  delayedTrigger: () => {
    const handle = Dialog.createHandle();
    fixtureState.handle = handle;
    return (
      <>
        <Dialog.Root handle={handle} defaultOpen defaultTriggerId="trigger" />
        <Loading fallback="Loading">
          <DelayedTrigger handle={handle} />
        </Loading>
      </>
    );
  },
});
