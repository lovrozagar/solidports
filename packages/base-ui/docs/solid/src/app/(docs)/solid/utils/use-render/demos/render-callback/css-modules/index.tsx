import { createMemo, createSignal, omit } from 'solid-js';
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
  const odd = createMemo(() => count() % 2 === 1);
  const state = createMemo(() => ({
    odd: odd(),
  }));
  const defaultProps = createMemo<useRender.ElementProps<'button'>>(() => ({
    className: styles.Button,
    type: 'button',
    children: (
      <>
        Counter: <span class={styles.count}>{count()}</span>
      </>
    ),
    onClick() {
      setCount((prev) => prev + 1);
    },
    'aria-label': `Count is ${count()}, click to increase.`,
  }));
  const element = useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    get state() {
      return state();
    },
    get props() {
      return mergeProps<'button'>(defaultProps(), otherProps);
    },
  });
  return <>{element}</>;
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
