import type { JSX } from '@solidjs/web';
import { ComponentWithPayload } from '../../solid-helpers';
import { MenuRootInternal } from '../root/MenuRoot';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { MenuFilterDropdown } from './MenuFilterDropdown';
import { useMenuFilterRoot } from './useMenuFilterRoot';

/**
 * The filterable implementation of `Menu.Root`, rendered in its place when the root sits inside
 * `Menu.FilterProvider`.
 */
export function MenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>): JSX.Element {
  const filter = useMenuFilterRoot(props);

  return (
    <MenuRootInternal
      {...props}
      virtualFocus
      virtualFocusRef={filter.virtualFocusRef}
      allowEscape={filter.allowEscape}
      resetOnPointerLeave={filter.resetOnPointerLeave}
    >
      {(payload) => (
        <MenuFilterDropdown
          value={filter.value}
          defaultValue={filter.defaultValue}
          onValueChange={filter.onValueChange}
          filter={filter.filter}
          autoHighlight={filter.autoHighlight}
          locale={filter.locale}
        >
          {/* Solid: a component's output can be an accessor, so a payload render function is
              told apart by resolving the children once, as the root does. */}
          <ComponentWithPayload payload={() => payload.payload} children={props.children} />
        </MenuFilterDropdown>
      )}
    </MenuRootInternal>
  );
}

export type MenuFilterRootProps<Payload = unknown> = MenuRoot.Props<Payload> &
  MenuFilterProviderOptions;
