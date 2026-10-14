import { expect, vi, describe, it, test } from 'vitest';
import { createSignal } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import type { ReactLikeRef } from '../solid-helpers';
import { useRenderElement } from './useRenderElement';

type Ref<T> = ReactLikeRef<T | null> | ((instance: T | null) => unknown) | undefined;

function createRef<T>(): ReactLikeRef<T | null> {
  return { current: null };
}

// Solid: a part merges refs through `useRenderElement`'s `ref` parameter (an array of refs), the
// counterpart of React's `useMergedRefs`.
describe('useMergedRefs', () => {
  const { render } = createRenderer();

  it('returns a single ref-setter function that forks the ref to its inputs', async () => {
    function Component(props: { innerRef: Ref<HTMLDivElement> }) {
      const [ownRefCurrent, ownRef] = createSignal<HTMLDivElement | null>(null);

      const view = useRenderElement(
        'div',
        {},
        {
          ref: [props.innerRef, (instance: HTMLDivElement | null) => ownRef(() => instance)],
          get children() {
            return ownRefCurrent() ? 'has a ref' : 'has no ref';
          },
        },
      );
      return <>{view()}</>;
    }

    const outerRef = createRef<HTMLDivElement>();

    await render(() => <Component innerRef={outerRef} />);

    expect(outerRef.current!.textContent).toBe('has a ref');
  });

  it('forks if only one of the branches requires a ref', async () => {
    function Component(props: { ref?: Ref<HTMLDivElement> }) {
      const [hasRef, setHasRef] = createSignal(false);
      const handleOwnRef = () => setHasRef(true);

      const view = useRenderElement(
        'div',
        {},
        {
          props: [{ 'data-testid': 'hasRef' }],
          get ref() {
            return [handleOwnRef, props.ref];
          },
          get children() {
            return String(hasRef());
          },
        },
      );
      return <>{view()}</>;
    }

    await render(() => <Component />);

    expect(screen.getByTestId('hasRef')).toHaveTextContent('true');
  });

  it('does nothing if none of the forked branches requires a ref', async () => {
    function Outer(props: { ref?: Ref<HTMLDivElement> }) {
      const view = useRenderElement(
        'div',
        {},
        {
          get ref() {
            return [undefined, props.ref];
          },
        },
      );
      return <>{view()}</>;
    }

    await expect(render(() => <Outer />)).resolves.not.toThrow();
  });

  describe('changing refs', () => {
    interface TestComponentProps {
      leftRef?: Ref<HTMLDivElement>;
      rightRef?: Ref<HTMLDivElement>;
      id?: string;
    }

    function Div(props: TestComponentProps) {
      const view = useRenderElement(
        'div',
        {},
        {
          props: {
            get id() {
              return props.id;
            },
          },
          get ref() {
            return [props.leftRef, props.rightRef];
          },
        },
      );
      return <>{view()}</>;
    }

    // Solid: React's `setProps` maps to a signal the rendered tree reads.
    async function renderDiv(initialProps: TestComponentProps) {
      const [props, setProps] = createSignal(initialProps);
      await render(() => (
        <Div
          id={props().id}
          leftRef={props().leftRef}
          rightRef={props().rightRef}
        />
      ));
      return {
        setProps: (next: TestComponentProps) => act(() => setProps((prev) => ({ ...prev, ...next }))),
      };
    }

    it('handles changing from no ref to some ref', async () => {
      const { setProps } = await renderDiv({ id: 'test' });

      const ref = createRef<HTMLDivElement>();
      setProps({ leftRef: ref });

      expect(ref.current!.id).toBe('test');
    });

    it('cleans up detached refs', async () => {
      const firstLeftRef = createRef<HTMLDivElement>();
      const firstRightRef = createRef<HTMLDivElement>();
      const secondRightRef = createRef<HTMLDivElement>();

      const { setProps } = await renderDiv({
        leftRef: firstLeftRef,
        rightRef: firstRightRef,
        id: 'test',
      });

      expect(firstLeftRef.current!.id).toBe('test');
      expect(firstRightRef.current!.id).toBe('test');
      expect(secondRightRef.current).toBe(null);

      setProps({ rightRef: secondRightRef });

      expect(firstLeftRef.current!.id).toBe('test');
      expect(firstRightRef.current).toBe(null);
      expect(secondRightRef.current!.id).toBe('test');
    });
  });

  test('calls clean up function if it exists', async () => {
    const cleanUp = vi.fn();
    const setup = vi.fn();
    const setup2 = vi.fn();
    const nullHandler = vi.fn();

    function onRefChangeWithCleanup(ref: HTMLDivElement | null) {
      if (ref) {
        setup(ref.id);
      } else {
        nullHandler();
      }
      return cleanUp;
    }

    function onRefChangeWithoutCleanup(ref: HTMLDivElement | null) {
      if (ref) {
        setup2(ref.id);
      } else {
        nullHandler();
      }
    }

    function App() {
      const view = useRenderElement('div', {}, {
        props: { id: 'test' },
        ref: [onRefChangeWithCleanup, onRefChangeWithoutCleanup],
      });
      return <>{view()}</>;
    }

    const { unmount } = await render(() => <App />);

    expect(setup.mock.calls[0][0]).toBe('test');
    expect(setup.mock.calls.length).toBe(1);
    expect(cleanUp.mock.calls.length).toBe(0);

    expect(setup2.mock.calls[0][0]).toBe('test');
    expect(setup2.mock.calls.length).toBe(1);

    unmount();

    expect(setup.mock.calls.length).toBe(1);
    expect(cleanUp.mock.calls.length).toBe(1);

    // Setup was not called again
    expect(setup2.mock.calls.length).toBe(1);
    // Null handler hit because no cleanup is returned
    expect(nullHandler.mock.calls.length).toBe(1);
  });
});
