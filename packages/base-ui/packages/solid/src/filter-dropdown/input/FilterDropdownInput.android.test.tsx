import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from '#test-utils';
import { FilterDropdownRoot } from '../root/FilterDropdownRoot';
import { FilterDropdownInput } from './FilterDropdownInput';

vi.mock('../../utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../utils/platform')>('../../utils/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

describe('FilterDropdownInput on Android', () => {
  const { render } = createRenderer();

  it('treats composition as ordinary typing', () => {
    const changes: string[] = [];

    render(() => (
      <FilterDropdownRoot
        open
        value=""
        listRef={{ current: [] }}
        getActiveIndex={() => null}
        setActiveIndex={() => {}}
        onValueChange={(next) => changes.push(next)}
      >
        <FilterDropdownInput aria-label="Filter" />
      </FilterDropdownRoot>
    ));

    const input = document.querySelector('[role="searchbox"]') as HTMLInputElement;
    fireEvent.compositionStart(input, { target: { value: 'ca' } });
    fireEvent.input(input, { target: { value: 'ca' } });
    expect(changes).toEqual(['ca']);
  });
});
