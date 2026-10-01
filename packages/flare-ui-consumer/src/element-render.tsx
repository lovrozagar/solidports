import type { JSX } from "solid-js";
import { Button, type ButtonProps } from "@solidports/flare-ui/button";

type TriggerProps = JSX.HTMLAttributes<HTMLButtonElement>;

/** 1.8 `render` is a function (or tag). JSX elements are not cloned. */
export function buttonRender(label: string, buttonProps?: Omit<ButtonProps, "children">) {
	return (props: TriggerProps) => (
		<Button {...buttonProps} {...props}>
			{label}
		</Button>
	);
}
