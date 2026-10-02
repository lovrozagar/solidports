import { createComponent } from 'solid-js';
import { queries, render as testingLibraryRender } from '@solidjs/testing-library';
import { userEvent } from '@testing-library/user-event';
import type { Component } from 'solid-js';
import { dynamic } from '@solidjs/web';
import { createClock, type Clock, type ClockConfig } from './createClock';
import { customQueries, type MuiRenderResult, type RenderOptions } from './describeConformance';

export type BaseUIRenderResult = MuiRenderResult;

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
        throw error;
      }
      return { ...result, user: userEvent.setup() };
    },
  };
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
