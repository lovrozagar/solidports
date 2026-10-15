import type { JSX } from '@solidjs/web';
import { Tabs } from '@solidports/base-ui/tabs';

export function PackageManagerSnippetCode(props: PackageManagerSnippetCode.Props) {
  return <Tabs.Panel value={props.value}>{props.children}</Tabs.Panel>;
}
export namespace PackageManagerSnippetCode {
  export type Props = {
    children: JSX.Element;
    value: string;
  };
}
