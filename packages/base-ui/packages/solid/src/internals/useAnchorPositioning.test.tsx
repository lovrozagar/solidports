import { expect, vi, describe, beforeEach, it } from 'vitest';
import { createSignal } from 'solid-js';
import { createRenderer } from '#test-utils';
import { useAnchorPositioning, type UseAnchorPositioningParameters } from './useAnchorPositioning';

const shiftSpy = vi.hoisted(() => vi.fn());

vi.mock('../floating-ui-solid/index', async () => {
  const actual = await vi.importActual<typeof import('../floating-ui-solid/index')>(
    '../floating-ui-solid/index',
  );

  return {
    ...actual,
    shift: ((...args: Parameters<typeof actual.shift>) => {
      shiftSpy(...args);
      return actual.shift(...args);
    }) satisfies typeof actual.shift,
  };
});

// Solid: `useAnchorPositioning` works without a floating root context, so there is no
// `useAnchorPositioningWithHook` indirection.
function TestUseAnchorPositioning(props: { shift?: UseAnchorPositioningParameters['shift'] }) {
  const [anchor, setAnchor] = createSignal<HTMLDivElement | null>(null);

  const positioning = useAnchorPositioning({
    anchor,
    mounted: true,
    positionMethod: 'absolute',
    side: 'bottom',
    align: 'center',
    sideOffset: 0,
    alignOffset: 0,
    collisionBoundary: 'clipping-ancestors',
    collisionPadding: 5,
    sticky: false,
    arrowPadding: 5,
    disableAnchorTracking: false,
    keepMounted: false,
    collisionAvoidance: { fallbackAxisSide: 'none' },
    get shift() {
      return props.shift;
    },
  });

  return (
    <>
      <div ref={setAnchor}>anchor</div>
      <div ref={positioning.context.refs.setFloating}>floating</div>
    </>
  );
}

describe('useAnchorPositioning', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    shiftSpy.mockClear();
  });

  it('uses the visual viewport for shift by default', async () => {
    await render(() => <TestUseAnchorPositioning />);

    expect(shiftSpy).toHaveBeenCalled();
    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe(undefined);
  });

  it.each([
    { shift: { rootBoundary: 'layoutViewport' } as const, crossAxis: false },
    { shift: { crossAxis: true, rootBoundary: 'layoutViewport' } as const, crossAxis: true },
  ])('uses the configured shift options', async ({ shift, crossAxis }) => {
    await render(() => <TestUseAnchorPositioning shift={shift} />);

    expect(shiftSpy.mock.calls[0]?.[0].rootBoundary).toBe('layoutViewport');
    expect(shiftSpy.mock.calls[0]?.[0].crossAxis).toBe(crossAxis);
  });
});
