import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { screen, waitFor } from '@solidjs/testing-library';

function mockViewportMetrics(viewport: HTMLDivElement | null | undefined) {
  if (!viewport) {
    return;
  }

  const metrics = {
    clientHeight: 100,
    clientWidth: 100,
    scrollHeight: 1000,
    scrollWidth: 1000,
  };

  for (const [key, value] of Object.entries(metrics)) {
    const descriptor = Object.getOwnPropertyDescriptor(viewport, key);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(viewport, key, { configurable: true, value });
    }
  }
}

describe('<ScrollArea.Corner />', () => {
  const { render } = createRenderer();

  describeConformance(ScrollArea.Corner, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport ref={mockViewportMetrics} style={{ height: '100px', width: '100px' }}>
            <div style={{ height: '1000px', width: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted style={{ width: '10px' }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted style={{ height: '10px' }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          {node(props!)}
        </ScrollArea.Root>
      ));
    },
  }));

  describe.skipIf(isJSDOM)('interactions', () => {
    it('should apply correct corner size when both scrollbars are present', async () => {
      render(() => (
        <ScrollArea.Root style={{ height: '200px', width: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ height: '100%', width: '100%' }}>
            <div style={{ height: '1000px', width: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: '10px' }} />
          <ScrollArea.Scrollbar orientation="horizontal" style={{ height: '10px' }} />
          <ScrollArea.Corner data-testid="corner" />
        </ScrollArea.Root>
      ));

      await waitFor(() => {
        const corner = screen.getByTestId('corner');
        const style = getComputedStyle(corner);
        expect(style.getPropertyValue('--scroll-area-corner-width')).to.equal('10px');
        expect(style.getPropertyValue('--scroll-area-corner-height')).to.equal('10px');
      });
    });
  });
});
