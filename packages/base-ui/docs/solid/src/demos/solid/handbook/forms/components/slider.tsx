import { omit } from 'solid-js';

import clsx from 'clsx';
import { Slider } from '@solidports/base-ui/slider';

export function Root(props: Slider.Root.Props<any>) {
  const others = omit(props, 'class');
  return <Slider.Root class={clsx('grid grid-cols-2', props.class)} {...others} />;
}

export function Value(props: Slider.Value.Props) {
  const others = omit(props, 'class');
  return (
    <Slider.Value
      class={clsx('text-sm font-normal text-neutral-950 dark:text-white', props.class)}
      {...others}
    />
  );
}

export function Control(props: Slider.Control.Props) {
  const others = omit(props, 'class');
  return (
    <Slider.Control
      class={clsx('flex col-span-2 touch-none items-center py-3 select-none', props.class)}
      {...others}
    />
  );
}

export function Track(props: Slider.Track.Props) {
  const others = omit(props, 'class');
  return (
    <Slider.Track
      class={clsx('h-1 w-full bg-neutral-200 select-none dark:bg-neutral-800', props.class)}
      {...others}
    />
  );
}

export function Indicator(props: Slider.Indicator.Props) {
  const others = omit(props, 'class');
  return (
    <Slider.Indicator
      class={clsx('bg-neutral-950 select-none dark:bg-white', props.class)}
      {...others}
    />
  );
}

export function Thumb(props: Slider.Thumb.Props) {
  const others = omit(props, 'class');
  return (
    <Slider.Thumb
      class={clsx(
        'size-4 border border-neutral-950 bg-white select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-950 dark:has-[:focus-visible]:outline-white dark:border-white dark:bg-neutral-950',
        props.class,
      )}
      {...others}
    />
  );
}
