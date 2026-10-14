import { describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { waitFor } from '@solidjs/testing-library';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Input } from '@solidports/base-ui/input';
import { renderServer } from '../../test/ssrFixtures';
import ssrFixtures, { setControlledValue } from './Input.ssr-fixtures';

describe('<Input />', () => {
  const { render } = createRenderer();

  describeConformance(Input, () => ({
    refInstanceof: window.HTMLInputElement,
    render,
  }));

  // jsdom keeps the value through hydration either way: only a browser resets it.
  describe.skipIf(isJSDOM)('hydration', () => {
    async function hydrateFixture(name: keyof typeof ssrFixtures.fixtures) {
      const { container, hydrate } = renderServer(ssrFixtures, name);
      hydrate();
      // Hydration reconciles the server attributes in a microtask.
      await Promise.resolve();
      flush();
      const control = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([aria-hidden]), textarea',
      )!;
      const form = container.querySelector('form')!;
      return { control, formValue: () => new FormData(form).get('name') };
    }

    it.each(['uncontrolled', 'uncontrolledReadOnly', 'textarea'] as const)(
      'keeps the server-rendered default value (%s)',
      async (name) => {
        const { control, formValue } = await hydrateFixture(name);
        await waitFor(() => expect(control).toHaveAttribute('data-filled'));
        expect(control.value).toBe('Ada');
        expect(formValue()).toBe('Ada');
      },
    );

    it('keeps the server-rendered default value of a number field', async () => {
      const { control, formValue } = await hydrateFixture('numberField');
      expect(control.value).toBe('42');
      expect(formValue()).toBe('42');
    });

    it('follows a controlled value after hydration', async () => {
      setControlledValue('Ada');
      flush();
      const { control, formValue } = await hydrateFixture('controlled');
      expect(control.value).toBe('Ada');
      expect(formValue()).toBe('Ada');

      setControlledValue('Grace');
      flush();
      expect(control.value).toBe('Grace');
      expect(formValue()).toBe('Grace');
    });
  });
});
