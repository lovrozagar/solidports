import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { createSignal } from 'solid-js';

const objectItems = [
  { label: 'apple', value: 'a' },
  { label: 'banana', value: 'b' },
  { label: 'cherry', value: 'c' },
];

const objectItemsReadonly = [
  { label: 'apple', value: 'a' },
  { label: 'banana', value: 'b' },
  { label: 'cherry', value: 'c' },
] as const;

const groupItemsReadonly = [
  {
    items: [
      { value: 'a', label: 'apple' },
      { value: 'b', label: 'banana' },
      { value: 'c', label: 'cherry' },
    ],
    value: 'fruits',
  },
  {
    items: [
      { value: 'd', label: 'daikon' },
      { value: 'e', label: 'endive' },
      { value: 'f', label: 'fennel' },
    ],
    value: 'vegetables',
  },
] as const;

<Autocomplete.Root
  items={objectItems}
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    return item.label;
  }}
/>;

<Autocomplete.Root
  items={groupItemsReadonly}
  itemToStringValue={(item) => {
    // @ts-expect-error - item is the nested item from groups, not the group itself
    return item.items;
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItemsReadonly}
  defaultValue="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

<Autocomplete.Root
  items={objectItems}
  value="a"
  onValueChange={(value) => {
    value.startsWith('a');
  }}
/>;

// @ts-expect-error value refers to the input value, not the item object
<Autocomplete.Root items={objectItems} value={objectItems[0]} />;

<Autocomplete.Root
  items={objectItems}
  defaultValue="a"
  itemToStringValue={(item) => {
    return item.value;
  }}
/>;

<Autocomplete.Root
  defaultValue="javascript"
  onValueChange={(value) => {
    // @ts-expect-error
    value.pop();
  }}
/>;

<Autocomplete.Root
  defaultValue="test"
  onValueChange={(value) => {
    value.length;
  }}
/>;

function App2() {
  const [value, setValue] = createSignal('a');
  return (
    <Autocomplete.Root
      value={value()}
      onValueChange={(newValue) => {
        newValue.length;
      }}
    />
  );
}

/* Type assertions for the collapsed single-signature of AutocompleteRoot.
 * Pins ergonomics for a future overload restore. */

/* value prop accepts string. */
<Autocomplete.Root value="hello" />;

/* onValueChange receives string. */
<Autocomplete.Root
  defaultValue="a"
  onValueChange={(v) => {
    v.startsWith('a');
  }}
/>;

/* ChangeEventDetails is exported and usable as a type. */
const _d: Autocomplete.Root.ChangeEventDetails = {} as Autocomplete.Root.ChangeEventDetails;
