import { createEffect, createSignal, omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { animate, type DOMKeyframesDefinition } from 'motion';
import { Select } from '@solidports/base-ui/select';
import styles from './index.module.css';

const fonts = [
  { label: 'Select font', value: null },
  { label: 'Sans-serif', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'mono' },
  { label: 'Cursive', value: 'cursive' },
];

export default function AnimatedSelectMotionDemo() {
  const [open, setOpen] = createSignal(false);
  const [mounted, setMounted] = createSignal(false);

  const positionerRef = () => {
    setMounted(true);
  };

  // Once the trigger has been interacted with, the popup will always be
  // mounted in the DOM. It enters from `initial` the first time and then
  // animates between the open and closed styles while it stays mounted.
  return (
    <Select.Root items={fonts} open={open()} onOpenChange={setOpen}>
      <Select.Trigger class={styles.Select}>
        <Select.Value class={styles.Value} />
        <Select.Icon>
          <CaretUpDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <Show when={open() || mounted()}>
        <Select.Portal>
          <Select.Positioner class={styles.Positioner} sideOffset={4} ref={positionerRef}>
            <Select.Popup
              class={styles.Popup}
              render={(props) => (
                <MotionDiv
                  {...props}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: open() ? 1 : 0,
                    scale: open() ? 1 : 0.8,
                  }}
                />
              )}
            >
              <Select.ScrollUpArrow class={styles.ScrollArrow} />
              <Select.List class={styles.List}>
                {fonts.map(({ label, value }) => (
                  <Select.Item value={value} class={styles.Item}>
                    <Select.ItemIndicator class={styles.ItemIndicator}>
                      <CheckIcon />
                    </Select.ItemIndicator>
                    <Select.ItemText class={styles.ItemText}>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
              <Select.ScrollDownArrow class={styles.ScrollArrow} />
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Show>
    </Select.Root>
  );
}

interface MotionDivProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Styles to start from when mounted, or `false` to start at `animate`. */
  initial: DOMKeyframesDefinition | false;
  /** Styles to animate to whenever they change. */
  animate: DOMKeyframesDefinition;
}

/** A minimal `motion.div`: Motion's `animate()` moves the element toward `animate`. */
function MotionDiv(props: MotionDivProps) {
  const others = omit(props, 'initial', 'animate', 'ref');
  let element: HTMLDivElement | undefined;
  let animated = false;

  createEffect(
    () => ({ target: props.animate, instant: !animated && props.initial === false }),
    ({ target, instant }) => {
      animated = true;
      if (element) {
        animate(element, target, instant ? { duration: 0 } : undefined);
      }
    },
  );

  return (
    <div
      {...others}
      ref={[
        props.ref,
        (el: HTMLDivElement) => {
          element = el;
          if (props.initial) {
            animate(el, props.initial, { duration: 0 });
          }
        },
      ]}
    />
  );
}

function CaretUpDownIcon(
  props: Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'style'> & { style?: JSX.CSSProperties },
) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M11 10H5l3 3.5zm0-4H5l3-3.5z" />
    </svg>
  );
}

function CheckIcon(
  props: Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'style'> & { style?: JSX.CSSProperties },
) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
