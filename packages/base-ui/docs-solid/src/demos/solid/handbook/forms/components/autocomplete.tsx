import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Autocomplete } from '@solidports/base-ui/autocomplete';

export function Root(props: Autocomplete.Root.Props<any>) {
  return <Autocomplete.Root {...props} />;
}

export function Input(props: Autocomplete.Input.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Autocomplete.Input
      class={clsx(
        'bg-[canvas] h-10 w-[16rem] md:w-[20rem] font-normal rounded-md border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800',
        local.class,
      )}
      {...others}
    />
  );
}

export function Portal(props: Autocomplete.Portal.Props) {
  return <Autocomplete.Portal {...props} />;
}

export function Positioner(props: Autocomplete.Positioner.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Autocomplete.Positioner
      class={clsx('outline-none data-[empty]:hidden', local.class)}
      sideOffset={4}
      {...others}
    />
  );
}

export function Popup(props: Autocomplete.Popup.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Autocomplete.Popup
      class={clsx(
        'w-[var(--anchor-width)] max-h-[min(var(--available-height),23rem)] max-w-[var(--available-width)] overflow-y-auto scroll-pt-2 scroll-pb-2 overscroll-contain rounded-md bg-[canvas] py-2 text-gray-900 shadow-lg shadow-gray-200 outline-1 outline-gray-200 dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300',
        local.class,
      )}
      {...others}
    />
  );
}

export function List(props: Autocomplete.List.Props) {
  return <Autocomplete.List {...props} />;
}

export function Item(props: Autocomplete.Item.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Autocomplete.Item
      class={clsx(
        'flex flex-col gap-0.25 cursor-default py-2 pr-8 pl-4 text-base leading-4 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-gray-50 data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-2 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded data-[highlighted]:before:bg-gray-900',
        local.class,
      )}
      {...others}
    />
  );
}
