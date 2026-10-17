import { createSignal } from 'solid-js';
import { Meter } from '@solidports/base-ui/meter';
import { Progress } from '@solidports/base-ui/progress';
import { Separator } from '@solidports/base-ui/separator';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/*
 * The native static parts on the server path, with literal and reactive inputs written out (a
 * spread makes the props a proxy, which takes the slow path). `staticParts.hydration.test.tsx`
 * changes each fixture's signal twice after hydration and checks every part against the same
 * tree rendered on the client.
 */

export const INITIAL = {
  orientation: 'horizontal',
  progress: 40,
  indeterminate: null,
  meter: 30,
} as const;

export const [orientation, setOrientation] = createSignal<'horizontal' | 'vertical'>(
  INITIAL.orientation,
);
export const [progressValue, setProgressValue] = createSignal<number | null>(INITIAL.progress);
export const [indeterminateValue, setIndeterminateValue] = createSignal<number | null>(
  INITIAL.indeterminate,
);
export const [meterValue, setMeterValue] = createSignal<number>(INITIAL.meter);

function ProgressTree(props: { value: number | null }) {
  return (
    <Progress.Root value={props.value}>
      <Progress.Track
        data-testid="progress-track"
        class={(state: Progress.Track.State) => `track-${state.status}`}
      >
        <Progress.Indicator data-testid="progress-indicator" style={{ color: 'red' }} />
      </Progress.Track>
    </Progress.Root>
  );
}

export default defineSsrFixtures(import.meta.url, {
  separators: () => (
    <div>
      <Separator data-testid="separator-default" />
      <Separator data-testid="separator-literal" orientation="vertical" aria-label="rule" />
      <Separator data-testid="separator-reactive" orientation={orientation()} />
    </div>
  ),
  progress: () => <ProgressTree value={progressValue()} />,
  progressIndeterminate: () => <ProgressTree value={indeterminateValue()} />,
  meter: () => (
    <Meter.Root value={meterValue()}>
      <Meter.Track data-testid="meter-track" title="track">
        <Meter.Indicator data-testid="meter-indicator" />
      </Meter.Track>
    </Meter.Root>
  ),
});
