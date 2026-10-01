import { createUniqueId, type JSX } from 'solid-js';


import { Combobox } from '@solidports/base-ui/combobox';
import styles from './index.module.css';

export default function ExampleCreateItemsCombobox() {
  const id = createUniqueId();

  return (
    <Combobox.Root items={items} defaultValue="banana">
      <div class={styles.Label}>
        <label for={id}>Choose a fruit</label>
        <Combobox.InputGroup class={styles.InputGroup}>
          <Combobox.Input placeholder="e.g. Apple" id={id} class={styles.Input} />
          <div class={styles.ActionButtons}>
            <Combobox.Clear class={styles.Clear} aria-label="Clear selection">
              <XIcon />
            </Combobox.Clear>
            <Combobox.Trigger class={styles.Trigger} aria-label="Open popup">
              <CaretDownIcon />
            </Combobox.Trigger>
          </div>
        </Combobox.InputGroup>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner class={styles.Positioner} sideOffset={4}>
          <Combobox.Popup class={styles.Popup}>
            <Combobox.Empty>
              <div class={styles.Empty}>No fruits found.</div>
            </Combobox.Empty>
            <Combobox.List class={styles.List}>
              {(item) => (
                <Combobox.Item key={item.id} value={item.id} class={styles.Item}>
                  <Combobox.ItemIndicator class={styles.ItemIndicator}>
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                  <span class={styles.ItemText}>{item.name}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
    </svg>
  );
}

function CaretDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}

interface Fruit {
  id: string;
  name: string;
}

const fruits: Fruit[] = [
  { id: 'apple', name: 'Apple' },
  { id: 'banana', name: 'Banana' },
  { id: 'orange', name: 'Orange' },
  { id: 'pineapple', name: 'Pineapple' },
  { id: 'grape', name: 'Grape' },
  { id: 'mango', name: 'Mango' },
  { id: 'strawberry', name: 'Strawberry' },
  { id: 'blueberry', name: 'Blueberry' },
  { id: 'raspberry', name: 'Raspberry' },
  { id: 'blackberry', name: 'Blackberry' },
  { id: 'cherry', name: 'Cherry' },
  { id: 'peach', name: 'Peach' },
  { id: 'pear', name: 'Pear' },
  { id: 'plum', name: 'Plum' },
  { id: 'kiwi', name: 'Kiwi' },
  { id: 'watermelon', name: 'Watermelon' },
];

const items = Combobox.createItems(fruits, {
  getValue: (fruit) => fruit.id,
  getLabel: (fruit) => fruit.name,
});
