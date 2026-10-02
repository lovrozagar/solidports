import type { JSX } from "@solidjs/web";

import { cn } from "./utils/cn.ts";
import { splitProps } from "./utils/solid-1-compat";

export type LabelProps = JSX.LabelHTMLAttributes<HTMLLabelElement>;

export function Label(props: LabelProps) {
	const [local, rest] = splitProps(props, ["class"]);
	return (
		<label
			{...rest}
			class={cn(
				"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
				local.class,
			)}
		/>
	);
}
