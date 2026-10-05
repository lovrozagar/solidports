import { defineSsrFixtures } from '../../test/defineSsrFixtures';
import { useIsHydrating } from './useIsHydrating';

function TestComponent() {
  const isHydrating = useIsHydrating();

  return <span data-testid="value">{String(isHydrating())}</span>;
}

export default defineSsrFixtures(import.meta.url, {
  value: () => <TestComponent />,
});
