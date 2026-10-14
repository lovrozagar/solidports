import { onCleanup } from 'solid-js';
import { mergeProps } from '../../merge-props';
import { ownerDocument } from '../../utils/owner';
import { activeElement } from '../../utils/shadowDom';
import type { HTMLProps } from '../../utils/types';
import { FilterDropdownInput } from '../../filter-dropdown/input/FilterDropdownInput';
import { useFilterDropdownValueContext } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { useMenuFilterKeyDown } from '../filter-root/useMenuFilterKeyDown';
import { useMenuFilterPart } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';

/**
 * A search field that filters the menu items.
 * Requires the menu to be wrapped in `Menu.FilterProvider`.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuInput(props: MenuInput.Props) {
  useMenuFilterPart('Input');
  const { store } = useMenuRootContext();
  const value = useFilterDropdownValueContext();
  const storeInputProps = store.useState('inputProps');
  const activeItemId = store.useState('highlightedItemId');
  const handleKeyDown = useMenuFilterKeyDown(() => value() !== '');

  // A stable view that omits the list's key handler. Keys are read when the input renders them.
  const navigationProps = new Proxy({} as HTMLProps, {
    get(_target, key) {
      if (key === 'onKeyDown') {
        return undefined;
      }
      return storeInputProps()[key as keyof HTMLProps];
    },
    has(_target, key) {
      return key !== 'onKeyDown' && key in storeInputProps();
    },
    ownKeys() {
      return Reflect.ownKeys(storeInputProps()).filter((key) => key !== 'onKeyDown');
    },
    getOwnPropertyDescriptor(_target, key) {
      if (key === 'onKeyDown' || typeof key !== 'string') {
        return undefined;
      }
      return {
        configurable: true,
        enumerable: true,
        get: () => storeInputProps()[key as keyof HTMLProps],
      };
    },
  });

  // Solid: refs are not called with `null` on unmount, so removal without blur is cleared here.
  void onCleanup(() => {
    store.set('inputFocused', false);
  });

  const inputProps = mergeProps<typeof FilterDropdownInput>(
    {
      onKeyDown: handleKeyDown,
      onFocus() {
        store.set('inputFocused', true);
      },
      onBlur() {
        store.set('inputFocused', false);
      },
      // Ref changes cover input removal without blur.
      ref(input: HTMLInputElement | null) {
        store.set('inputFocused', input != null && activeElement(ownerDocument(input)) === input);
      },
    },
    props,
  );

  return (
    <FilterDropdownInput
      {...inputProps}
      activeItemId={activeItemId()}
      navigationProps={navigationProps}
    />
  );
}

export namespace MenuInput {
  export type State = FilterDropdownInput.State;
  export type Props = FilterDropdownInput.Props;
}
