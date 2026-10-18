import { expect, vi, describe, beforeEach, afterEach, it } from 'vitest';
import { AnimationFrame, queueAfterFrame, resetAnimationFrameScheduler } from './useAnimationFrame';

describe('AnimationFrame', () => {
  beforeEach(() => {
    resetAnimationFrameScheduler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAnimationFrameScheduler();
  });

  it('keeps callback accounting correct when a frame is canceled more than once', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });

    const firstId = AnimationFrame.request(() => {});
    AnimationFrame.cancel(firstId);
    AnimationFrame.cancel(firstId);

    const secondCallback = vi.fn();
    AnimationFrame.request(secondCallback);

    callbacks[0]?.(0);

    expect(secondCallback).toHaveBeenCalledTimes(1);
  });

  // A frame's after-paint task can be lost (here, a fake clock discarded before it runs, as a test
  // that leaves fake timers on does): only that frame's callbacks go with it, not every later one.
  it('runs a later frame after-frame callbacks when an earlier frame task was lost', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const runFrame = () => frames.splice(0).forEach((callback) => callback(0));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    AnimationFrame.request(() => queueAfterFrame(() => {}));
    runFrame();
    vi.useRealTimers();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const later = vi.fn();
    AnimationFrame.request(() => queueAfterFrame(later));
    runFrame();
    vi.runAllTimers();
    vi.useRealTimers();

    expect(later).toHaveBeenCalledTimes(1);
  });
});
