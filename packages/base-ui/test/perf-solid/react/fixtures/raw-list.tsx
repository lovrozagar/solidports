/*
 * Raw-React floor for a list's highlight: 1,000 options and an active index, each option marking
 * itself `data-highlighted` when it is the active one. A move re-renders the list and the two
 * options whose highlight changed (`React.memo`). Every Solid variant's id maps to it.
 */
import * as React from 'react';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const Option = React.memo(function Option(props: { index: number; highlighted: boolean }) {
  return (
    <div role="option" aria-selected="false" data-highlighted={props.highlighted ? '' : undefined}>
      Item {props.index}
    </div>
  );
});

function RawList() {
  const active = useExposed('active', -1);
  const count = size(1000);
  const options = [];
  for (let i = 0; i < count; i += 1) {
    options.push(<Option key={i} index={i} highlighted={active === i} />);
  }
  return <div role="listbox">{options}</div>;
}

export const fixtures: Record<string, React.FC> = {
  'select/raw-list-1000-direct': RawList,
  'select/raw-list-1000-keyed': RawList,
  'select/raw-list-1000-library': RawList,
};
