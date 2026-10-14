import { expect, beforeEach, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { renderServer } from '../../test/ssrFixtures';
import fixtures, { TestComponent } from './useId.react17.ssr-fixtures';

interface TestComponentProps {
  id?: string | undefined;
  prefix?: string | undefined;
}

// Solid: there is no React 17 fallback; `createUniqueId` provides ids on the server and the
// client alike. These pin the same guarantees for Solid's one path: an id on every render, kept
// across prop changes, and server markup that hydration keeps.
describe('useId with the React 17 id fallback', () => {
  const { render } = createRenderer();

  let renderedIds: (string | undefined)[] = [];

  function lastRenderedId() {
    return renderedIds[renderedIds.length - 1];
  }

  // Solid: React's `setProps` maps to a signal the rendered tree reads.
  async function renderTestComponent(initialProps: TestComponentProps) {
    const [props, setProps] = createSignal(initialProps);
    await render(() => (
      <TestComponent
        id={props().id}
        prefix={props().prefix}
        onId={(id) => renderedIds.push(id)}
      />
    ));
    return {
      setProps: (next: TestComponentProps) => act(() => setProps((prev) => ({ ...prev, ...next }))),
    };
  }

  beforeEach(() => {
    renderedIds = [];
  });

  it('returns the provided id', async () => {
    await renderTestComponent({ id: 'some-id' });

    expect(screen.getByTestId('target')).toHaveProperty('id', 'some-id');
  });

  it("generates an id if one isn't provided", async () => {
    await renderTestComponent({});

    expect(screen.getByTestId('target').id).toMatch(/^mui-.+$/);
  });

  it('generates an id with the provided prefix', async () => {
    await renderTestComponent({ prefix: 'base-ui' });

    expect(screen.getByTestId('target').id).toMatch(/^base-ui-.+$/);
  });

  it('generates an id when the provided id is removed', async () => {
    const { setProps } = await renderTestComponent({ id: 'some-id' });

    expect(screen.getByTestId('target')).toHaveProperty('id', 'some-id');

    setProps({ id: undefined });

    expect(screen.getByTestId('target').id).toMatch(/^mui-.+$/);
  });

  it('never renders without an id once the provided id is removed', async () => {
    const { setProps } = await renderTestComponent({ id: 'some-id' });

    renderedIds = [];

    setProps({ id: undefined });

    expect(renderedIds).not.toContain(undefined);
    expect(renderedIds).toHaveLength(1);
  });

  it('does not rerender after mounting with a provided id', async () => {
    await renderTestComponent({ id: 'some-id' });

    expect(renderedIds).toEqual(['some-id']);
  });

  it('keeps the generated id when the provided id is added and removed again', async () => {
    const { setProps } = await renderTestComponent({});

    const generatedId = screen.getByTestId('target').id;

    expect(generatedId).toMatch(/^mui-.+$/);

    setProps({ id: 'some-id' });

    expect(screen.getByTestId('target')).toHaveProperty('id', 'some-id');

    setProps({ id: undefined });

    expect(screen.getByTestId('target')).toHaveProperty('id', generatedId);
  });

  it('does not regenerate the id on subsequent renders', async () => {
    const { setProps } = await renderTestComponent({});

    const generatedId = screen.getByTestId('target').id;

    setProps({});

    expect(screen.getByTestId('target')).toHaveProperty('id', generatedId);
  });

  it('returns an empty string id override as-is', async () => {
    const { setProps } = await renderTestComponent({});

    expect(screen.getByTestId('target').id).toMatch(/^mui-.+$/);

    setProps({ id: '' });

    expect(lastRenderedId()).toBe('');
  });

  it('matches the server markup on the first client render', () => {
    const { hydrate } = renderServer(fixtures, 'generated');
    const serverId = screen.getByTestId('target').id;

    hydrate();

    expect(serverId).toMatch(/^mui-.+$/);
    expect(screen.getByTestId('target')).toHaveProperty('id', serverId);
  });

  it('renders the generated id on the server', () => {
    renderServer(fixtures, 'generated');

    expect(screen.getByTestId('target').id).toMatch(/^mui-.+$/);
  });
});
