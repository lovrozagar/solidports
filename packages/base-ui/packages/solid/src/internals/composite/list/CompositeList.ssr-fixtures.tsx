import { defineSsrFixtures } from '../../../../test/defineSsrFixtures';
import { CompositeList } from './CompositeList';
import { useCompositeListItem } from './useCompositeListItem';

/** The list's element and label refs; the client build's instance is the one the test reads. */
export const hydratedRefs = {
  elements: [] as Array<HTMLElement | null | undefined>,
  labels: [] as Array<string | null>,
};

function Item(props: { label: string }) {
  const { setRef, index } = useCompositeListItem();
  return <div ref={setRef} data-testid={props.label} data-index={index()} />;
}

export default defineSsrFixtures(import.meta.url, {
  list: () => (
    <CompositeList refs={hydratedRefs}>
      <Item label="a" />
      <Item label="b" />
    </CompositeList>
  ),
});
