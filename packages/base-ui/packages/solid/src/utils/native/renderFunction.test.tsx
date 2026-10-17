/*
 * A render function on a native part (plan 3 leaf 5.1.2) re-runs exactly when the slow path's
 * branch does: for a signal read at its top level (the part's state or the consumer's own), never
 * because something else in the computation that resolves it changed.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { act, createRenderer, expectNativePath } from '#test-utils';

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

describe('a render function on a native part', () => {
  const { render } = createRenderer();

  it('re-runs for a consumer signal read at its top level, with a new element', () => {
    const [variant, setVariant] = createSignal('a');
    const calls = { inner: 0, top: 0 };
    const renderTrigger = (props: object) => {
      calls.inner += 1;
      return <button {...props} data-variant={variant()} />;
    };
    const renderTopLevel = (props: object) => {
      calls.top += 1;
      return variant() === 'a' ? <button {...props} /> : <button {...props} data-b="" />;
    };
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger render={renderTrigger}>Inner</Collapsible.Trigger>
        <Collapsible.Trigger render={renderTopLevel}>Top</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    const inner = screen.getByRole('button', { name: 'Inner' });
    const top = screen.getByRole('button', { name: 'Top' });
    expectNativePath(inner, top);
    expect(calls).toEqual({ inner: 1, top: 1 });

    setVariant('b');
    flush();
    // A read inside the function's JSX updates its element in place; one at its top level renders
    // the function again.
    expect(calls).toEqual({ inner: 1, top: 2 });
    expect(screen.getByRole('button', { name: 'Inner' })).toBe(inner);
    expect(inner).toHaveAttribute('data-variant', 'b');
    expect(screen.getByRole('button', { name: 'Top' })).not.toBe(top);
    expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('data-b');
  });

  it("does not re-run a trigger's function when its parent's other children change", () => {
    const [label, setLabel] = createSignal('one');
    let calls = 0;
    const renderTrigger = (props: object) => {
      calls += 1;
      return <button {...props} />;
    };
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger render={renderTrigger}>Toggle</Collapsible.Trigger>
        <span>{label()}</span>
      </Collapsible.Root>
    ));
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    setLabel('two');
    flush();
    fireEvent.click(trigger);
    flush();
    expect(calls).toBe(1);
    expect(screen.getByRole('button', { name: 'Toggle' })).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  // A parent resolves its children as one array: a function its parent called directly (a thunk)
  // would re-run, and re-create its element, whenever a sibling's function re-renders.
  it("does not re-run a part's function when a sibling part's function re-renders", () => {
    const [variant, setVariant] = createSignal('a');
    const calls = { trigger: 0, top: 0, panel: 0 };
    const renderTrigger = (props: object) => {
      calls.trigger += 1;
      return <button {...props} />;
    };
    const renderTopLevel = (props: object) => {
      calls.top += 1;
      return variant() === 'a' ? <button {...props} /> : <button {...props} data-b="" />;
    };
    const renderPanel = (props: object) => {
      calls.panel += 1;
      return <section {...props} />;
    };
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger render={renderTrigger}>Inner</Collapsible.Trigger>
        <Collapsible.Trigger render={renderTopLevel}>Top</Collapsible.Trigger>
        <Collapsible.Panel render={renderPanel}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const trigger = screen.getByRole('button', { name: 'Inner' });
    const panel = screen.getByText('Content');
    setVariant('b');
    flush();
    expect(calls).toEqual({ trigger: 1, top: 2, panel: 1 });
    expect(screen.getByRole('button', { name: 'Inner' })).toBe(trigger);
    expect(screen.getByText('Content')).toBe(panel);
  });

  it.each(['collapsible', 'accordion'] as const)(
    "does not re-run a %s panel's function while the panel closes",
    async (family) => {
      let calls = 0;
      const renderPanel = (props: object) => {
        calls += 1;
        return <section {...props} />;
      };
      render(() =>
        family === 'collapsible' ? (
          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Toggle</Collapsible.Trigger>
            <Collapsible.Panel render={renderPanel}>Content</Collapsible.Panel>
          </Collapsible.Root>
        ) : (
          <Accordion.Root defaultValue={['a']}>
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger>Toggle</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel render={renderPanel}>Content</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        ),
      );
      const panel = screen.getByText('Content');
      expectNativePath(panel);
      expect(calls).toBe(1);

      // Closing changes the open state the panel's condition reads while the panel stays mounted
      // for its exit: the element that leaves is the one that was open.
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
      flush();
      expect(calls).toBe(1);
      expect(screen.queryByText('Content') ?? panel).toBe(panel);

      await act(async () => {
        await waitForAnimationFrame();
      });
      expect(screen.queryByText('Content')).toBe(null);
      expect(calls).toBe(1);
    },
  );
});
