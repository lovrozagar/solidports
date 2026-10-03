import { Menu } from '@solidports/base-ui/menu';

export default function MenuLinkItemNavigation() {
  return (
    <div class="p-4">
      <h1 data-testid="page-heading" class="mb-4 text-2xl font-bold">
        Menu with Link Items
      </h1>

      <Menu.Root>
        <Menu.Trigger
          data-testid="menu-trigger"
          class="rounded bg-gray-50 px-4 py-2 text-gray-900 hover:bg-gray-100"
        >
          Open Menu
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup class="w-48 rounded bg-[canvas] p-1 shadow-lg shadow-gray-200">
              <Menu.LinkItem
                data-testid="link-one"
                href="/e2e-fixtures/menu/PageOne"
                class="block rounded px-3 py-2 text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 data-[highlighted]:bg-gray-900 data-[highlighted]:text-gray-50"
              >
                Page one
              </Menu.LinkItem>

              <Menu.LinkItem
                data-testid="link-two"
                href="/e2e-fixtures/menu/PageTwo"
                class="block rounded px-3 py-2 text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 data-[highlighted]:bg-gray-900 data-[highlighted]:text-gray-50"
              >
                Page one
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
