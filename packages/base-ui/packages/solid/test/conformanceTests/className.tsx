import { expect, describe, it } from 'vitest';
import type { Component } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import type {
  BaseUiConformanceTestsOptions,
  ConformantComponentProps,
} from '../describeConformance';
import { throwMissingPropError } from './utils';

export function testClassName(
  element: Component<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  // Solid: the prop is `class`, not React's `className`.
  describe('prop: class', () => {
    const { render } = getOptions();

    if (!render) {
      throwMissingPropError('render');
    }

    it('should apply the className to the root element when passed as a string', () => {
      render(element, { class: 'test-class', 'data-testid': 'root' });
      expect(screen.getByTestId('root')).toHaveClass('test-class');
    });
  });
}
