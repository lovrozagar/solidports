import type { JSX } from "solid-js";
import { useRender } from '@solidports/base-ui/use-render';
import { mergeProps } from '@solidports/base-ui/merge-props';
import styles from './index.module.css';

interface TextProps extends useRender.JSX.HTMLAttributes<HTMLElement> {}

function Text(props: TextProps) {
  const { render, ...otherProps } = props;

  const element = useRender({
    defaultTagName: 'p',
    render,
    props: mergeProps<'p'>({ class: styles.Text }, otherProps),
  });

  return element;
}

export default function ExampleText() {
  return (
    <div>
      <Text>Text component rendered as a paragraph tag</Text>
      <Text render={<strong />}>Text component rendered as a strong tag</Text>
    </div>
  );
}
