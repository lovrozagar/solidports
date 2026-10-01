import { createSignal, type JSX } from 'solid-js';


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

  const portalMounted = open() || mounted;

  // Once the trigger has been interacted with, the popup will always be
  // mounted in the DOM. We can use this to determine which animation variant
  // to use: if it's already mounted, we switch to use "keepMounted" animations.
  const motionElement = mounted() ? (
    <div />
  ) : (
    <div />
  );

  return (
    <Select.Root items={fonts} open={open()} onOpenChange={setOpen}>
      <Select.Trigger class={styles.Select}>
        <Select.Value class={styles.Value} />
        <Select.Icon>
          <CaretUpDownIcon />
        </Select.Icon>
      </Select.Trigger>
      
        {portalMounted && (
          <Select.Portal>
            <Select.Positioner class={styles.Positioner} sideOffset={4} ref={positionerRef}>
              <Select.Popup class={styles.Popup} render={motionElement}>
                <Select.ScrollUpArrow class={styles.ScrollArrow} />
                <Select.List class={styles.List}>
                  {fonts.map(({ label, value }) => (
                    <Select.Item key={label} value={value} class={styles.Item}>
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
        )}
      
    </Select.Root>
  );
}

function CaretUpDownIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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

function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
