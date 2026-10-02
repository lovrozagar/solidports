/* eslint-disable @typescript-eslint/no-shadow */
import { act, flushMicrotasks } from '#test-utils';
import { isJSDOM } from '#utils/detectBrowser';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal, onSettled, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { vi } from 'vitest';
import {
  FloatingDelayGroup,
  useDelayGroup,
  useFloating,
  useHover,
  useInteractions,
} from '../index';

interface Props {
  label: string;
  children: Component;
}

function Tooltip(props: Props) {
  const [open, setOpen] = createSignal(false);

  const { x, y, refs, strategy, context } = useFloating({
    onOpenChange: setOpen,
    get open() {
      return open();
    },
  });

  const { delayRef, isInstantPhase } = useDelayGroup({
    context,
    options: {
      get open() {
        return open();
      },
    },
  });
  const hover = useHover({ context, props: { delay: () => delayRef.current } });
  const { getReferenceProps } = useInteractions([hover]);

  let renderCount = 0;
  let renderCountRef: HTMLSpanElement | undefined;

  // A Solid component body runs once: count it after mount.
  onSettled(() => {
    renderCount += 1;
    if (renderCountRef) {
      renderCountRef.textContent = String(renderCount);
    }
  });

  const referenceProps: JSX.HTMLAttributes<Element> & { 'data-instant-phase'?: string } = {
    ref: refs.setReference,
    get 'data-instant-phase'() {
      return isInstantPhase() ? '' : undefined;
    },
  };

  return (
    <>
      {props.children(getReferenceProps(referenceProps))}
      <span data-testid={`render-count-${props.label}`} ref={renderCountRef} />
      <Show when={open()}>
        <div
          data-testid={`floating-${props.label}`}
          ref={refs.setFloating}
          style={{ left: `${x() ?? 0}px`, position: strategy(), top: `${y() ?? 0}px` }}
        >
          {props.label}
        </div>
      </Show>
    </>
  );
}

function App() {
  return (
    <FloatingDelayGroup delay={{ close: 200, open: 1000 }}>
      <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
      <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
      <Tooltip label="three">{(p) => <button data-testid="reference-three" {...p} />}</Tooltip>
    </FloatingDelayGroup>
  );
}

describe.skipIf(!isJSDOM)('FloatingDelayGroup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('groups delays correctly', async () => {
    render(() => <App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(999));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(199));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  test('timeoutMs', async () => {
    function App() {
      return (
        <FloatingDelayGroup delay={{ close: 100, open: 1000 }} timeoutMs={500}>
          <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
          <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
          <Tooltip label="three">{(p) => <button data-testid="reference-three" {...p} />}</Tooltip>
        </FloatingDelayGroup>
      );
    }

    render(() => <App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    act(() => vi.advanceTimersByTime(1000));
    await flushMicrotasks();

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(499));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(99));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  // Solid: there is no StrictMode; the lifecycle runs once.
  it('resets the instant phase after Strict Mode replays the lifecycle effects', async () => {
    render(() => (
      <FloatingDelayGroup delay={{ open: 1000, close: 0 }} timeoutMs={50}>
        <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
        <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
      </FloatingDelayGroup>
    ));

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));
    act(() => vi.advanceTimersByTime(1000));
    await flushMicrotasks();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));
    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    const secondReference = screen.getByTestId('reference-two');
    expect(secondReference).toHaveAttribute('data-instant-phase');

    fireEvent.mouseLeave(secondReference);
    act(() => vi.advanceTimersByTime(50));
    await flushMicrotasks();

    expect(secondReference).not.toHaveAttribute('data-instant-phase');
  });

  it('keeps the active context when an inactive consumer unmounts', async () => {
    function Test() {
      const [showSecond, setShowSecond] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
          <Show when={showSecond()}>
            <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
          </Show>
          <Tooltip label="three">{(p) => <button data-testid="reference-three" {...p} />}</Tooltip>
          <button type="button" onClick={() => setShowSecond(false)}>
            Remove inactive
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));
    act(() => vi.advanceTimersByTime(1000));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove inactive' }));
    expect(screen.queryByTestId('reference-two')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));
    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();
  });

  it('keeps the timeout active when the last closed consumer unmounts', async () => {
    function Test() {
      const [showFirst, setShowFirst] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Show when={showFirst()}>
            <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
          </Show>
          <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
          <button type="button" onClick={() => setShowFirst(false)}>
            Remove closed
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));
    act(() => vi.advanceTimersByTime(1000));
    await flushMicrotasks();

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));
    act(() => vi.advanceTimersByTime(100));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove closed' }));
    expect(screen.queryByTestId('reference-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));
    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
  });

  it('does not re-render unrelated consumers', async () => {
    function App() {
      return (
        <FloatingDelayGroup delay={{ close: 100, open: 1000 }} timeoutMs={500}>
          <Tooltip label="one">{(p) => <button data-testid="reference-one" {...p} />}</Tooltip>
          <Tooltip label="two">{(p) => <button data-testid="reference-two" {...p} />}</Tooltip>
          <Tooltip label="three">{(p) => <button data-testid="reference-three" {...p} />}</Tooltip>
        </FloatingDelayGroup>
      );
    }

    render(() => <App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    act(() => vi.advanceTimersByTime(1000));
    await flushMicrotasks();

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(499));
    await flushMicrotasks();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    act(() => vi.advanceTimersByTime(1));
    await flushMicrotasks();

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
    // TODO: with fine-grained reactivity in Solid, we always expect 1 render count on 1 change
    expect(screen.queryByTestId('render-count-one')).toHaveTextContent('1');
    expect(screen.queryByTestId('render-count-two')).toHaveTextContent('1');
    expect(screen.queryByTestId('render-count-three')).toHaveTextContent('1');
  });
});
