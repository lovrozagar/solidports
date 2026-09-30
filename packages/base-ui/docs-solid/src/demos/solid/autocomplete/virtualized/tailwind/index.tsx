import type { JSX } from "solid-js";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { Autocomplete } from "@solidports/base-ui/autocomplete";
import { type Virtualizer, createVirtualizer } from "@tanstack/solid-virtual";

type VirtualizerInstance = Virtualizer<HTMLDivElement, Element>;

export default function ExampleVirtualizedAutocomplete() {
  const [open, setOpen] = createSignal(false);
  let virtualizerRef: VirtualizerInstance | null = null;

  return (
    <Autocomplete.Root
      virtualized
      items={virtualizedItems}
      open={open()}
      onOpenChange={setOpen}
      openOnInputClick
      itemToStringValue={getItemLabel}
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
      <label class="flex flex-col gap-1 text-sm leading-5 font-medium text-gray-900">
        Search 10,000 items
        <Autocomplete.Input class="bg-[canvas] h-10 w-[16rem] md:w-[20rem] font-normal rounded-md border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800" />
      </label>

      <Autocomplete.Portal>
        <Autocomplete.Positioner class="outline-none" sideOffset={4}>
          <Autocomplete.Popup class="w-[var(--anchor-width)] max-h-[min(22rem,var(--available-height))] max-w-[var(--available-width)] rounded-md bg-[canvas] text-gray-900 outline-1 outline-gray-200 shadow-lg shadow-gray-200 dark:-outline-offset-1 dark:outline-gray-300">
            <Autocomplete.Empty class="px-4 py-4 text-[0.925rem] leading-4 text-gray-600 empty:m-0 empty:p-0">
              No items found.
            </Autocomplete.Empty>
            <Autocomplete.List class="p-0">
              <VirtualizedList
                open={open}
                onVirtualizerReady={(v) => {
                  virtualizerRef = v;
                }}
              />
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function VirtualizedList(props: {
  open: () => boolean;
  onVirtualizerReady: (virtualizer: VirtualizerInstance) => void;
}) {
  const filteredItems = Autocomplete.useFilteredItems<VirtualizedItem>();

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

  /* `_willUpdate` attaches the resize observer; lib only auto-calls it once at mount.
   * Re-trigger when scroll element appears so observer reads real rect, range computes non-empty. */
  createEffect(() => {
    if (scrollEl()) {
      (virtualizer as unknown as { _willUpdate: () => void })._willUpdate();
      virtualizer.measure();
    }
  });

  /* Reset scroll + recalc range when filtered set changes; otherwise stale offset can land
   * outside the new totalSize, leaving the visible window empty. */
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
        class="h-[min(22rem,var(--total-size))] max-h-[var(--available-height)] overflow-auto overscroll-contain scroll-p-2"
        style={{ "--total-size": `${virtualizer.getTotalSize()}px` } as JSX.CSSProperties}
      >
          <div
            role="presentation"
            class="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            <For each={virtualizer.getVirtualItems()}>
              {(virtualItem) => {
                const item = filteredItems()[virtualItem.index];
                if (!item) {
                  return null;
                }

                return (
                  <Autocomplete.Item
                    index={virtualItem.index}
                    data-index={virtualItem.index}
                    ref={(el) => virtualizer.measureElement(el ?? null)}
                    value={item}
                    class="flex cursor-default py-2 pr-8 pl-4 text-base leading-4 outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-gray-50 data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-2 data-[highlighted]:before:inset-y-0 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded data-[highlighted]:before:bg-gray-900"
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
                    {item.name}
                  </Autocomplete.Item>
                );
              }}
            </For>
        </div>
      </div>
    </Show>
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
