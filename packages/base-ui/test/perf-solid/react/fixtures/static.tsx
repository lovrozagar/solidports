import * as React from 'react';
import { Button } from '@base-ui/react/button';
import { Avatar } from '@base-ui/react/avatar';
import { Progress } from '@base-ui/react/progress';
import { Meter } from '@base-ui/react/meter';
import { Separator } from '@base-ui/react/separator';
import { Input } from '@base-ui/react/input';
import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function ButtonsNonNative() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Button key={i} nativeButton={false} render={<span />}>
          B{i}
        </Button>
      ))}
    </div>
  );
}

function ButtonsRenderFn() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Button key={i} nativeButton={false} render={(props) => <span {...props} />}>
          B{i}
        </Button>
      ))}
    </div>
  );
}

function Avatars() {
  const src = useExposed('src', IMAGE);
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Avatar.Root key={i}>
          <Avatar.Image src={src} width="8" height="8" />
          <Avatar.Fallback data-testid="fallback">A</Avatar.Fallback>
        </Avatar.Root>
      ))}
    </div>
  );
}

function ProgressMeters() {
  const value = useExposed('value', 0);
  return (
    <div>
      {range(size(500)).map((i) => (
        <Progress.Root key={`p${i}`} value={value}>
          <Progress.Track>
            <Progress.Indicator />
          </Progress.Track>
        </Progress.Root>
      ))}
      {range(size(500)).map((i) => (
        <Meter.Root key={`m${i}`} value={value}>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>
      ))}
    </div>
  );
}

function SeparatorsInputs() {
  return (
    <div>
      {range(size(500)).map((i) => (
        <React.Fragment key={i}>
          <Input defaultValue="" />
          <Separator />
        </React.Fragment>
      ))}
    </div>
  );
}

interface CounterState {
  odd: boolean;
}
function Counter(props: useRender.ComponentProps<'button', CounterState>) {
  const { render, ...otherProps } = props;
  const [count, setCount] = React.useState(0);
  const odd = count % 2 === 1;
  const state = React.useMemo(() => ({ odd }), [odd]);
  const element = useRender({
    defaultTagName: 'button',
    render,
    state,
    props: mergeProps<'button'>(
      {
        type: 'button',
        children: count,
        onClick() {
          setCount((prev) => prev + 1);
        },
        'aria-label': `Count is ${count}`,
      },
      otherProps,
    ),
  });
  return element;
}

function Counters() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Counter key={i} data-testid="counter" />
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'static/button-nonnative': ButtonsNonNative,
  'static/button-render-fn': ButtonsRenderFn,
  'static/avatar': Avatars,
  'static/progress-meter': ProgressMeters,
  'static/separator-input': SeparatorsInputs,
  'static/use-render': Counters,
};
