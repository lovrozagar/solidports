import { For, Show } from "solid-js"
import { A } from "@solidjs/router"
import { releases } from "../../data/releases"
import "./ReleaseTimeline.css"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function ReleaseTimeline() {
  return (
    <ul class="ReleaseTimeline" aria-label="Release timeline">
      <div class="TimelineSpine" />
      <For each={releases}>
        {(release) => (
          <li class="TimelineItem">
            <article class="TimelineCard">
              <div class="TimelineCardHeader">
                <time class="TimelineDate" datetime={release.date}>
                  {dateFormatter.format(new Date(release.date))}
                </time>
                <h3 class="TimelineVersion">
                  <A
                    class="TimelineVersionLink"
                    href={`/solid/overview/releases/${release.versionSlug}`}
                  >
                    {release.version}
                  </A>
                  <Show when={release.latest}>
                    <span class="TimelineBadge">Latest</span>
                  </Show>
                </h3>
              </div>
              <ul class="TimelineHighlights">
                <For each={release.highlights}>{(highlight) => <li>{highlight}</li>}</For>
              </ul>
            </article>
          </li>
        )}
      </For>
    </ul>
  )
}
