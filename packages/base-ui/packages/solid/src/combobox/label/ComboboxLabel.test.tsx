import { expect, vi, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Combobox.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Combobox.Label, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Combobox.Root>
          {node(props!)}
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
    },
  }));

  // Solid: there is no owner stack to capture, so React's `captureOwnerStack` stub is not needed.
  it('warns without relying on React.captureOwnerStack when labeling an external input', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Combobox.Root>
          <Combobox.Label>Fruit</Combobox.Label>
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('<Combobox.Label> labels <Combobox.Trigger> only.'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it.skipIf(!isJSDOM)('does not run the development warning in production', () => {
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Combobox.Root>
          <Combobox.Label>Fruit</Combobox.Label>
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      process.env.NODE_ENV = nodeEnv;
    }
  });
});
