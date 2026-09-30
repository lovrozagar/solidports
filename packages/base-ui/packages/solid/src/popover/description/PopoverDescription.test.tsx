import { createRenderer, describeConformance } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';

describe('<Popover.Description />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Description, () => ({
    refInstanceof: window.HTMLParagraphElement,
    render: (node, props) =>
      render(() => (
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node(props!)}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )),
  }));

  it('describes the popup element with its id', async () => {
    render(() => (
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Description>Title</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    const id = document.querySelector('p')?.id;
    expect(screen.getByRole('dialog')).to.have.attribute('aria-describedby', id);
  });
});
