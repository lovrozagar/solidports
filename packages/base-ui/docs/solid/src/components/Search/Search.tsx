import { SearchBar } from "./SearchBar"

export interface SearchProps {
  enableKeyboardShortcut?: boolean
  containedScroll?: boolean
  desktopTriggerClass?: string
  mobileTriggerClass?: string
}

export function Search(props: SearchProps) {
  return (
    <SearchBar
      enableKeyboardShortcut={props.enableKeyboardShortcut}
      containedScroll={props.containedScroll}
      desktopTriggerClass={props.desktopTriggerClass}
      mobileTriggerClass={props.mobileTriggerClass}
    />
  )
}
