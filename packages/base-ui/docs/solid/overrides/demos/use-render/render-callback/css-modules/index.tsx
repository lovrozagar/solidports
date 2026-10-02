import { createSignal, omit } from 'solid-js';
import { useRender } from '@solidports/base-ui/use-render';
import { mergeProps } from '@solidports/base-ui/merge-props';
import styles from './index.module.css';

interface CounterState {
  odd: boolean;
}

interface CounterProps extends useRender.ComponentProps<'button', CounterState> {}

function Counter(props: CounterProps) {
  const otherProps = omit(props, 'render');

  const [count, setCount] = createSignal(0);
  // The component body runs once: getters keep the state and props current.
  const state: CounterState = {
    get odd() {
      return count() % 2 === 1;
    },
  };

  const defaultProps: useRender.ElementProps<'button'> = {
    class: styles.Button,
    type: 'button',
    get children() {
      return (
        <>
          Counter: <span class={styles.count}>{count()}</span>
        </>
      );
    },
    onClick() {
      setCount((prev) => prev + 1);
    },
    get 'aria-label'() {
      return `Count is ${count()}, click to increase.`;
    },
  };

  const element = useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    state,
    props: mergeProps<'button'>(defaultProps, otherProps),
  });

  return <>{element()}</>;
}

export default function ExampleCounter() {
  return (
    <Counter
      render={(props, state) => (
        <button {...props}>
          {props.children}
          <span class={styles.suffix}>{state.odd ? '👎' : '👍'}</span>
        </button>
      )}
    />
  );
}
