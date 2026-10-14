import { buildQueries } from '@solidjs/testing-library';
import type { BoundFunction, queries, Queries, render } from '@solidjs/testing-library';
import type { userEvent } from '@testing-library/user-event';
import type { Component, Ref } from 'solid-js';
import type { JSX, DynamicProps } from '@solidjs/web';
import type { ComponentRenderFn } from '../src/utils/types';
import { testClassName } from './conformanceTests/className';
import { testPropForwarding } from './conformanceTests/propForwarding';
import { testRefForwarding } from './conformanceTests/refForwarding';
import { testRenderProp } from './conformanceTests/renderProp';
import createDescribe from './createDescribe';

type RenderResult<Q extends Queries = typeof queries> = ReturnType<typeof render> & {
  [P in keyof Q]: BoundFunction<Q[P]>;
};

function queryAllDescriptionsOf(baseElement: HTMLElement, element: Element): HTMLElement[] {
  const ariaDescribedBy = element.getAttribute('aria-describedby');
  if (ariaDescribedBy === null) {
    return [];
  }
  return ariaDescribedBy
    .split(' ')
    .map((id) => {
      return document.getElementById(id);
    })
    .filter((maybeElement): maybeElement is HTMLElement => {
      return maybeElement !== null && baseElement.contains(maybeElement);
    });
}

const [
  queryDescriptionOf,
  getAllDescriptionsOf,
  getDescriptionOf,
  findAllDescriptionsOf,
  findDescriptionOf,
] = buildQueries<[Element]>(
  queryAllDescriptionsOf,
  function getMultipleError() {
    return `Found multiple descriptions.`;
  },
  function getMissingError() {
    return `Found no describing element.`;
  },
);

export const customQueries = {
  queryDescriptionOf,
  queryAllDescriptionsOf,
  getDescriptionOf,
  getAllDescriptionsOf,
  findDescriptionOf,
  findAllDescriptionsOf,
};

export interface MuiRenderResult extends RenderResult<typeof queries & typeof customQueries> {
  user: ReturnType<typeof userEvent.setup>;
}

export type ConformantComponentProps = {
  render?:
    | keyof JSX.IntrinsicElements
    | DynamicProps<any>
    | ComponentRenderFn<Record<string, unknown>, any>
    | null;
  ref?: Ref<any>;
  'data-testid'?: string;
  class?: string | ((state: unknown) => string);
  style?: JSX.CSSProperties;
  nativeButton?: boolean;
};

export type RenderOptions = Parameters<typeof render>[1];

/**
 * Options read by the Base UI conformance suites.
 * Declared explicitly (rather than derived from MUI's `ConformanceOptions`) so options that no
 * suite reads fail typechecking instead of silently doing nothing.
 */
export interface BaseUiConformanceTestsOptions<
  Props extends Record<string, any> = ConformantComponentProps,
> {
  render: (
    element: (props: Props) => JSX.Element,
    elementProps?: Props,
    options?: RenderOptions | undefined,
  ) => MuiRenderResult;
  /**
   * The constructor the forwarded ref is expected to be an instance of.
   */
  refInstanceof: abstract new (...args: any[]) => unknown;
  /**
   * The element the render-prop and prop-forwarding tests render in place of the default one.
   * Rendering a `button` also sets `nativeButton` on components that accept it, and for those
   * components the tests run again with a `div` and `nativeButton={false}`.
   * @default 'div'
   */
  testRenderPropWith?: keyof JSX.IntrinsicElements;
  /**
   * Whether the component accepts the `nativeButton` prop.
   */
  button?: boolean;
  /**
   * Whether the component is allowed to be wrapped by an extra element for testing.
   * @default true
   */
  wrappingAllowed?: boolean;
}

function describeConformanceFn(
  minimalElement: Component<any>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const getRenderOptions = (): BaseUiConformanceTestsOptions => ({
    ...getOptions(),
    render: (props, ...args) => getOptions().render(props ?? {}, ...args),
  });

  testPropForwarding(minimalElement, getRenderOptions);
  testRefForwarding(minimalElement, getRenderOptions);
  testRenderProp(minimalElement, getRenderOptions);
  testClassName(minimalElement, getRenderOptions);

  const { button = false, testRenderPropWith } = getOptions();
  if (button && testRenderPropWith === 'button') {
    // Button parts also support rendering a non-button element with `nativeButton={false}`.
    describe('with a non-native button', () => {
      const getNonNativeOptions = (): BaseUiConformanceTestsOptions => ({
        ...getRenderOptions(),
        testRenderPropWith: 'div',
      });
      testPropForwarding(minimalElement, getNonNativeOptions);
      testRenderProp(minimalElement, getNonNativeOptions);
    });
  }
}

export const describeConformance = createDescribe('Base UI component API', describeConformanceFn);
