// The document shell: the Next root layouts render `<html>`, `<head>` and `<body>` themselves.
import type { ParentProps } from 'solid-js';

export default function Document(props: ParentProps) {
  return props.children;
}
