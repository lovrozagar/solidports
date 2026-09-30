import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Select } from '@solidports/base-ui/select';

export function Root(props: Select.Root.Props<any>) {
  return <Select.Root {...props} />;
}

export function Trigger(props: Select.Trigger.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.Trigger
      class={clsx(
        'flex h-10 min-w-36 items-center justify-between gap-3 rounded-md border border-gray-200 pr-3 pl-3.5 text-base text-gray-900 select-none hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-800 data-[popup-open]:bg-gray-100 cursor-default not-[[data-filled]]:text-gray-500 bg-[canvas]',
        local.class,
      )}
      {...others}
    />
  );
}

export function Value(props: Select.Value.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Select.Value class={clsx('', local.class)} {...others} />;
}

export function Icon(props: Select.Icon.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Select.Icon class={clsx('flex', local.class)} {...others} />;
}

export function Portal(props: Select.Portal.Props) {
  return <Select.Portal {...props} />;
}

export function Positioner(props: Select.Positioner.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.Positioner
      class={clsx('outline-none select-none z-10', local.class)}
      sideOffset={8}
      {...others}
    />
  );
}

export function Popup(props: Select.Popup.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.Popup
      class={clsx(
        'group origin-[var(--transform-origin)] bg-clip-padding rounded-md bg-[canvas] text-gray-900 shadow-lg shadow-gray-200 outline outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[side=none]:data-[ending-style]:transition-none data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[side=none]:data-[starting-style]:scale-100 data-[side=none]:data-[starting-style]:opacity-100 data-[side=none]:data-[starting-style]:transition-none dark:shadow-none dark:outline-gray-300',
        local.class,
      )}
      {...others}
    />
  );
}

export function ScrollUpArrow(props: Select.ScrollUpArrow.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.ScrollUpArrow
      class={clsx(
        "top-0 z-[1] flex h-4 w-full cursor-default items-center justify-center rounded-md bg-[canvas] text-center text-xs before:absolute data-[side=none]:before:top-[-100%] before:left-0 before:h-full before:w-full before:content-['']",
        local.class,
      )}
      {...others}
    />
  );
}

export function ScrollDownArrow(props: Select.ScrollDownArrow.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.ScrollDownArrow
      class={clsx(
        "bottom-0 z-[1] flex h-4 w-full cursor-default items-center justify-center rounded-md bg-[canvas] text-center text-xs before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[side=none]:before:bottom-[-100%]",
        local.class,
      )}
      {...others}
    />
  );
}

export function List(props: Select.List.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.List
      class={clsx(
        'relative py-1 scroll-py-6 overflow-y-auto max-h-[var(--available-height)]',
        local.class,
      )}
      {...others}
    />
  );
}

export function Item(props: Select.Item.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Select.Item
      class={clsx(
        'grid min-w-[var(--anchor-width)] cursor-default grid-cols-[0.75rem_1fr] items-center gap-3 py-2 pr-4 pl-2.5 text-sm leading-4 outline-none select-none group-data-[side=none]:min-w-[calc(var(--anchor-width)+1rem)] group-data-[side=none]:pr-12 group-data-[side=none]:text-base group-data-[side=none]:leading-4 data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-gray-50 data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-gray-900 pointer-coarse:py-2.5 pointer-coarse:text-[0.925rem]',
        local.class,
      )}
      {...others}
    />
  );
}

export function ItemIndicator(props: Select.ItemIndicator.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Select.ItemIndicator class={clsx('col-start-1', local.class)} {...others} />;
}

export function ItemText(props: Select.ItemText.Props) {
  const [local, others] = splitProps(props, ['class']);
  return <Select.ItemText class={clsx('col-start-2', local.class)} {...others} />;
}
