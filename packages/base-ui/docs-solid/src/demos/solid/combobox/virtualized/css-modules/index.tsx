import type { JSX } from "solid-js";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { Combobox } from "@solidports/base-ui/combobox";
import { type Virtualizer, createVirtualizer } from "@tanstack/solid-virtual";
import styles from "./index.module.css";

type VirtualizerInstance = Virtualizer<HTMLDivElement, Element>;

export default function ExampleVirtualizedCombobox() {
  const [open, setOpen] = createSignal(false);
  let virtualizerRef: VirtualizerInstance | null = null;

  return (
    <Combobox.Root
      virtualized
      items={virtualizedItems}
      open={open()}
      onOpenChange={setOpen}
      itemToStringLabel={getItemLabel}
      onItemHighlighted={(item, { reason, index }) => {
        const virtualizer = virtualizerRef;

        if (!item || !virtualizer) {
          return;
        }

        const isStart = index === 0;
        const isEnd = index === virtualizer.options.count - 1;
        const shouldScroll = reason === "none" || (reason === "keyboard" && (isStart || isEnd));

        if (shouldScroll) {
          queueMicrotask(() => {
            virtualizer.scrollToIndex(index, { align: isEnd ? "start" : "end" });
          });
        }
      }}
    >
      <label class={styles.Label}>
        Search 10,000 items
        <Combobox.Input class={styles.Input} />
      </label>

      <Combobox.Portal>
        <Combobox.Positioner class={styles.Positioner} sideOffset={4}>
          <Combobox.Popup class={styles.Popup}>
            <Combobox.Empty class={styles.Empty}>No items found.</Combobox.Empty>
            <Combobox.List class={styles.List}>
              <VirtualizedList
                open={open}
                onVirtualizerReady={(v) => {
                  virtualizerRef = v;
                }}
              />
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function VirtualizedList(props: {
  open: () => boolean;
  onVirtualizerReady: (virtualizer: VirtualizerInstance) => void;
}) {
  const filteredItems = Combobox.useFilteredItems<VirtualizedItem>();

  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement | null>(null);

  const virtualizer = createVirtualizer<HTMLDivElement, Element>({
    get count() {
      return filteredItems().length;
    },
    getScrollElement: () => scrollEl(),
    estimateSize: () => 32,
    overscan: 20,
    paddingStart: 8,
    paddingEnd: 8,
    scrollPaddingEnd: 8,
    scrollPaddingStart: 8,
    useAnimationFrameWithResizeObserver: true,
  });

  /* `_willUpdate` is what attaches the resize observer; lib only auto-calls it once at mount.
   * Re-trigger when the scroll element appears (Solid's `<Show>` mounts the scroller after the
   * outer component) so the observer reads the real rect and the range computes non-empty. */
  createEffect(() => {
    if (scrollEl()) {
      (virtualizer as unknown as { _willUpdate: () => void })._willUpdate();
      virtualizer.measure();
    }
  });

  /* Reset scroll + recalc range when the filtered set changes; otherwise an old scroll offset
   * can land outside the new totalSize, leaving the visible window empty. */
  createEffect(() => {
    void filteredItems().length;
    const el = scrollEl();
    if (el) {
      el.scrollTop = 0;
      virtualizer.measure();
    }
  });

  onMount(() => props.onVirtualizerReady(virtualizer));

  return (
    <Show when={filteredItems().length > 0}>
      <div
        role="presentation"
        ref={setScrollEl}
        class={styles.Scroller}
        style={{ "--total-size": `${virtualizer.getTotalSize()}px` } as JSX.CSSProperties}
      >
        <div
          role="presentation"
          class={styles.VirtualizedPlaceholder}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {(virtualItem) => {
              const item = filteredItems()[virtualItem.index];
              if (!item) {
                return null;
              }

              return (
                <Combobox.Item
                  index={virtualItem.index}
                  data-index={virtualItem.index}
                  ref={(el) => virtualizer.measureElement(el ?? null)}
                  value={item}
                  class={styles.Item}
                  aria-setsize={filteredItems().length}
                  aria-posinset={virtualItem.index + 1}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <Combobox.ItemIndicator class={styles.ItemIndicator}>
                    <CheckIcon class={styles.ItemIndicatorIcon} />
                  </Combobox.ItemIndicator>
                  <div class={styles.ItemText}>{item.name}</div>
                </Combobox.Item>
              );
            }}
          </For>
        </div>
      </div>
    </Show>
  );
}

function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg fill="currentcolor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

interface VirtualizedItem {
  id: string;
  name: string;
}

function getItemLabel(item: VirtualizedItem | null) {
  return item ? item.name : "";
}

const virtualizedItems: VirtualizedItem[] = Array.from({ length: 10000 }, (_, index) => {
  const id = String(index + 1);
  const indexLabel = id.padStart(4, "0");
  return { id, name: `Item ${indexLabel}` };
});
