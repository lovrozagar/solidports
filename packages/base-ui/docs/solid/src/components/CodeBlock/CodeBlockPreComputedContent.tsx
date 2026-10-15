import { createMemo } from 'solid-js';
import type { ContentProps } from '@mui/internal-docs-infra/CodeHighlighter/types';
import { useCode } from '@mui/internal-docs-infra/useCode';
import * as CodeBlock from './CodeBlock';

type CodeBlockPreComputedUserProps = {
  title?: string;
};
export function CodeBlockPreComputedContent(props: ContentProps<CodeBlockPreComputedUserProps>) {
  const code = useCode(
    () => props,
    () => ({
      preClassName: 'CodeBlockPreInline CodeBlockPre',
    }),
  );
  const title = createMemo(() => code().userProps.title);
  return (
    <>
      {title() ? <CodeBlock.Panel>{title()}</CodeBlock.Panel> : null}
      <CodeBlock.Content>{code().selectedFile}</CodeBlock.Content>
    </>
  );
}
