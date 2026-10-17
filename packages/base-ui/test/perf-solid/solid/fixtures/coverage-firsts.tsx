// First scenarios for the components that had none (plan 3, leaf 1.13): Fieldset and the
// unstable useMediaQuery hook. Same markup as `react/fixtures/coverage-firsts.tsx`.
import { For } from 'solid-js';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { useMediaQuery } from '@solidports/base-ui/unstable-use-media-query';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Fieldsets() {
  const disabled = useExposed('disabled', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Fieldset.Root disabled={disabled()}>
            <Fieldset.Legend>Legend {i}</Fieldset.Legend>
            <input aria-label={`Field ${i}`} />
          </Fieldset.Root>
        )}
      </For>
    </div>
  );
}

function MediaQueryReader() {
  const wide = useMediaQuery('(min-width: 600px)', {});
  return <span>{wide() ? 'wide' : 'narrow'}</span>;
}

function MediaQueries() {
  return (
    <div>
      <For each={range(size(1000))}>{() => <MediaQueryReader />}</For>
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'fieldset/300': Fieldsets,
  'unstable-use-media-query/1000': MediaQueries,
};
