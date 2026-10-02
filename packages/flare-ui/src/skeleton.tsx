import type { JSX } from "@solidjs/web";

import { cn } from "./utils/cn.ts";
import { splitProps } from "./utils/solid-1-compat";

export type SkeletonProps = JSX.HTMLAttributes<HTMLDivElement>;

export function Skeleton(props: SkeletonProps) {
	const [local, rest] = splitProps(props, ["class"]);
	return <div {...rest} class={cn("animate-pulse rounded-md bg-muted", local.class)} />;
}
