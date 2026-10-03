import { For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Code } from '../Code';
import { releases } from '../../data/releases';
import './ReleaseTimeline.css';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function renderHighlight(text: string): JSX.Element {
  const parts = text.split(/`([^`]+)`/);
  return parts.length === 1
    ? text
    : parts.map((part, i) => (i % 2 === 1 ? <Code>{part}</Code> : part));
}

export function ReleaseTimeline() {
  return (
    <ul class="ReleaseTimeline" aria-label="Release timeline">
      <For each={releases}>
        {(release) => (
          <li class="TimelineItem">
            <article class="TimelineCard">
              <div class="TimelineCardHeader">
                <time class="TimelineDate" datetime={release.date}>
                  {dateFormatter.format(new Date(release.date))}
                </time>
                <h2 class="TimelineVersion">
                  <a
                    class="TimelineVersionLink"
                    href={`/solid/overview/releases/${release.versionSlug}`}
                  >
                    {release.version}
                  </a>
                  <Show when={release.latest}>
                    <span class="TimelineBadge">Latest</span>
                  </Show>
                </h2>
              </div>
              <ul class="TimelineHighlights">
                <For each={release.highlights}>
                  {(highlight) => <li>{renderHighlight(highlight)}</li>}
                </For>
              </ul>
            </article>
          </li>
        )}
      </For>
    </ul>
  );
}
