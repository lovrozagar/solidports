import type { JSX } from "solid-js";
import { createMemo, createSignal, createUniqueId, useTransition } from "solid-js";
import { Combobox } from "@solidports/base-ui/combobox";

export default function ExampleAsyncSingleCombobox() {
  const id = createUniqueId();

  const [searchResults, setSearchResults] = createSignal<DirectoryUser[]>([]);
  const [selectedValue, setSelectedValue] = createSignal<DirectoryUser | null>(null);
  const [searchValue, setSearchValue] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { contains } = Combobox.useFilter();

  let abortControllerRef: AbortController | null = null;

  const trimmedSearchValue = createMemo(() => searchValue().trim());

  const items = createMemo(() => {
    const sel = selectedValue();
    const results = searchResults();
    if (!sel || results.some((user) => user.id === sel.id)) {
      return results;
    }

    return [...results, sel];
  });

  function getStatus() {
    if (isPending()) {
      return (
        <>
          <span
            aria-hidden
            class="inline-block size-3 animate-spin rounded-full border border-current border-r-transparent rtl:border-r-current rtl:border-l-transparent"
          />
          Searching…
        </>
      );
    }

    if (error()) {
      return error();
    }

    if (trimmedSearchValue() === '') {
      return selectedValue() ? null : 'Start typing to search people…';
    }

    if (searchResults().length === 0) {
      return `No matches for "${trimmedSearchValue()}".`;
    }

    return null;
  }

  function getEmptyMessage() {
    if (trimmedSearchValue() === '' || isPending() || searchResults().length > 0 || error()) {
      return null;
    }
    return 'Try a different search term.';
  }

  return (
    <Combobox.Root
      items={items()}
      itemToStringLabel={(user: DirectoryUser) => user.name}
      filter={null}
      onOpenChangeComplete={(open) => {
        const sel = selectedValue();
        if (!open && sel) {
          setSearchResults([sel]);
        }
      }}
      onValueChange={(nextSelectedValue) => {
        setSelectedValue(nextSelectedValue);
        setSearchValue('');
        setError(null);
      }}
      onInputValueChange={(nextSearchValue, { reason }) => {
        setSearchValue(nextSearchValue);

        if (nextSearchValue === '') {
          setSearchResults([]);
          setError(null);
          return;
        }

        if (reason === 'item-press') {
          return;
        }

        const controller = new AbortController();
        abortControllerRef?.abort();
        abortControllerRef = controller;

        startTransition(async () => {
          setError(null);

          const result = await searchUsers(nextSearchValue, contains);

          if (controller.signal.aborted) {
            return;
          }

          startTransition(() => {
            setSearchResults(result.users);
            setError(result.error);
          });
        });
      }}
    >
      <div class="relative flex flex-col gap-1 text-sm font-medium leading-5 text-gray-900">
        <label for={id}>Assign reviewer</label>
        <div class="relative w-[16rem] md:w-[20rem] [&>input]:pr-[calc(0.5rem+1.5rem)] has-[.combobox-clear]:[&>input]:pr-[calc(0.5rem+1.5rem*2)]">
          <Combobox.Input
            id={id}
            placeholder="e.g. Michael"
            class="box-border h-10 w-full rounded-md border border-gray-200 bg-[canvas] pl-3.5 text-base font-normal text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
          />
          <div class="absolute bottom-0 right-2 flex h-10 items-center justify-center text-gray-600">
            <Combobox.Clear
              class="combobox-clear flex h-10 w-6 items-center justify-center rounded border-0 bg-transparent p-0"
              aria-label="Clear selection"
            >
              <ClearIcon class="size-4" />
            </Combobox.Clear>
            <Combobox.Trigger
              class="flex h-10 w-6 items-center justify-center rounded border-0 bg-transparent p-0"
              aria-label="Open popup"
            >
              <ChevronDownIcon class="size-4" />
            </Combobox.Trigger>
          </div>
        </div>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner class="outline-none" sideOffset={4}>
          <Combobox.Popup
            class="box-border w-[var(--anchor-width)] max-h-[min(var(--available-height),23rem)] max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-y-auto scroll-pb-2 scroll-pt-2 overscroll-contain rounded-md bg-[canvas] py-2 text-gray-900 shadow-[0_10px_15px_-3px_var(--color-gray-200),0_4px_6px_-4px_var(--color-gray-200)] outline outline-1 outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:transition-none data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:-outline-offset-1 dark:shadow-none dark:outline-gray-300"
            aria-busy={isPending() || undefined}
          >
            <Combobox.Status class="flex items-center gap-2 py-1 pl-4 pr-5 text-sm text-gray-600 empty:hidden">
              {getStatus()}
            </Combobox.Status>
            <Combobox.Empty class="px-4 py-2 text-[0.875rem] leading-4 text-gray-600 empty:hidden">
              {getEmptyMessage()}
            </Combobox.Empty>
            <Combobox.List>
              {(user: DirectoryUser) => (
                <Combobox.Item
                  value={user}
                  class="grid cursor-default select-none grid-cols-[0.75rem_1fr] items-start gap-2 py-2 pl-4 pr-5 text-base leading-[1.2rem] outline-none [@media(hover:hover)]:[&[data-highlighted]]:relative [@media(hover:hover)]:[&[data-highlighted]]:z-0 [@media(hover:hover)]:[&[data-highlighted]]:text-gray-900 [@media(hover:hover)]:[&[data-highlighted]]:before:absolute [@media(hover:hover)]:[&[data-highlighted]]:before:inset-y-0 [@media(hover:hover)]:[&[data-highlighted]]:before:inset-x-2 [@media(hover:hover)]:[&[data-highlighted]]:before:z-[-1] [@media(hover:hover)]:[&[data-highlighted]]:before:rounded [@media(hover:hover)]:[&[data-highlighted]]:before:bg-gray-100 [@media(hover:hover)]:[&[data-highlighted]]:before:content-['']"
                >
                  <Combobox.ItemIndicator class="col-start-1 mt-1">
                    <CheckIcon class="size-3" />
                  </Combobox.ItemIndicator>
                  <div class="col-start-2 flex flex-col gap-1">
                    <div class="text-[0.95rem] font-medium">{user.name}</div>
                    <div class="flex flex-wrap gap-3 text-[0.8125rem] text-gray-600">
                      <span class="opacity-80">@{user.username}</span>
                      <span>{user.title}</span>
                    </div>
                    <div class="text-xs opacity-80">{user.email}</div>
                  </div>
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
    <svg fill="currentcolor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function ClearIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

interface DirectoryUser {
  id: string;
  name: string;
  username: string;
  email: string;
  title: string;
}

async function searchUsers(
  query: string,
  filter: (item: string, query: string) => boolean,
): Promise<{ users: DirectoryUser[]; error: string | null }> {
  /* Simulate network delay */
  await new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 500 + 100);
  });

  /* Simulate occasional network errors (1% chance) */
  if (Math.random() < 0.01 || query === 'will_error') {
    return {
      error: 'Failed to fetch people. Please try again.',
      users: [],
    };
  }

  const users = allUsers.filter((user) => {
    return (
      filter(user.name, query) ||
      filter(user.username, query) ||
      filter(user.email, query) ||
      filter(user.title, query)
    );
  });

  return {
    error: null,
    users,
  };
}

const allUsers: DirectoryUser[] = [
  {
    email: 'leslie.alexander@example.com',
    id: 'leslie-alexander',
    name: 'Leslie Alexander',
    title: 'Product Manager',
    username: 'leslie',
  },
  {
    email: 'kathryn.murphy@example.com',
    id: 'kathryn-murphy',
    name: 'Kathryn Murphy',
    title: 'Marketing Lead',
    username: 'kathryn',
  },
  {
    email: 'courtney.henry@example.com',
    id: 'courtney-henry',
    name: 'Courtney Henry',
    title: 'Design Systems',
    username: 'courtney',
  },
  {
    email: 'michael.foster@example.com',
    id: 'michael-foster',
    name: 'Michael Foster',
    title: 'Engineering Manager',
    username: 'michael',
  },
  {
    email: 'lindsay.walton@example.com',
    id: 'lindsay-walton',
    name: 'Lindsay Walton',
    title: 'Product Designer',
    username: 'lindsay',
  },
  {
    email: 'tom.cook@example.com',
    id: 'tom-cook',
    name: 'Tom Cook',
    title: 'Frontend Engineer',
    username: 'tom',
  },
  {
    email: 'whitney.francis@example.com',
    id: 'whitney-francis',
    name: 'Whitney Francis',
    title: 'Customer Success',
    username: 'whitney',
  },
  {
    email: 'jacob.jones@example.com',
    id: 'jacob-jones',
    name: 'Jacob Jones',
    title: 'Security Engineer',
    username: 'jacob',
  },
  {
    email: 'arlene.mccoy@example.com',
    id: 'arlene-mccoy',
    name: 'Arlene McCoy',
    title: 'Data Analyst',
    username: 'arlene',
  },
  {
    email: 'marvin.mckinney@example.com',
    id: 'marvin-mckinney',
    name: 'Marvin McKinney',
    title: 'QA Specialist',
    username: 'marvin',
  },
  {
    email: 'eleanor.pena@example.com',
    id: 'eleanor-pena',
    name: 'Eleanor Pena',
    title: 'Operations',
    username: 'eleanor',
  },
  {
    email: 'jerome.bell@example.com',
    id: 'jerome-bell',
    name: 'Jerome Bell',
    title: 'DevOps Engineer',
    username: 'jerome',
  },
];
