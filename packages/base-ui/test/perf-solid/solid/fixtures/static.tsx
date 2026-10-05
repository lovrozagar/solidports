import { createSignal, For, omit } from 'solid-js';
import { Button } from '@solidports/base-ui/button';
import { Avatar } from '@solidports/base-ui/avatar';
import { Progress } from '@solidports/base-ui/progress';
import { Meter } from '@solidports/base-ui/meter';
import { Separator } from '@solidports/base-ui/separator';
import { Input } from '@solidports/base-ui/input';
import { useRender } from '@solidports/base-ui/use-render';
import { mergeProps } from '@solidports/base-ui/merge-props';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function ButtonsNonNative() {
  return (
    <div>
      <For each={range(size(1000))}>
        {(i) => (
          <Button nativeButton={false} render="span">
            B{i}
          </Button>
        )}
      </For>
    </div>
  );
}

function ButtonsRenderFn() {
  return (
    <div>
      <For each={range(size(1000))}>
        {(i) => (
          <Button nativeButton={false} render={(props) => <span {...props} />}>
            B{i}
          </Button>
        )}
      </For>
    </div>
  );
}

function Avatars() {
  const src = useExposed('src', IMAGE);
  return (
    <div>
      <For each={range(size(1000))}>
        {() => (
          <Avatar.Root>
            <Avatar.Image src={src()} width="8" height="8" />
            <Avatar.Fallback data-testid="fallback">A</Avatar.Fallback>
          </Avatar.Root>
        )}
      </For>
    </div>
  );
}

function ProgressMeters() {
  const value = useExposed('value', 0);
  return (
    <div>
      <For each={range(size(500))}>
        {() => (
          <Progress.Root value={value()}>
            <Progress.Track>
              <Progress.Indicator />
            </Progress.Track>
          </Progress.Root>
        )}
      </For>
      <For each={range(size(500))}>
        {() => (
          <Meter.Root value={value()}>
            <Meter.Track>
              <Meter.Indicator />
            </Meter.Track>
          </Meter.Root>
        )}
      </For>
    </div>
  );
}

function SeparatorsInputs() {
  return (
    <div>
      <For each={range(size(500))}>
        {() => (
          <>
            <Input defaultValue="" />
            <Separator />
          </>
        )}
      </For>
    </div>
  );
}

interface CounterState {
  odd: boolean;
}
function Counter(props: useRender.ComponentProps<'button', CounterState>) {
  const otherProps = omit(props, 'render');
  const [count, setCount] = createSignal(0);
  const state: CounterState = {
    get odd() {
      return count() % 2 === 1;
    },
  };
  const element = useRender({
    defaultTagName: 'button',
    get render() {
      return props.render;
    },
    state,
    props: mergeProps<'button'>(
      {
        type: 'button',
        get children() {
          return count();
        },
        onClick() {
          setCount((prev) => prev + 1);
        },
        get 'aria-label'() {
          return `Count is ${count()}`;
        },
      },
      otherProps,
    ),
  });
  return <>{element()}</>;
}

function Counters() {
  return (
    <div>
      <For each={range(size(1000))}>{() => <Counter data-testid="counter" />}</For>
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'static/button-nonnative': ButtonsNonNative,
  'static/button-render-fn': ButtonsRenderFn,
  'static/avatar': Avatars,
  'static/progress-meter': ProgressMeters,
  'static/separator-input': SeparatorsInputs,
  'static/use-render': Counters,
};
