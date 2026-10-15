import { element, place } from 'docs/src/adapters/react';
import { createMemo, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import Link from 'docs/src/adapters/next/link';
import clsx from 'clsx';
import type { SearchResult, SearchResults } from '@mui/internal-docs-infra/useSearch/types';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { getDisplayTitle } from '../../utils/getDisplayTitle';
import { normalizeSearchGroup } from './searchUtils';

interface SearchResultsListClasses {
  group: string;
  groupLabel: string;
  item: string;
  breadcrumbText?: string;
  breadcrumbPart: string;
  breadcrumbPartLast?: string;
  separator: string;
  score: string;
}
interface SearchResultsListProps {
  buildResultUrl: (result: SearchResult) => string;
  class: string;
  classes: SearchResultsListClasses;
  onResultNavigate: (result: SearchResult) => void;
  separatorVariant: 'filled' | 'stroked';
}
export function SearchResultsList(props: SearchResultsListProps) {
  const renderGroup = (group: SearchResults[number]) => (
    <For each={[group.group]}>
      {() => (
        <Autocomplete.Group items={group.items} class={props.classes.group}>
          {group.group !== 'Default' && (
            <Autocomplete.GroupLabel class={props.classes.groupLabel}>
              {normalizeSearchGroup(group.group)}
            </Autocomplete.GroupLabel>
          )}
          <Autocomplete.Collection>
            {(result: SearchResult) => {
              const href = props.buildResultUrl(result);
              const isStaticFile = href.endsWith('.md') || href.endsWith('.txt');
              return (
                <Autocomplete.Item
                  value={result}
                  render={
                    isStaticFile
                      ? ({
                          component: 'a',
                          href,
                          onClick: (event) => {
                            if (isUnmodifiedLeftClick(event)) {
                              props.onResultNavigate(result);
                            }
                          },
                          get tabindex() {
                            return -1;
                          },
                        } satisfies {
                          component: 'a';
                        } & JSX.IntrinsicElements['a'])
                      : {
                          component: Link,
                          href,
                          onNavigate: () => props.onResultNavigate(result),
                          get tabindex() {
                            return -1;
                          },
                        }
                  }
                  class={props.classes.item}
                >
                  <SearchResultItem
                    result={result}
                    classes={props.classes}
                    separatorVariant={props.separatorVariant}
                  />
                </Autocomplete.Item>
              );
            }}
          </Autocomplete.Collection>
        </Autocomplete.Group>
      )}
    </For>
  );
  return <Autocomplete.List class={props.class}>{renderGroup}</Autocomplete.List>;
}
function isUnmodifiedLeftClick(
  event: MouseEvent & {
    currentTarget: HTMLAnchorElement;
    target: Element;
  },
) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}
function SearchResultItem(props: {
  classes: SearchResultsListClasses;
  result: SearchResult;
  separatorVariant: 'filled' | 'stroked';
}) {
  const breadcrumb = element(() => (
    <>
      <For each={props.result.title?.split(' ‣ ')}>
        {(part, i) => (
          <>
            <span
              class={clsx(
                props.classes.breadcrumbPart,
                i() === (props.result.title?.split(' ‣ ') ?? []).length - 1 &&
                  props.classes.breadcrumbPartLast,
              )}
            >
              {getDisplayTitle(part)}
            </span>
            {i() !== (props.result.title?.split(' ‣ ') ?? []).length - 1 && (
              <SearchBreadcrumbSeparator
                class={props.classes.separator}
                variant={props.separatorVariant}
              />
            )}
          </>
        )}
      </For>
    </>
  ));
  return (
    <>
      {props.classes.breadcrumbText ? (
        <span class={props.classes.breadcrumbText}>{place(breadcrumb)}</span>
      ) : (
        breadcrumb
      )}
      {process.env.NODE_ENV !== 'production' && props.result.score && (
        <span class={props.classes.score}>{props.result.score.toFixed(2)}</span>
      )}
    </>
  );
}
function SearchBreadcrumbSeparator(props: { class: string; variant: 'filled' | 'stroked' }) {
  const _render = createMemo(() => {
    if (props.variant === 'stroked') {
      return (
        <svg
          class={props.class}
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 16 16"
        >
          <path
            d="M6.5 3.5 11 8l-4.5 4.5"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      );
    }
    return (
      <svg class={props.class} width="16" height="16" fill="none" viewBox="0 0 16 16">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M5.47 13.03a.75.75 0 0 1 0-1.06L9.44 8 5.47 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0"
          clip-rule="evenodd"
        />
      </svg>
    );
  });
  return <>{_render()}</>;
}
