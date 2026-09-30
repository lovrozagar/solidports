import { AriaCombobox } from './AriaCombobox';

/* Type assertions for the collapsed single-signature of AriaCombobox.
 * Overloads were removed due to vite-plugin-solid's oxc TS stripper rejecting
 * function overload syntax. These checks pin the prop ergonomics so a future
 * overload restore can prove type equivalence. */

/* Mode='single' — selectedValue accepts Value. */
<AriaCombobox<string, 'single'>
  selectionMode="single"
  selectedValue="hello"
  onSelectedValueChange={(v) => {
    v.startsWith('a');
  }}
/>;

/* Mode='single' — selectedValue rejects array. */
<AriaCombobox<string, 'single'>
  selectionMode="single"
  // @ts-expect-error — array is not valid for single mode
  selectedValue={['a', 'b']}
/>;

/* Mode='multiple' — selectedValue accepts array. */
<AriaCombobox<string, 'multiple'>
  selectionMode="multiple"
  selectedValue={['a', 'b']}
  onSelectedValueChange={(v) => {
    v.pop();
  }}
/>;

/* Mode='multiple' — selectedValue rejects scalar. */
<AriaCombobox<string, 'multiple'>
  selectionMode="multiple"
  // @ts-expect-error — scalar is not valid for multiple mode
  selectedValue="hello"
/>;

/* Mode='none' — onInputValueChange receives string. */
<AriaCombobox
  onInputValueChange={(v, _e) => {
    v.startsWith('a');
  }}
/>;

/* ChangeEventDetails is exported on the namespace and has the right shape. */
const _cb: AriaCombobox.ChangeEventDetails = {} as AriaCombobox.ChangeEventDetails;
