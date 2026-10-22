import { screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer, isJSDOM, wait } from '#test-utils';

// The browser setup parks the real pointer after a test that drove it and releases a pointer lock
// a test left, so one test's real input never reaches the next. The tests run in order.
describe.skipIf(isJSDOM)('browser pointer isolation', () => {
  const { render } = createRenderer();
  // Top-left, where most tests render their first trigger.
  const AREA = { position: 'fixed', top: '0', left: '0', width: '100px', height: '100px' } as const;

  it('drives the real pointer over the page', async () => {
    const onPointerEnter = vi.fn();
    await render(() => <div data-testid="area" style={AREA} onPointerEnter={onPointerEnter} />);
    const { userEvent } = await import('vitest/browser');
    await userEvent.hover(screen.getByTestId('area'));
    expect(onPointerEnter).toHaveBeenCalled();
  });

  it('starts the next test with the pointer off its content', async () => {
    const onPointerEnter = vi.fn();
    await render(() => <div style={AREA} onPointerEnter={onPointerEnter} />);
    // Chromium dispatches a pointer move to content that appears under a still cursor.
    await wait(200);
    expect(onPointerEnter).not.toHaveBeenCalled();
  });
});
