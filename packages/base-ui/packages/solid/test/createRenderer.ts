import { createComponent, flush } from 'solid-js';
import { queries, render as testingLibraryRender } from '@solidjs/testing-library';
import { userEvent } from '@testing-library/user-event';
import type { Component } from 'solid-js';
import { dynamic } from '@solidjs/web';
import { createClock } from './createClock';
import type { Clock, ClockConfig } from './createClock';
import { customQueries } from './describeConformance';
import type { MuiRenderResult, RenderOptions } from './describeConformance';

/**
 * The render result. Awaiting it settles the render the way React's `await render()` does: the
 * harness renders in `act(async () => ...)`, so queued microtasks (an initial focus, for example)
 * and a macrotask turn have run before the test continues.
 */
export type BaseUIRenderResult = MuiRenderResult & PromiseLike<MuiRenderResult>;

interface DataAttributes {
  [key: `data-${string}`]: string | undefined;
}

export type BaseUITestRenderer = {
  clock: Clock;
  render: (
    element: Component,
    elementProps?: DataAttributes,
    options?: RenderOptions,
  ) => BaseUIRenderResult;
};

export interface CreateRendererOptions {
  /**
   * @default 'real'
   */
  clock?: 'fake' | 'real';
  clockConfig?: ClockConfig;
  clockOptions?: Parameters<typeof createClock>[2];
  /**
   * Vitest needs to be injected because this file is transpiled to commonjs and vitest is an esm module.
   * @default {}
   */
  vi?: any;
}

export function createRenderer(globalOptions: CreateRendererOptions = {}): BaseUITestRenderer {
  const {
    clock = 'real',
    clockConfig,
    clockOptions,
    vi = (globalThis as any).vi || {},
  } = globalOptions;

  return {
    clock: createClock(clock, clockConfig, clockOptions, vi),
    render(element, elementProps = {}, options = {}) {
      let result: any;
      const bodyChildren =
        typeof document !== 'undefined' ? new Set(document.body.children) : undefined;
      try {
        result = testingLibraryRender(
          () =>
            createComponent(
              dynamic(() => element),
              elementProps,
            ),
          {
            ...options,
            queries: { ...queries, ...customQueries },
          },
        );
      } catch (error) {
        // The test receives this error from `render`; the browser's duplicate report is expected.
        markSurfacedRenderError(error);
        // React unmounts a root whose render throws without an error boundary. Solid leaves the
        // partial tree, portals included, in the document; remove what this render added.
        if (bodyChildren) {
          for (const child of Array.from(document.body.children)) {
            if (!bodyChildren.has(child)) {
              child.remove();
            }
          }
        }
        throw error;
      }
      const renderResult: MuiRenderResult = { ...result, user: userEvent.setup() };
      // Non-enumerable, so a test spreading the result into its own object doesn't copy it and
      // make that object awaitable too.
      return Object.defineProperty({ ...renderResult }, 'then', {
        enumerable: false,
        value<TResult1 = MuiRenderResult, TResult2 = never>(
          onFulfilled?: ((value: MuiRenderResult) => TResult1 | PromiseLike<TResult1>) | null,
          onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          // Resolves with the plain result: a thenable value would be awaited again.
          return settleRender()
            .then(() => renderResult)
            .then(onFulfilled, onRejected);
        },
      }) as BaseUIRenderResult;
    },
  };
}

/**
 * React's `act(async () => ...)`: apply queued writes, then yield microtasks and one macrotask.
 * Fake timers are not advanced, as React's `act` yields a real task without moving fake time.
 */
async function settleRender() {
  flush();
  const vi = (globalThis as any).vi;
  await new Promise<void>((resolve) => {
    if (vi?.isFakeTimers?.()) {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    } else {
      setTimeout(resolve, 0);
    }
  });
  flush();
}

/*
 * Errors a test already received as a `render` exception. A browser also reports an uncaught
 * render error to `window` (Solid rethrows it from the flush), which vitest would count as an
 * unhandled error; `setupSolid` suppresses exactly these reports.
 */
const surfacedRenderErrors = new WeakSet<object>();

function markSurfacedRenderError(error: unknown) {
  if (error !== null && typeof error === 'object') {
    surfacedRenderErrors.add(error);
  }
}

export function isSurfacedRenderError(error: unknown) {
  return error !== null && typeof error === 'object' && surfacedRenderErrors.has(error);
}

export function randomStringValue() {
  return Math.random().toString(36).substring(2, 15);
}
