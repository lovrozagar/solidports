import { expect, describe, it } from 'vitest';
import { createSignal, Show, type Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { useRegisteredLabelId } from './useRegisteredLabelId';

describe('useRegisteredLabelId', () => {
  const { render } = createRenderer();

  function Label(props: {
    id: string;
    setLabelId: Setter<string | undefined>;
    children: JSX.Element;
  }) {
    const registeredId = useRegisteredLabelId(() => props.id, props.setLabelId);
    return <span id={registeredId()}>{props.children}</span>;
  }

  function Test(props: { labels: 'old' | 'both' | 'new' }) {
    // Solid: label cleanups write this signal while a parent computation disposes them.
    const [labelId, setLabelId] = createSignal<string | undefined>(undefined, {
      ownedWrite: true,
    });

    return (
      <>
        <div data-testid="target" aria-labelledby={labelId()} />
        <Show when={props.labels !== 'new'}>
          <Label id="old-label" setLabelId={setLabelId}>
            Old
          </Label>
        </Show>
        <Show when={props.labels !== 'old'}>
          <Label id="new-label" setLabelId={setLabelId}>
            New
          </Label>
        </Show>
      </>
    );
  }

  it('does not let an older label cleanup clear a newer label', async () => {
    const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');
    await render(() => <Test labels={labels()} />);

    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('aria-labelledby', 'old-label');

    act(() => setLabels('both'));
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');

    act(() => setLabels('new'));
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');
  });
});
