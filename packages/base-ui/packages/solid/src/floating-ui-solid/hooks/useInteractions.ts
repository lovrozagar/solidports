import { createMemo, merge, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mergeProps } from '../../merge-props';
import type { ElementProps } from '../types';
import { ACTIVE_KEY, FOCUSABLE_ATTRIBUTE, SELECTED_KEY } from '../utils/constants';

export type ExtendedUserProps = {
  [ACTIVE_KEY]?: boolean | undefined;
  [SELECTED_KEY]?: boolean | undefined;
};

export interface UseInteractionsReturn {
  getReferenceProps: <T extends Element>(
    userProps?: JSX.HTMLAttributes<T>,
  ) => Record<string, unknown>;
  getFloatingProps: <T extends HTMLElement>(
    userProps?: JSX.HTMLAttributes<T>,
  ) => Record<string, unknown>;
  getItemProps: <T extends HTMLElement>(
    userProps?: Omit<JSX.HTMLAttributes<T>, 'selected' | 'active'> & ExtendedUserProps,
  ) => Record<string, unknown>;
  getTriggerProps: <T extends Element>(
    userProps?: JSX.HTMLAttributes<T>,
  ) => Record<string, unknown>;
}

/**
 * Merges an array of interaction hooks' props into prop getters, allowing
 * event handler functions to be composed together without overwriting one
 * another.
 * @see https://floating-ui.com/docs/useInteractions
 *
 * TODO: Object.assign from proxy is probably not the best way to do it
 */
type Lists = Record<'floating' | 'item' | 'reference' | 'trigger', readonly unknown[]>;

const sameEntries = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

const sameLists = (a: Lists, b: Lists) =>
  sameEntries(a.floating, b.floating) &&
  sameEntries(a.item, b.item) &&
  sameEntries(a.reference, b.reference) &&
  sameEntries(a.trigger, b.trigger);

export function useInteractions(propsList: Array<ElementProps> = []): UseInteractionsReturn {
  // Solid: equal when every list holds the same entries. A hook's getter re-read without change
  // (state read, same object back) then notifies nothing; otherwise every merged view below
  // re-merges, and a list's every item re-enumerates its props on each open and close.
  const lists = createMemo(
    () => {
      const referenceList: JSX.HTMLAttributes<any>[] = [];
      const floatingList: JSX.HTMLAttributes<any>[] = [];
      const itemList: ElementProps['item'][] = [];
      const triggerList: JSX.HTMLAttributes<any>[] = [];
      for (const item of propsList) {
        if (item?.reference) {
          referenceList.push(item.reference);
        }
        if (item?.floating) {
          floatingList.push(item.floating);
        }
        if (item?.item) {
          itemList.push(item.item);
        }
        if (item?.trigger) {
          triggerList.push(item.trigger);
        }
      }

      return {
        floating: floatingList.filter(Boolean),
        item: itemList.filter(Boolean),
        reference: referenceList.filter(Boolean),
        trigger: triggerList.filter(Boolean),
      };
    },
    { equals: sameLists },
  );

  // React calls these getters every render. In Solid they are called once, so each returns a
  // live view that re-merges when the hooks' prop lists change.
  const live = (build: () => Record<string, unknown>) => merge(build) as any;

  return {
    getFloatingProps(userProps) {
      return live(() =>
        mergeProps(
          [{ tabindex: -1, [FOCUSABLE_ATTRIBUTE as any]: '' }, ...lists().floating, userProps],
          { callAllHandlers: true },
        ),
      );
    },
    getItemProps(userProps) {
      return live(() =>
        // `active`/`selected` are item states for the consumer, not DOM props: omit them (React
        // skips these keys). Set to `undefined`, they would override an explicit prop when spread.
        mergeProps(
          [
            // A function item entry receives the item states, as floating-ui calls it with the
            // user props (`active`, `selected`); `mergeProps` would hand it the merged props.
            ...lists().item.map((item) =>
              typeof item === 'function' ? item((userProps ?? {}) as ExtendedUserProps) : item,
            ),
            userProps ? omit(userProps, ACTIVE_KEY, SELECTED_KEY) : undefined,
          ],
          {
            callAllHandlers: true,
          },
        ),
      );
    },
    getReferenceProps(userProps) {
      return live(() => mergeProps([...lists().reference, userProps], { callAllHandlers: true }));
    },
    getTriggerProps(userProps) {
      return live(() => mergeProps([...lists().trigger, userProps], { callAllHandlers: true }));
    },
  };
}
