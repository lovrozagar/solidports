import { SearchBar } from "./SearchBar"

export interface SearchProps {
  enableKeyboardShortcut?: boolean
  containedScroll?: boolean
}

export function Search(props: SearchProps) {
  return (
    <SearchBar
      enableKeyboardShortcut={props.enableKeyboardShortcut}
      containedScroll={props.containedScroll}
    />
  )
}
