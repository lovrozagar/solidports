import type { Accessor } from 'solid-js';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';
import { useIsHydrated, useIsHydrating } from './hydration';

export function createProbe(hook: () => Accessor<boolean>, testId: string) {
  return function Probe() {
    const value = hook();
    return <span data-testid={testId}>{value() ? 'yes' : 'no'}</span>;
  };
}

const HydratedProbe = createProbe(useIsHydrated, 'hydrated');
const HydratingProbe = createProbe(useIsHydrating, 'hydrating');

export default defineSsrFixtures(import.meta.url, {
  hydrated: () => <HydratedProbe />,
  hydrating: () => <HydratingProbe />,
});
