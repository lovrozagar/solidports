import type { JSX } from "solid-js";
import { createMemo, createSignal, createUniqueId, For, useTransition } from "solid-js";
import { Combobox } from "@solidports/base-ui/combobox";
import styles from './index.module.css';

export default function ExampleAsyncMultipleCombobox() {
  const id = createUniqueId();

  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);

  const [searchResults, setSearchResults] = createSignal<DirectoryUser[]>([]);
  const [selectedValues, setSelectedValues] = createSignal<DirectoryUser[]>([]);
  const [searchValue, setSearchValue] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [blockStartStatus, setBlockStartStatus] = createSignal(false);

  const [isPending, startTransition] = useTransition();

  const { contains } = Combobox.useFilter();

  let abortControllerRef: AbortController | null = null;
  let selectedValuesRef: DirectoryUser[] = [];

  const trimmedSearchValue = createMemo(() => searchValue().trim());

  const items = createMemo(() => {
    const sel = selectedValues();
    const results = searchResults();
    if (sel.length === 0) {
      return results;
    }

    const merged = [...results];

    sel.forEach((user) => {
      if (!results.some((result) => result.id === user.id)) {
        merged.push(user);
      }
    });

    return merged;
  });

  function getStatus() {
    if (isPending()) {
      return (
        <>
          <span class={styles.Spinner} aria-hidden />
          Searching…
        </>
      );
    }

    if (error()) {
      return error();
    }

    if (trimmedSearchValue() === '' && !blockStartStatus()) {
      return selectedValues().length > 0 ? null : 'Start typing to search people…';
    }

    if (searchResults().length === 0 && !blockStartStatus()) {
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
      multiple
      filter={null}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setSearchResults(selectedValuesRef);
          setBlockStartStatus(false);
        }
      }}
      onValueChange={(nextSelectedValues) => {
        selectedValuesRef = nextSelectedValues;
        setSelectedValues(nextSelectedValues);
        setSearchValue('');
        setError(null);

        if (nextSelectedValues.length === 0) {
          setSearchResults([]);
          setBlockStartStatus(false);
        } else {
          setBlockStartStatus(true);
        }
      }}
      onInputValueChange={(nextSearchValue, { reason }) => {
        setSearchValue(nextSearchValue);

        const controller = new AbortController();
        abortControllerRef?.abort();
        abortControllerRef = controller;

        if (nextSearchValue === '') {
          setSearchResults(selectedValuesRef);
          setError(null);
          setBlockStartStatus(false);
          return;
        }

        if (reason === 'item-press') {
          return;
        }

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
      <div class={styles.Container}>
        <label class={styles.Label} for={id}>
          Assign reviewers
        </label>
        <Combobox.Chips class={styles.Chips} ref={setContainerRef}>
          <Combobox.Value>
            {(value) => (
              <>
                <For each={value() as DirectoryUser[]}>
                  {(user) => (
                    <Combobox.Chip class={styles.Chip} aria-label={user.name}>
                      {user.name}
                      <Combobox.ChipRemove class={styles.ChipRemove} aria-label="Remove">
                        <XIcon />
                      </Combobox.ChipRemove>
                    </Combobox.Chip>
                  )}
                </For>
                <Combobox.Input
                  id={id}
                  placeholder={(value() as DirectoryUser[]).length > 0 ? '' : 'e.g. Michael'}
                  class={styles.Input}
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner class={styles.Positioner} anchor={containerRef()} sideOffset={4}>
          <Combobox.Popup class={styles.Popup} aria-busy={isPending() || undefined}>
            <Combobox.Status class={styles.Status}>{getStatus()}</Combobox.Status>
            <Combobox.Empty class={styles.Empty}>{getEmptyMessage()}</Combobox.Empty>
            <Combobox.List>
              {(user: DirectoryUser) => (
                <Combobox.Item class={styles.Item} value={user}>
                  <Combobox.ItemIndicator class={styles.ItemIndicator}>
                    <CheckIcon class={styles.ItemIndicatorIcon} />
                  </Combobox.ItemIndicator>
                  <div class={styles.ItemText}>
                    <div class={styles.ItemTitle}>{user.name}</div>
                    <div class={styles.ItemSubtitle}>
                      <span class={styles.ItemUsername}>@{user.username}</span>
                      <span>{user.title}</span>
                    </div>
                    <div class={styles.ItemEmail}>{user.email}</div>
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

function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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
