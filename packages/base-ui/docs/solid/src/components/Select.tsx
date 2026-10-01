import { splitProps } from "solid-js"
import { Select } from "@solidports/base-ui/select"
import clsx from "clsx"
import { CaretSortIcon } from "../icons/CaretSortIcon"
import "./Select.css"
import { ThickCheckIcon } from "../icons/ThickCheckIcon"

export const Root = Select.Root

type TriggerProps = Omit<Select.Trigger.Props, "children"> & {
  children?: Select.Value.Props["children"]
}

export function Trigger(props: TriggerProps) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <Select.Trigger
      data-layout="text"
      class={clsx("GhostButton", local.class)}
      type={undefined}
      {...(rest as Select.Trigger.Props)}
    >
      <Select.Value>{local.children}</Select.Value>
      <Select.Icon render={() => <CaretSortIcon class="bui-ml--0.5" />} />
    </Select.Trigger>
  )
}

export function Popup(props: Select.Positioner.Props) {
  const [local, rest] = splitProps(props as Select.Positioner.Props & { class?: string }, [
    "class",
    "children",
  ])
  return (
    <Select.Portal>
      <Select.Positioner align="center" sideOffset={7} class="SelectPositioner" {...(rest as Select.Positioner.Props)}>
        <Select.Popup class={clsx("SelectPopup", local.class)}>{local.children}</Select.Popup>
        <Select.Arrow
          class="SelectArrow"
          render={() => (
            <svg width="20" height="8" viewBox="0 0 20 8" xmlns="http://www.w3.org/2000/svg">
              <path
                class="SelectArrowFill"
                d="M9.66437 0.602068L4.80758 4.97318C4.07308 5.63423 3.11989 6 2.13172 6H0V8H20V6H18.5349C17.5468 6 16.5936 5.63423 15.8591 4.97318L11.0023 0.602068C10.622 0.259794 10.0447 0.259793 9.66437 0.602068Z"
              />
              <path
                fill="none"
                class="SelectArrowStroke"
                d="M10.3333 1.34537L5.47655 5.71648C4.55842 6.54279 3.36693 7.00001 2.13172 7.00001H1H0V6.00001H2.13172C3.11989 6.00001 4.07308 5.63423 4.80758 4.97318L9.66437 0.602073C10.0447 0.259799 10.622 0.259799 11.0023 0.602073L15.8591 4.97318C16.5936 5.63423 17.5468 6.00001 18.5349 6.00001H20V7.00001H19H18.5349C17.2997 7.00001 16.1082 6.54279 15.1901 5.71648L10.3333 1.34537Z"
              />
            </svg>
          )}
        />
      </Select.Positioner>
    </Select.Portal>
  )
}

export function Item(props: Select.Item.Props) {
  const [local, rest] = splitProps(props as Select.Item.Props & { class?: string }, [
    "class",
    "children",
  ])
  return (
    <Select.Item class={clsx("SelectItem", local.class)} {...(rest as Select.Item.Props)}>
      <Select.ItemIndicator class="SelectItemIndicator" render={() => <ThickCheckIcon />} />
      <Select.ItemText class="SelectItemText">{local.children}</Select.ItemText>
    </Select.Item>
  )
}
