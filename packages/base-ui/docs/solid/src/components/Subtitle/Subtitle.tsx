import { merge, omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { MarkdownLink } from './MarkdownLink';
import { ViewSourceLink } from './ViewSourceLink';
import './Subtitle.css';

export function Subtitle(
  _props: ReactProps<ComponentProps<'p'>> & {
    skipLinks?: boolean;
  },
) {
  const props = merge(
    {
      skipLinks: false,
    },
    _props,
  );
  const rest = omit(props, 'class', 'skipLinks');
  return (
    <div class={clsx('Subtitle', props.class)}>
      <p {...rest} />
      {!props.skipLinks && (
        <div class="SubtitleLinks">
          <MarkdownLink />
          <ViewSourceLink />
        </div>
      )}
    </div>
  );
}
