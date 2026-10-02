import { expect, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import {
  DirectionProvider,
  useDirection,
  type TextDirection,
} from '@solidports/base-ui/direction-provider';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';

function DirectionProbe() {
  const direction = useDirection();
  return <span data-testid="direction">{direction()}</span>;
}

function DirectionProviderTest(props: { direction?: TextDirection }) {
  return (
    <DirectionProvider direction={props.direction}>
      <DirectionProbe />
    </DirectionProvider>
  );
}

describe('<DirectionProvider />', () => {
  const { render } = createRenderer();

  it('defaults useDirection to ltr outside a provider', async () => {
    await render(DirectionProbe);

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('provides the configured direction to descendants', async () => {
    // Solid: props change through a signal instead of `setProps`.
    const [direction, setDirection] = createSignal<TextDirection>('rtl');
    await render(() => <DirectionProviderTest direction={direction()} />);

    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');

    act(() => setDirection('ltr'));

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });
});
