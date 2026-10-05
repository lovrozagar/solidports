import { createMemo, createSignal, Loading } from 'solid-js';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * Per-test state the fixtures read when they render. The server build has its own instance;
 * `reset()` gives the client a fresh handle and gate before each test.
 */
export const fixtureState = {
  handle: Tooltip.createHandle(),
  onOpenChange: (() => {}) as (open: boolean, details: unknown) => void,
  /** While set, the delayed trigger reads a pending async value (React: a thrown promise). */
  suspend: false,
  resume: undefined as (() => void) | undefined,
  gate: undefined as Promise<void> | undefined,
  reset() {
    this.handle = Tooltip.createHandle();
    this.onOpenChange = () => {};
    this.suspend = false;
    this.gate = new Promise<void>((resolve) => {
      this.resume = resolve;
    });
  },
};

function DelayedTrigger() {
  const gate = fixtureState.suspend ? fixtureState.gate : undefined;
  const ready = createMemo(() => (gate ? gate.then(() => true) : true));
  return (
    <>
      {ready() && (
        <Tooltip.Trigger handle={fixtureState.handle} id="trigger">
          Trigger
        </Tooltip.Trigger>
      )}
    </>
  );
}

function SwitchingApp() {
  const [open, setOpen] = createSignal(true);
  const [activeTriggerId, setActiveTriggerId] = createSignal('trigger-a');
  return (
    <>
      <button type="button" onClick={() => setActiveTriggerId('trigger-b')}>
        Switch to B
      </button>
      <Tooltip.Root
        handle={fixtureState.handle}
        open={open()}
        triggerId={activeTriggerId()}
        onOpenChange={(nextOpen, eventDetails) => {
          fixtureState.onOpenChange(nextOpen, eventDetails);
          setOpen(nextOpen);
        }}
      />
      {activeTriggerId() === 'trigger-a' && (
        <Tooltip.Trigger handle={fixtureState.handle} id="trigger-a">
          Trigger A
        </Tooltip.Trigger>
      )}
    </>
  );
}

export default defineSsrFixtures(import.meta.url, {
  delayedTrigger: () => (
    <>
      <Tooltip.Root handle={fixtureState.handle} defaultOpen defaultTriggerId="trigger" />
      <Loading fallback="Loading">
        <DelayedTrigger />
      </Loading>
    </>
  ),
  switchingApp: () => <SwitchingApp />,
  triggerB: () => (
    <Tooltip.Trigger handle={fixtureState.handle} id="trigger-b">
      Trigger B
    </Tooltip.Trigger>
  ),
});
