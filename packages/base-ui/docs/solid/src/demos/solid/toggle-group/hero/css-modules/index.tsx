import type { JSX } from '@solidjs/web';

import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import styles from './index.module.css';

export default function ExampleToggleGroup() {
  return (
    <ToggleGroup aria-label="Text alignment" defaultValue={['left']} class={styles.Panel}>
      <Toggle aria-label="Align left" value="left" class={styles.Button}>
        <AlignLeftIcon />
      </Toggle>
      <Toggle aria-label="Align center" value="center" class={styles.Button}>
        <AlignCenterIcon />
      </Toggle>
      <Toggle aria-label="Align right" value="right" class={styles.Button}>
        <AlignRightIcon />
      </Toggle>
    </ToggleGroup>
  );
}

function AlignLeftIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path strokeLinecap="square" strokeLinejoin="round" d="M2.5 4.5h11m-11 7h9M2.5 8h5" />
    </svg>
  );
}

function AlignCenterIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path strokeLinecap="square" strokeLinejoin="round" d="M2.5 4.5h11m-10 7h9M5.5 8h5" />
    </svg>
  );
}

function AlignRightIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path strokeLinecap="square" strokeLinejoin="round" d="M2.5 4.5h11m-9 7h9M8.5 8h5" />
    </svg>
  );
}
