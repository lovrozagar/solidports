import { expect, test } from 'vitest';
import { createRenderEffect } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { flushMicrotasks } from '#test-utils';
import { useFloatingOriginal } from './useFloatingOriginal';

test('an update with an unchanged position writes nothing (readers do not re-run)', async () => {
  let middlewareReads = 0;
  let positionReads = 0;
  let update: () => void = () => {};

  function Test() {
    const floating = useFloatingOriginal({ open: true });
    update = floating.update;
    createRenderEffect(
      () => floating.middlewareData,
      () => {
        middlewareReads += 1;
      },
    );
    createRenderEffect(
      () => [floating.x, floating.y, floating.placement, floating.isPositioned] as const,
      () => {
        positionReads += 1;
      },
    );
    return (
      <>
        <button ref={floating.refs.setReference} />
        <div ref={floating.refs.setFloating} />
      </>
    );
  }

  render(() => <Test />);
  await flushMicrotasks();
  await flushMicrotasks();
  const middlewareAfterMount = middlewareReads;
  const positionAfterMount = positionReads;
  expect(middlewareAfterMount).toBeGreaterThan(0);

  // As an autoUpdate tick on scroll: the layout did not change.
  for (let i = 0; i < 5; i += 1) {
    update();
    // eslint-disable-next-line no-await-in-loop
    await flushMicrotasks();
  }

  expect(middlewareReads).toBe(middlewareAfterMount);
  expect(positionReads).toBe(positionAfterMount);
});
