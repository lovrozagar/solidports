import { captureRef, element, place } from 'docs/src/adapters/react';
import { createMemo, createSignal, For, omit, onSettled, Show } from 'solid-js';
import * as ReactDOM from 'docs/src/adapters/react-dom';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import * as Menu from 'docs/src/components/Menu';
import { usePathname } from 'docs/src/adapters/next/navigation';
import type { ContentProps } from '@mui/internal-docs-infra/CodeHighlighter/types';
import { useDemo } from '@mui/internal-docs-infra/useDemo';
import { CopyIcon } from 'docs/src/icons/CopyIcon';
import copy from 'clipboard-copy';
import clsx from 'clsx';
import kebabCase from 'es-toolkit/compat/kebabCase';
import { CheckIcon } from 'docs/src/icons/CheckIcon';
import { ExternalLinkIcon } from 'docs/src/icons/ExternalLinkIcon';
import { GitHubIcon } from 'docs/src/icons/GitHubIcon';
import { MoreVertIcon } from 'docs/src/icons/MoreVertIcon';
import { exportCodeSandbox, exportOpts } from 'docs/src/utils/demoExportOptions';
import { getGitHubDemoUrl } from 'docs/src/utils/getGitHubDemoUrl';
import { platform } from '@base-ui/utils/platform';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { ownerWindow } from '@base-ui/utils/owner';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { DemoVariantSelector } from './DemoVariantSelector';
import { DemoFileSelector } from './DemoFileSelector';
import { DemoCodeBlock } from './DemoCodeBlock';
import { GhostButton } from '../GhostButton';
import { DemoPlayground } from './DemoPlayground';
import './Demo.css';

export type DemoProps = ContentProps<{
  class?: string;
}>;
export function Demo(props: DemoProps) {
  const rest = omit(props, 'class');
  const collapsibleTriggerRef: {
    current: HTMLSpanElement | null;
  } = {
    current: null,
  };
  const [copyTimeout, setCopyTimeout] = createSignal<number>(0);
  const [sourceLinkCopied, setSourceLinkCopied] = createSignal(false);
  const sourceLinkCopyResetTimeout = useTimeout();
  const ga = useGoogleAnalytics();
  const pathname = usePathname();
  const demoSlug = createMemo(() => rest.slug || (rest.name ? kebabCase(rest.name) : undefined));
  const demoId = createMemo(() => {
    const _demoSlug = demoSlug();
    const _pathname = pathname();
    return _demoSlug ? `${_pathname}#${_demoSlug}` : _pathname;
  });
  const hasLoggedInteraction = {
    current: false,
  };
  const onPlaygroundInteraction = () => {
    const _demoId = demoId();
    if (!hasLoggedInteraction.current) {
      hasLoggedInteraction.current = true;
      ga()?.trackEvent({
        category: 'demo',
        action: 'interaction',
        label: _demoId,
        params: {
          interaction: _demoId,
          slug: demoSlug() || '',
        },
      });
    }
  };
  const onCopied = () => {
    const _demoId2 = demoId();
    ga()?.trackEvent({
      category: 'demo',
      action: 'copy',
      label: _demoId2,
      params: {
        copy: _demoId2,
        slug: demoSlug() || '',
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
  };
  const demo = useDemo(
    () => rest,
    () => ({
      copy: {
        onCopied,
      },
      export: exportOpts,
      exportCodeSandbox,
    }),
  );
  const githubUrl = createMemo(() => getGitHubDemoUrl(rest.url, demo().selectedVariant));
  const onViewSource = () => {
    const _demoId3 = demoId();
    ga()?.trackEvent({
      category: 'demo',
      action: 'open_github',
      label: _demoId3,
      params: {
        github: _demoId3,
        slug: demoSlug() || '',
      },
    });
  };
  const onCopySourceLink = async () => {
    const _githubUrl = githubUrl();
    if (!_githubUrl) {
      return;
    }
    await copy(_githubUrl);
    setSourceLinkCopied(true);
    const _demoId4 = demoId();
    ga()?.trackEvent({
      category: 'demo',
      action: 'copy_source_link',
      label: _demoId4,
      params: {
        copy_source_link: _demoId4,
        slug: demoSlug() || '',
      },
    });
    sourceLinkCopyResetTimeout().start(2000, () => setSourceLinkCopied(false));
  };
  const onOpenChange = (nextOpen: boolean) => {
    const action = nextOpen ? 'expand' : 'collapse';
    const _demoId5 = demoId();
    ga()?.trackEvent({
      category: 'demo',
      action,
      label: _demoId5,
      params: {
        [action]: _demoId5,
        slug: demoSlug() || '',
      },
    });
    if (!nextOpen && collapsibleTriggerRef.current != null) {
      const buttonVisualEl = collapsibleTriggerRef.current;
      const rectTopBeforeClose = buttonVisualEl.getBoundingClientRect().top;
      ReactDOM.flushSync(() => demo().setExpanded(nextOpen));
      const rectTopAfterClose = buttonVisualEl.getBoundingClientRect().top;
      const delta = rectTopAfterClose - rectTopBeforeClose;
      // Don't scroll if the collapse button is still in the viewport after closing.
      if (rectTopAfterClose < 0) {
        ownerWindow(buttonVisualEl).scrollBy({
          top: delta,
          behavior: 'instant',
        });
      }
      return;
    }
    demo().setExpanded(nextOpen);
  };
  const onSelectFile = (fileName: string) => {
    ga()?.trackEvent({
      category: 'demo',
      action: 'file_select',
      label: demoId(),
      params: {
        file_select: fileName,
        slug: demoSlug() || '',
      },
    });
    demo().selectFileName(fileName);
  };
  const [fallbackToCodeSandbox, setFallbackToCodeSandbox] = createSignal(false);
  onSettled(() => {
    if (platform.engine.webkit) {
      setFallbackToCodeSandbox(true);
    }
  });
  const externalPlaygroundLink = createMemo(() =>
    fallbackToCodeSandbox()
      ? element(() => (
          <GhostButton
            aria-label="Open in CodeSandbox"
            type="button"
            onClick={demo().openCodeSandbox}
          >
            CodeSandbox
            <ExternalLinkIcon />
          </GhostButton>
        ))
      : element(() => (
          <GhostButton
            aria-label="Open in StackBlitz"
            type="button"
            onClick={demo().openStackBlitz}
          >
            StackBlitz
            <ExternalLinkIcon />
          </GhostButton>
        )),
  );
  const toolbarActions = element(() => (
    <>
      {demo().variants.length > 1 && (
        <DemoVariantSelector
          onVariantChange={demo().expand}
          variants={demo().variants}
          selectedVariant={demo().selectedVariant}
          selectVariant={demo().selectVariant as any}
        />
      )}
      {place(externalPlaygroundLink())}
      <Show when={githubUrl()}>
        {(_githubUrl2) => (
          <Menu.Root>
            <Menu.Trigger
              render={{
                component: GhostButton,
                layout: 'icon',
                'aria-label': 'More actions',
                get children() {
                  return <MoreVertIcon aria-hidden="true" />;
                },
              }}
            />
            <Menu.Popup align="end" alignOffset={-5}>
              <Menu.LinkItem
                href={_githubUrl2()}
                target="_blank"
                rel="noopener"
                onClick={onViewSource}
              >
                <GitHubIcon aria-hidden="true" />
                View source on GitHub
                <ExternalLinkIcon aria-hidden="true" />
              </Menu.LinkItem>

              <Menu.Item closeOnClick={false} onClick={onCopySourceLink}>
                {sourceLinkCopied() ? (
                  <CheckIcon aria-hidden="true" />
                ) : (
                  <CopyIcon aria-hidden="true" />
                )}
                Copy link to source
                <span class="sr-only" aria-live="polite">
                  {sourceLinkCopied() && 'Link copied!'}
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Root>
        )}
      </Show>
    </>
  ));
  return (
    <div class={clsx('DemoRoot', props.class)}>
      <For each={demo().allFilesSlugs}>
        {({ slug }) => <span id={slug} class="bui-scroll-mt-4" />}
      </For>
      <div
        onPointerDown={onPlaygroundInteraction}
        ref={captureRef(undefined, {
          keydown: onPlaygroundInteraction,
        })}
      >
        <DemoPlayground component={demo().component} variant={demo().selectedVariant} />
      </div>
      <Collapsible.Root
        class="DemoCollapsibleRoot"
        open={demo().expanded}
        onOpenChange={onOpenChange}
      >
        <figure aria-label="Component demo code">
          <div class="DemoToolbar">
            {/* One ScrollArea drives the edge-fade indicators at every viewport.
                Below --sm the actions sit inside it (they scroll with the tabs);
                at --sm+ the in-scroll copy is hidden and the sticky copy outside
                takes over. Both copies stay mounted so state survives a resize. */}
            <ScrollArea.Root class="DemoToolbarScrollAreaRoot">
              <ScrollArea.Viewport class="DemoToolbarViewport">
                <DemoFileSelector
                  files={demo().files}
                  selectedFileName={demo().selectedFileName}
                  selectFileName={onSelectFile}
                  onTabChange={demo().expand}
                />
                <div class="DemoToolbarActions DemoToolbarActionsMobile">
                  {place(toolbarActions)}
                </div>
              </ScrollArea.Viewport>
            </ScrollArea.Root>

            <div class="DemoToolbarActions DemoToolbarActionsDesktop">{place(toolbarActions)}</div>
          </div>

          <DemoCodeBlock
            selectedFile={demo().selectedFile}
            selectedFileLines={demo().selectedFileLines}
            collapsibleOpen={demo().expanded}
            collapsibleTriggerRef={collapsibleTriggerRef}
            copyButton={element(() => (
              <GhostButton
                layout="icon"
                aria-label="Copy code"
                onClick={demo().copy}
                class="DemoCodeBlockCopyButton"
              >
                {copyTimeout() ? <CheckIcon /> : <CopyIcon />}
              </GhostButton>
            ))}
          />
        </figure>
      </Collapsible.Root>
    </div>
  );
}
