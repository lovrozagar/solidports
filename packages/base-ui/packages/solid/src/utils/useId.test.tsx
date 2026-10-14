import { act, createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { expect, describe, it } from 'vitest';
import { access } from '../solid-helpers';
import { useId } from './useId';
import { renderServer } from '../../test/ssrFixtures';
import fixtures, { setOverrideId, setProvidedId } from './useId.ssr-fixtures';


describe('useId', () => {
  const { render } = createRenderer();

  it('returns the provided ID', () => {
    // Solid: `renderServer` is the `renderToString` counterpart; its fixture reads the id from a
    // signal the test sets, as React's `setProps` does.
    setProvidedId('some-id');
    const { hydrate } = renderServer(fixtures, 'providedId');
    hydrate();

    expect(screen.getByTestId('target')).toHaveProperty('id', 'some-id');

    act(() => setProvidedId('another-id'));

    expect(screen.getByTestId('target')).toHaveProperty('id', 'another-id');
  });

  it("generates an ID if one isn't provided", () => {
    setOverrideId(undefined);
    const { hydrate } = renderServer(fixtures, 'generatedId');
    hydrate();

    expect(screen.getByTestId('target').id).not.toBe('');

    act(() => setOverrideId('another-id'));
    expect(screen.getByTestId('target')).toHaveProperty('id', 'another-id');
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

    expect(screen.getByTestId('labelable')).toHaveAttribute(
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

    expect(screen.getByTestId('labelable')).toHaveAttribute(
      'aria-labelledby',
      `${screen.getByTestId('labelA').id} ${screen.getByTestId('labelB').id}`,
    );
  });

  // Solid: React's title; rendered under NoHydration as the server-render counterpart.
  it('provides an ID on server in React 18', () => {
    renderServer(fixtures, 'serverId');

    expect(screen.getByTestId('target').id).not.toBe('');
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

    expect(screen.getByTestId('label').id.slice(0, 8)).toBe(`${PREFIX}-`);
    expect(screen.getByTestId('labelable')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });
});
