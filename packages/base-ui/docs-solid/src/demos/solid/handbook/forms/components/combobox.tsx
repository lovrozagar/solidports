import { splitProps } from "solid-js";
import clsx from "clsx";
import { Combobox } from "@solidports/base-ui/combobox";
import { X } from "lucide-solid";

export function Root(props: Combobox.Root.Props<unknown, boolean>) {
  return <Combobox.Root {...props} />;
}

export function Input(props: Combobox.Input.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Input
      class={clsx(
        "h-10 w-64 rounded-md font-normal border border-gray-200 pl-3.5 text-base text-gray-900 bg-[canvas] focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800",
        local.class,
      )}
      {...others}
    />
  );
}

export function Clear(props: Combobox.Clear.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Clear
      class={clsx(
        "combobox-clear flex h-10 w-6 items-center justify-center rounded bg-transparent p-0",
        local.class,
      )}
      {...others}
    >
      <X class="size-4" />
    </Combobox.Clear>
  );
}

export function Trigger(props: Combobox.Trigger.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Trigger
      class={clsx(
        "flex h-10 w-6 items-center justify-center rounded bg-transparent p-0",
        local.class,
      )}
      {...others}
    />
  );
}

export function Portal(props: Combobox.Portal.Props) {
  return <Combobox.Portal {...props} />;
}

export function Positioner(props: Combobox.Positioner.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Positioner
      class={clsx("outline-none", local.class)}
      sideOffset={4}
      {...others}
    />
  );
}

export function Popup(props: Combobox.Popup.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Popup
      class={clsx(
        "w-[var(--anchor-width)] max-h-[23rem] max-w-[var(--available-width)] origin-[var(--transform-origin)] rounded-md bg-[canvas] text-gray-900 shadow-lg shadow-gray-200 outline-1 outline-gray-200 transition-[transform,scale,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:shadow-none dark:-outline-offset-1 dark:outline-gray-300 duration-100",
        local.class,
      )}
      {...others}
    />
  );
}

export function Empty(props: Combobox.Empty.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Empty
      class={clsx(
        "p-4 text-[0.925rem] leading-4 text-gray-600 empty:m-0 empty:p-0",
        local.class,
      )}
      {...others}
    />
  );
}

export function List(props: Combobox.List.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.List
      class={clsx(
        "outline-0 overflow-y-auto scroll-py-[0.5rem] py-2 overscroll-contain max-h-[min(23rem,var(--available-height))] data-[empty]:p-0",
        local.class,
      )}
      {...others}
    />
  );
}

export function Item(props: Combobox.Item.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <Combobox.Item
      class={clsx(
        "grid cursor-default grid-cols-[0.75rem_1fr] items-center gap-2 py-2 pr-8 pl-4 text-base leading-4 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-gray-50 data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-2 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-sm data-[highlighted]:before:bg-gray-900",
        local.class,
      )}
      {...others}
    />
  );
}

export function ItemIndicator(props: Combobox.ItemIndicator.Props) {
  const [local, others] = splitProps(props, ["class"]);
  return <Combobox.ItemIndicator class={clsx("col-start-1", local.class)} {...others} />;
}
