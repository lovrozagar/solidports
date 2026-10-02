import { OTPField as BaseOTPField } from "@solidports/base-ui/otp-field";
import { For } from "solid-js";
import type { JSX } from "@solidjs/web";
import { mergeClass } from "./utils/merge-class.ts";
import { cn } from "./utils/cn.ts";
import { Minus } from "./icons/minus.tsx";
import { splitProps } from "./utils/solid-1-compat";

export const OTPField = BaseOTPField.Root;

export type OTPFieldInputProps = BaseOTPField.Input.Props;

/**
 * One OTP slot. Renders a bordered text-centered <input>. Each `OTPField`
 * needs `length` of these. Matches Base UI's per-character Input contract.
 */
export function OTPFieldInput(props: OTPFieldInputProps) {
	return (
		<BaseOTPField.Input
			{...props}
			class={mergeClass(
				"relative flex size-10 items-center justify-center border-y border-r border-input text-center text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md focus:z-10 focus:ring focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
		/>
	);
}

export type OTPFieldGroupProps = JSX.HTMLAttributes<HTMLDivElement>;

export function OTPFieldGroup(props: OTPFieldGroupProps) {
	return <div {...props} class={cn("flex items-center", props.class)} />;
}

/** Slot is an alias for Input — kept for API symmetry with React Base UI. */
export const OTPFieldSlot = OTPFieldInput;

export type OTPFieldSlotsProps = JSX.HTMLAttributes<HTMLDivElement> & {
	length: number;
};

/** Convenience: renders `length` OTPFieldInputs inside an OTPFieldGroup. */
export function OTPFieldSlots(props: OTPFieldSlotsProps) {
	const [local, rest] = splitProps(props, ["class", "length"]);
	return (
		<OTPFieldGroup {...rest} class={local.class}>
			<For each={Array.from({ length: local.length }, (_, index) => index)}>
				{(index) => <OTPFieldInput aria-label={index === 0 ? undefined : `Digit ${index + 1}`} />}
			</For>
		</OTPFieldGroup>
	);
}

export type OTPFieldSeparatorProps = JSX.HTMLAttributes<HTMLSpanElement>;

export function OTPFieldSeparator(props: OTPFieldSeparatorProps) {
	return (
		<span {...props} class={cn("flex items-center", props.class)}>
			<Minus class="size-4" />
		</span>
	);
}
