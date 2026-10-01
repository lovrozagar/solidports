import { createRenderer } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

interface User {
  id: number;
  name: string;
}

const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
];

const userItems = Combobox.createItems(users, {
  getValue: (user) => user.id,
  getLabel: (user) => user.name,
});

describe('Combobox.createItems', () => {
  const { render } = createRenderer();

  it('rejects an items object that is not a collection', () => {
    expect(() =>
      render(() => <Combobox.Root items={{ a: 'A' } as any} />),
    ).to.throw(/not a collection/);
  });

  it('renders labels from the collection', () => {
    render(() => (
      <Combobox.Root items={userItems} defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(user: User) => (
                  <Combobox.Item value={user.id}>
                    {user.name}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByRole('option', { name: 'Alice' })).to.exist;
    expect(screen.getByRole('option', { name: 'Bob' })).to.exist;
  });
});
