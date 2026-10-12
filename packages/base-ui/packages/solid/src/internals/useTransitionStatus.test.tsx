import { expect, describe, it, vi, afterEach } from 'vitest';
import { createSignal } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { AnimationFrame } from '../utils/useAnimationFrame';
import { act, createRenderer } from '#test-utils';
import { useTransitionStatus } from './useTransitionStatus';

describe('useTransitionStatus', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function Test(props: { open: boolean }) {
    const { transitionStatus } = useTransitionStatus(() => props.open);
    return <div data-testid="status" data-status={transitionStatus() ?? 'none'} />;
  }

  // Solid: the status is cleared in a task queued from the frame, after that frame paints (see
  // `requestAfterPaint`), so running a frame also waits for that task.
  async function runFrame(frame: FrameRequestCallback) {
    await act(async () => {
      frame(0);
      await new Promise((resolve) => {
        setTimeout(resolve);
      });
    });
  }

  it('does not request a frame for an element that mounts already open', async () => {
    const requestSpy = vi.spyOn(AnimationFrame, 'request');

    await render(() => <Test open />);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('clears the starting status on the next frame after opening', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const [open, setOpen] = createSignal(false);
    await render(() => <Test open={open()} />);
    await act(async () => {
      setOpen(true);
    });

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'starting');
    expect(frames).toHaveLength(1);

    await runFrame(frames[0]);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });

  it('clears a stale ending status when reopened before the exit settles', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(AnimationFrame, 'request').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    const [open, setOpen] = createSignal(true);
    await render(() => <Test open={open()} />);
    await act(async () => {
      setOpen(false);
    });
    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'ending');

    await act(async () => {
      setOpen(true);
    });
    expect(frames).toHaveLength(1);

    await runFrame(frames[0]);

    expect(screen.getByTestId('status')).toHaveAttribute('data-status', 'none');
  });
});
