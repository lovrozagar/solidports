/*
 * The hand-written Solid floor for an open Combobox list (D32's sweep, after Select and Menu): the
 * fewest reactive nodes plain Solid 2 needs for the DOM and ARIA `Combobox.Item` renders while open
 * (focus stays on the input, so an option has no `tabindex`; its id is the list's id and its
 * index). The highlight and the selection are read through keyed selectors (`listHighlight.ts`),
 * so a move or a selection re-runs only the two items it changes. A hand-written list knows each
 * item's index; it registers nothing. Handlers are module-level functions bound to the item's
 * record.
 *
 * Cost tests (`combobox.cost.test.tsx`) hold an open `Combobox.Item` to this item's nodes plus 25%.
 */
import { createContext, createRenderEffect, createUniqueId, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { keyedHighlight } from './listHighlight';
import type { IsHighlighted } from './listHighlight';

interface FloorComboboxContextValue {
  id: string;
  isHighlighted: IsHighlighted<number>;
  isSelected: IsHighlighted<unknown>;
  setActive: Setter<number>;
  select: (value: unknown) => void;
}

const FloorComboboxContext = createContext<FloorComboboxContextValue | null>(null);

export interface FloorComboboxListProps {
  /** The highlighted item's index (`-1` for none). */
  active: Accessor<number>;
  setActive: Setter<number>;
  /** The selected value. */
  value: Accessor<unknown>;
  onSelect: (value: unknown) => void;
  children?: JSX.Element;
}

/** The open list: its id, one keyed selector for the highlight and one for the selection. */
export function FloorComboboxList(props: FloorComboboxListProps) {
  const value: FloorComboboxContextValue = {
    id: `base-ui-${createUniqueId()}`,
    isHighlighted: keyedHighlight(props.active),
    isSelected: keyedHighlight(props.value),
    setActive: props.setActive,
    select: props.onSelect,
  };
  return (
    <FloorComboboxContext value={value}>
      <div role="listbox">{props.children}</div>
    </FloorComboboxContext>
  );
}

/** What an item's handlers act on: one object per item. */
interface FloorComboboxItemRecord {
  context: FloorComboboxContextValue;
  value: unknown;
  index: number;
}

function itemClick(record: FloorComboboxItemRecord) {
  record.context.select(record.value);
}

function itemMove(record: FloorComboboxItemRecord) {
  record.context.setActive(record.index);
}

function preventBlur(_record: FloorComboboxItemRecord, event: MouseEvent) {
  // Focus stays on the input.
  event.preventDefault();
}

export interface FloorComboboxItemProps {
  value: unknown;
  index: number;
  children?: JSX.Element;
}

/** An open option: one render effect writes its highlight and selection attributes. */
export function FloorComboboxItem(props: FloorComboboxItemProps) {
  const context = useContext(FloorComboboxContext)!;
  const record: FloorComboboxItemRecord = { context, value: props.value, index: props.index };
  const el = (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- focus stays on the input, which owns the keyboard; Combobox.Item's option has no tabindex either
    <div
      id={`${context.id}-${props.index}`}
      aria-selected="false"
      role="option"
      onClick={[itemClick, record]}
      onMouseDown={[preventBlur, record]}
      onMouseMove={[itemMove, record]}
    >
      {props.children}
    </div>
  ) as HTMLDivElement;
  createRenderEffect(
    () => {
      const highlighted = context.isHighlighted(record.index);
      const selected = context.isSelected(record.value);
      // One number for both reads, so the apply runs only when either changes.
      return (highlighted ? 1 : 0) + (selected ? 2 : 0);
    },
    (flags) => {
      const highlighted = flags % 2 === 1;
      const selected = flags >= 2;
      el.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (highlighted) {
        el.setAttribute('data-highlighted', '');
      } else {
        el.removeAttribute('data-highlighted');
      }
      if (selected) {
        el.setAttribute('data-selected', '');
      } else {
        el.removeAttribute('data-selected');
      }
    },
  );
  return el;
}
