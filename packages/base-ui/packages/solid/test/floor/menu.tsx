/*
 * The hand-written Solid floor for an open Menu's items (D32's sweep, after Select): the fewest
 * reactive nodes plain Solid 2 needs for the DOM and ARIA `Menu.Item` renders while open, with the
 * item's highlight read through a keyed selector (`listHighlight.ts`), so a move re-runs only the
 * two items it changes. A hand-written menu knows each item's index and generates its id once; it
 * registers nothing. Handlers are module-level functions bound to the item's record.
 *
 * Cost tests (`menu.cost.test.tsx`) hold an open `Menu.Item` to this item's nodes plus 25%.
 */
import { createContext, createRenderEffect, createUniqueId, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { keyedHighlight } from './listHighlight';
import type { IsHighlighted } from './listHighlight';

interface FloorMenuContextValue {
  isHighlighted: IsHighlighted<number>;
  setActive: Setter<number>;
  activate: (index: number) => void;
}

const FloorMenuContext = createContext<FloorMenuContextValue | null>(null);

export interface FloorMenuListProps {
  /** The highlighted item's index (`-1` for none). */
  active: Accessor<number>;
  setActive: Setter<number>;
  onActivate: (index: number) => void;
  children?: JSX.Element;
}

/** The open menu: one keyed selector for the highlight. */
export function FloorMenuList(props: FloorMenuListProps) {
  const value: FloorMenuContextValue = {
    isHighlighted: keyedHighlight(props.active),
    setActive: props.setActive,
    activate: props.onActivate,
  };
  return (
    <FloorMenuContext value={value}>
      <div role="menu">{props.children}</div>
    </FloorMenuContext>
  );
}

/** What an item's handlers act on: one object per item. */
interface FloorMenuItemRecord {
  context: FloorMenuContextValue;
  index: number;
}

function itemClick(record: FloorMenuItemRecord) {
  record.context.activate(record.index);
}

function itemMove(record: FloorMenuItemRecord) {
  record.context.setActive(record.index);
}

function itemKeyDown(record: FloorMenuItemRecord) {
  record.context.setActive(record.index);
}

export interface FloorMenuItemProps {
  index: number;
  children?: JSX.Element;
}

/** An open item: one render effect writes its highlight; its id is generated once. */
export function FloorMenuItem(props: FloorMenuItemProps) {
  const context = useContext(FloorMenuContext)!;
  const record: FloorMenuItemRecord = { context, index: props.index };
  const el = (
    <div
      id={`base-ui-${createUniqueId()}`}
      tabindex="-1"
      role="menuitem"
      onClick={[itemClick, record]}
      onKeyDown={[itemKeyDown, record]}
      onMouseMove={[itemMove, record]}
    >
      {props.children}
    </div>
  ) as HTMLDivElement;
  createRenderEffect(
    () => context.isHighlighted(record.index),
    (highlighted) => {
      el.setAttribute('tabindex', highlighted ? '0' : '-1');
      if (highlighted) {
        el.setAttribute('data-highlighted', '');
      } else {
        el.removeAttribute('data-highlighted');
      }
    },
  );
  return el;
}
