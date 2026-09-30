import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Slider } from '@solidports/base-ui/slider';

export function Root(props: Slider.Root.Props<any>) {
  const [local, others] = splitProps(props, ['class']);
  return <Slider.Root class={clsx('grid grid-cols-2', local.class)} {...others} />;
}

export function Value(props: Slider.Value.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Slider.Value class={clsx('text-sm font-medium text-gray-900', local.class)} {...others} />
  );
}

export function Control(props: Slider.Control.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Slider.Control
      class={clsx('flex col-span-2 touch-none items-center py-3 select-none', local.class)}
      {...others}
    />
  );
}

export function Track(props: Slider.Track.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Slider.Track
      class={clsx(
        'h-1 w-full rounded bg-gray-200 shadow-[inset_0_0_0_1px] shadow-gray-200 select-none',
        local.class,
      )}
      {...others}
    />
  );
}

export function Indicator(props: Slider.Indicator.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Slider.Indicator class={clsx('rounded bg-gray-700 select-none', local.class)} {...others} />
  );
}

export function Thumb(props: Slider.Thumb.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Slider.Thumb
      class={clsx(
        'size-4 rounded-full bg-white outline outline-gray-300 select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-800',
        local.class,
      )}
      {...others}
    />
  );
}
