import { createRenderer, describeConformance } from '#test-utils';
import { Toast } from '@solidports/base-ui/toast';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { Button, List } from '../utils/test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Description />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: any) => (
      <Toast.Description {...props} ref={props.ref}>
        description
      </Toast.Description>
    ),
    () => ({
      refInstanceof: window.HTMLParagraphElement,
      render(node, props) {
        return render(() => (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={toast}>{node(props!)}</Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>
        ));
      },
    }),
  );

  it('adds aria-describedby to the root element', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const descriptionElement = screen.getByTestId('description');
    const descriptionId = descriptionElement.id;

    const rootElement = screen.getByTestId('root');
    expect(rootElement).not.to.equal(null);
    expect(rootElement.getAttribute('aria-describedby')).to.equal(descriptionId);
  });

  it('does not render if it has no children', async () => {
    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button type="button" onClick={() => add({ description: undefined })}>
          add
        </button>
      );
    }

    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>
    ));

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const descriptionElement = screen.queryByTestId('description');
    expect(descriptionElement).to.equal(null);
  });

  it('renders the description by default', async () => {
    const { user } = render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const titleElement = screen.getByTestId('description');
    expect(titleElement).not.to.equal(null);
    expect(titleElement.textContent).to.equal('description');
  });

  // Solid: React's `render={<div>…</div>}` element maps to a `{ component, children }` render
  // config, whose own children replace the part's content as the element's do.
  it('renders content passed through the render prop', async () => {
    await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Description render={{ component: 'div', children: 'render prop description' }} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));

    expect(screen.getByText('render prop description')).not.toBe(null);
  });

  it('wires aria-describedby to a description rendered through the render prop', async () => {
    await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }} data-testid="root">
            <Toast.Description render={{ component: 'div', children: 'render prop description' }} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));

    const descriptionElement = screen.getByText('render prop description');
    const rootElement = screen.getByTestId('root');
    expect(rootElement.getAttribute('aria-describedby')).toBe(descriptionElement.id);
  });

  it('renders the toast description through a childless render prop', async () => {
    await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', description: 'Toast description' }}>
            <Toast.Description render={{ component: 'div' }} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));

    expect(screen.getByText('Toast description')).not.toBe(null);
  });
});
