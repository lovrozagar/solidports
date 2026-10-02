import { expect, vi } from 'vitest';
import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen, waitFor } from '@solidjs/testing-library';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';

describe('<ScrollArea.Content />', () => {
  const { render } = createRenderer();

  describeConformance(ScrollArea.Content, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport>{node(props!)}</ScrollArea.Viewport>
        </ScrollArea.Root>
      )),
  }));

  it('throws a descriptive error when rendered outside <ScrollArea.Viewport>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <ScrollArea.Root>
            <ScrollArea.Content />
          </ScrollArea.Root>
        )),
      ).toThrow(
        'Base UI: ScrollAreaViewportContext missing. ScrollAreaViewport parts must be placed within <ScrollArea.Viewport>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it.skipIf(isJSDOM)('recomputes overflow when observed content resizes', async () => {
    const [contentHeight, setContentHeight] = createSignal(50);

    render(() => (
      <ScrollArea.Root data-testid="root" style={{ width: '100px', height: '100px' }}>
        <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
          <ScrollArea.Content data-testid="content" style={{ height: `${contentHeight()}px` }} />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));
    const root = screen.getByTestId('root');

    await waitFor(() => expect(root).not.toHaveAttribute('data-has-overflow-y'));

    act(() => setContentHeight(1000));

    await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));
  });

  it('supports a custom content renderer that does not forward its ref', async () => {
    function ContentWithoutRef(props: JSX.HTMLAttributes<HTMLDivElement>) {
      return <div {...omit(props, 'ref')} />;
    }

    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport>
          <ScrollArea.Content
            data-testid="content"
            render={(props) => <ContentWithoutRef {...props} />}
          />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    ));

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });
});
