import { getObserver, untrack } from 'solid-js';

/**
 * Counts how often each part's `useRenderElement` builds its props list, keyed by the part's
 * `data-testid`: a `partSources` memo (re-)reading the `props` parameter, or the one untracked
 * build at setup for a part whose props list cannot change (no memo). A part whose props are
 * stable getter objects builds the list once at mount; a part whose `get props()` reads state
 * eagerly rebuilds its whole props chain on every change of that state. Reads by other
 * computations (the ref sync collecting refs) are not counted. Uses the dev runtime's
 * computation names.
 *
 * @example
 * vi.mock('../../utils/useRenderElement', async (importOriginal) =>
 *   (await import('../../../test/propsReads')).countPropsReads(await importOriginal()),
 * );
 */
export const propsReads = new Map<string, number>();

export function countPropsReads<Module extends { useRenderElement: (...args: any[]) => unknown }>(
  module: Module,
): Module {
  return {
    ...module,
    useRenderElement: (
      element: unknown,
      componentProps: Record<string, unknown>,
      params: object,
    ) => {
      const testId = untrack(() => componentProps['data-testid']);
      const counted =
        typeof testId === 'string'
          ? new Proxy(params, {
              get(target, key, receiver) {
                const observer = getObserver() as { _name?: string } | null;
                if (key === 'props' && (observer === null || observer._name === 'partSources')) {
                  propsReads.set(testId, (propsReads.get(testId) ?? 0) + 1);
                }
                return Reflect.get(target, key, receiver);
              },
            })
          : params;
      return module.useRenderElement(element, componentProps, counted);
    },
  };
}

/** Calls of the public `mergeProps` (a part rebuilding a merged props object). */
export const mergePropsCalls = { count: 0 };

export function countMergeProps<Module extends { mergeProps: (...args: any[]) => unknown }>(
  module: Module,
): Module {
  return {
    ...module,
    mergeProps: ((...args: unknown[]) => {
      mergePropsCalls.count += 1;
      return module.mergeProps(...args);
    }) as Module['mergeProps'],
  };
}
