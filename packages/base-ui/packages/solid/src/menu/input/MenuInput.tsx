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
  const inputProps = store.useState('inputProps');
  const activeItemId = store.useState('highlightedItemId');
  const handleKeyDown = useMenuFilterKeyDown(() => value() !== '');

  // A stable view that omits the list's key handler. Keys are read when the input renders them.
  const navigationProps = new Proxy({} as HTMLProps, {
    get(_target, key) {
      if (key === 'onKeyDown') {
        return undefined;
      }
      return inputProps()[key as keyof HTMLProps];
    },
    has(_target, key) {
      return key !== 'onKeyDown' && key in inputProps();
    },
    ownKeys() {
      return Reflect.ownKeys(inputProps()).filter((key) => key !== 'onKeyDown');
    },
    getOwnPropertyDescriptor(_target, key) {
      if (key === 'onKeyDown' || typeof key !== 'string') {
        return undefined;
      }
      return {
        configurable: true,
        enumerable: true,
        get: () => inputProps()[key as keyof HTMLProps],
      };
    },
  });

  return (
    <FilterDropdownInput
      {...props}
      activeItemId={activeItemId()}
      navigationProps={navigationProps}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        store.set('inputFocused', true);
      }}
      onBlur={() => {
        store.set('inputFocused', false);
      }}
      ref={(input) => {
        store.set('inputFocused', input != null && activeElement(ownerDocument(input)) === input);
      }}
    />
  );
}

export namespace MenuInput {
  export type State = FilterDropdownInput.State;
  export type Props = FilterDropdownInput.Props;
}
