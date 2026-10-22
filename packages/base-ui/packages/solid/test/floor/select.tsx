/*
 * The hand-written Solid floor for an open Select list (plan 3 leaf 5.6.0, D32): the fewest reactive
 * nodes plain Solid 2 needs for the DOM and ARIA `Select.Item` / `.ItemText` render while open,
 * with the item's highlight and selection read through keyed selectors (`listHighlight.ts`), so a
 * move or a selection re-runs only the two items it changes. A hand-written list knows each item's
 * index, so the floor takes it as a prop; it registers nothing. Handlers are module-level functions
 * bound to the item's record: an item holds its value, its index and its element, nothing per
 * handler.
 *
 * Cost tests (`select.cost.test.tsx`) hold an open `Select.Item` with its `ItemText` to this item's
 * nodes plus 25%; the bench's `select/raw-1000` renders it beside `select/1000` for the heap row.
 */
import { createContext, createRenderEffect, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { conditional } from './conditional';
import { keyedHighlight } from './listHighlight';
import type { IsHighlighted } from './listHighlight';

interface FloorSelectContextValue {
  isHighlighted: IsHighlighted<number>;
  isSelected: IsHighlighted<unknown>;
  setActive: Setter<number>;
  select: (value: unknown) => void;
}

const FloorSelectContext = createContext<FloorSelectContextValue | null>(null);

export interface FloorSelectListProps {
  /** The highlighted item's index (`-1` for none). */
  active: Accessor<number>;
  setActive: Setter<number>;
  /** The selected value. */
  value: Accessor<unknown>;
  onSelect: (value: unknown) => void;
  children?: JSX.Element;
}

/** The open list: one keyed selector for the highlight and one for the selection. */
export function FloorSelectList(props: FloorSelectListProps) {
  const value: FloorSelectContextValue = {
    isHighlighted: keyedHighlight(props.active),
    isSelected: keyedHighlight(props.value),
    setActive: props.setActive,
    select: props.onSelect,
  };
  return (
    <FloorSelectContext value={value}>
      <div role="listbox">{props.children}</div>
    </FloorSelectContext>
  );
}

/** What an item's handlers act on: one object per item. */
interface FloorItemRecord {
  context: FloorSelectContextValue;
  value: unknown;
  index: number;
}

function itemClick(record: FloorItemRecord) {
  record.context.select(record.value);
}

function itemMove(record: FloorItemRecord) {
  record.context.setActive(record.index);
}

function itemKeyDown(record: FloorItemRecord) {
  record.context.setActive(record.index);
}

export interface FloorSelectItemProps {
  value: unknown;
  index: number;
  /** The selection indicator, rendered before the children while the item is selected. */
  indicator?: () => JSX.Element;
  children?: JSX.Element;
}

/**
 * An open option: one render effect writes its highlight and selection attributes; its two
 * handlers are module-level functions bound to the item's record; the indicator is a conditional
 * branch on the item's own selection read.
 */
export function FloorSelectItem(props: FloorSelectItemProps) {
  const context = useContext(FloorSelectContext)!;
  const record: FloorItemRecord = { context, value: props.value, index: props.index };
  const render = props.indicator;
  const indicator = render
    ? conditional(() => context.isSelected(record.value), render)
    : undefined;
  const el = (
    <div
      role="option"
      aria-selected="false"
      tabindex="-1"
      onClick={[itemClick, record]}
      onKeyDown={[itemKeyDown, record]}
      onMouseMove={[itemMove, record]}
    >
      {indicator}
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
      el.setAttribute('tabindex', highlighted ? '0' : '-1');
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

/** The item's text: a plain element. */
export function FloorSelectItemText(props: { children?: JSX.Element }) {
  return <div>{props.children}</div>;
}
