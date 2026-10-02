import { act, createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal } from 'solid-js';
import { NoHydration } from '@solidjs/web';
import { access } from '../solid-helpers';
import { useId } from './useId';

interface TestComponentProps {
  id?: string;
}

describe('useId', () => {
  const { render } = createRenderer();

  it('returns the provided ID', () => {
    const [id, setId] = createSignal('some-id');

    function TestComponent(props: TestComponentProps) {
      const implicitId = useId(() => props.id);
      return <span data-testid="target" id={implicitId()} />;
    }

    render(() => <TestComponent id={id()} />);

    expect(screen.getByTestId('target')).to.have.property('id', 'some-id');

    act(() => setId('another-id'));

    expect(screen.getByTestId('target')).to.have.property('id', 'another-id');
  });

  it("generates an ID if one isn't provided", () => {
    const [id, setId] = createSignal<string | undefined>();

    function TestComponent(props: TestComponentProps) {
      const implicitId = useId(() => props.id);
      return <span data-testid="target" id={implicitId()} />;
    }
    render(() => <TestComponent id={id()} />);

    expect(screen.getByTestId('target').id).not.to.equal('');
    act(() => setId('another-id'));
    expect(screen.getByTestId('target')).to.have.property('id', 'another-id');
  });

  it('can be suffixed', () => {
    function Widget() {
      const implicitId = useId();
      const labelId = () => `${implicitId()}-label`;

      return (
        <>
          <span data-testid="labelable" aria-labelledby={labelId()} />
          <span data-testid="label" id={labelId()}>
            Label
          </span>
        </>
      );
    }
    render(() => <Widget />);

    expect(screen.getByTestId('labelable')).to.have.attr(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });

  it('can be used in in IDREF attributes', () => {
    function Widget() {
      const labelPartA = useId();
      const labelPartB = useId();

      return (
        <>
          <span
            data-testid="labelable"
            aria-labelledby={`${access(labelPartA)} ${access(labelPartB)}`}
          />
          <span data-testid="labelA" id={access(labelPartA)}>
            A
          </span>
          <span data-testid="labelB" id={access(labelPartB)}>
            B
          </span>
        </>
      );
    }
    render(() => <Widget />);

    expect(screen.getByTestId('labelable')).to.have.attr(
      'aria-labelledby',
      `${screen.getByTestId('labelA').id} ${screen.getByTestId('labelB').id}`,
    );
  });

  // Solid: React's title; rendered under NoHydration as the server-render counterpart.
  it('provides an ID on server in React 18', () => {
    function TestComponent() {
      const id = useId();
      return <span data-testid="target" id={access(id)} />;
    }
    render(() => (
      <NoHydration>
        <TestComponent />
      </NoHydration>
    ));

    expect(screen.getByTestId('target').id).not.to.equal('');
  });

  it('can be prefixed', () => {
    const PREFIX = 'base-ui';
    function Widget() {
      const id = useId(undefined, PREFIX);

      return (
        <>
          <span data-testid="labelable" aria-labelledby={access(id)} />
          <span data-testid="label" id={access(id)}>
            Label
          </span>
        </>
      );
    }
    render(() => <Widget />);

    expect(screen.getByTestId('label').id.slice(0, 8)).to.equal(`${PREFIX}-`);
    expect(screen.getByTestId('labelable')).to.have.attr(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });
});
