import {
  createContext,
  createMemo,
  createSignal,
  createUniqueId,
  omit,
  useContext,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import copy from 'clipboard-copy';
import clsx from 'clsx';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import * as ScrollArea from '../ScrollArea';
import { CopyIcon } from '../../icons/CopyIcon';
import { CheckIcon } from '../../icons/CheckIcon';
import { GhostButton } from '../GhostButton';
import './CodeBlock.css';

const CodeBlockContext = createContext<
  Accessor<{
    codeId: string | undefined;
    titleId: string | undefined;
  }>
>(() => ({
  codeId: undefined,
  titleId: undefined,
}));
export function Root(props: ReactProps<ComponentProps<'figure'>>) {
  const titleId = createUniqueId();
  const codeId = createUniqueId();
  const context = createMemo(() => ({
    codeId,
    titleId,
  }));
  return (
    <CodeBlockContext value={context}>
      <figure aria-labelledby={titleId} {...props} class={clsx('CodeBlockRoot', props.class)} />
    </CodeBlockContext>
  );
}
interface CodeBlockPanelProps extends ReactProps<ComponentProps<'div'>> {
  /** When provided, renders as a separate sr-only label instead of wrapping children. */
  title?: string;
}
export function Panel(props: CodeBlockPanelProps) {
  const rest = omit(props, 'class', 'title', 'children');
  const _useContext = useContext(CodeBlockContext);
  const _useContext2 = createMemo(() => {
    const { codeId, titleId } = _useContext();
    return {
      codeId,
      titleId,
    };
  });
  const [copyTimeout, setCopyTimeout] = createSignal<number>(0);
  const ga = useGoogleAnalytics();
  const pathname = usePathname();
  return (
    <div class={clsx('CodeBlockPanel', props.class)} {...rest}>
      {props.title != null ? (
        <>
          <span id={_useContext2().titleId} class="sr-only">
            {props.title}
          </span>
          {props.children}
        </>
      ) : (
        <div id={_useContext2().titleId} class="CodeBlockPanelTitle">
          {props.children}
        </div>
      )}
      <GhostButton
        aria-label="Copy code"
        layout="icon" // eslint-disable-next-line solid/reactivity -- an event handler (eslint-plugin-solid#168)
        onClick={async () => {
          const _codeId = _useContext2().codeId;
          const codeRoot = _codeId ? document.getElementById(_codeId) : null;
          const code = codeRoot?.querySelector('pre code')?.textContent ?? codeRoot?.textContent;
          const _titleId = _useContext2().titleId;
          const _pathname = pathname();
          if (code) {
            await copy(code);
            const titleText =
              (_titleId ? document.getElementById(_titleId)?.textContent : undefined) ?? undefined;
            const codeBlockId = titleText ? `${_pathname}#${titleText}` : _pathname;
            ga()?.trackEvent({
              category: 'code_block',
              action: 'copy',
              label: codeBlockId,
              params: {
                copy: codeBlockId,
                slug: titleText || '',
              },
            });
            /* eslint-disable no-restricted-syntax */
            const newTimeout = window.setTimeout(() => {
              window.clearTimeout(newTimeout);
              setCopyTimeout(0);
            }, 2000);
            window.clearTimeout(copyTimeout());
            setCopyTimeout(newTimeout);
            /* eslint-enable no-restricted-syntax */
          }
        }}
      >
        <span class="CodeBlockCopyIcon">{copyTimeout() ? <CheckIcon /> : <CopyIcon />}</span>
      </GhostButton>
    </div>
  );
}
export function Content(props: ReactProps<ComponentProps<typeof ScrollArea.Root>>) {
  const rest = omit(props, 'class', 'children', 'onKeyDown');
  const _useContext3 = useContext(CodeBlockContext);
  const _useContext4 = createMemo(() => {
    const { codeId } = _useContext3();
    return {
      codeId,
    };
  });
  return (
    <ScrollArea.Root
      tabindex={-1}
      class={clsx('CodeBlockPreContainer', props.class)}
      {...rest}
      id={_useContext4().codeId}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          String.fromCharCode(event.keyCode) === 'A' &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.getSelection()?.selectAllChildren(event.currentTarget);
        }
      }}
    >
      <ScrollArea.Viewport class="CodeBlockViewport">{props.children}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal" />
    </ScrollArea.Root>
  );
}
export function PreInline(props: ReactProps<ComponentProps<'pre'>>) {
  return (
    <Content>
      <pre {...props} class={clsx('CodeBlockPreInline', props.class)} />
    </Content>
  );
}
export function Pre(props: ReactProps<ComponentProps<'pre'>>) {
  return <PreInline {...props} class="CodeBlockPre" />;
}

/**
 * Inline `pre` for short type signatures rendered inside phrasing content (the
 * reference table trigger is a `<button>`, so it can't contain a block
 * `<pre>`/scroll-area). The highlighted type already includes a `<code>`, so
 * this only supplies the inline wrapper and code styling; horizontal overflow
 * is handled by the enclosing `Accordion.Scrollable`.
 */
export function TypeInline(props: ReactProps<ComponentProps<'span'>>) {
  const rest = omit(props, 'class');
  return <span {...rest} class={clsx('Code TableCode', props.class)} />;
}
