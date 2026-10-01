import {
	OTPField,
	OTPFieldInput,
	OTPFieldGroup,
	OTPFieldSlot,
	OTPFieldSeparator,
} from "@solidports/flare-ui/otp-field";

export default function OTPFieldRoute() {
	return (
		<div class="flex flex-col gap-4">
			<label class="text-sm font-medium" for="otp-0">
				One-time password
			</label>
			<OTPField length={6}>
				<OTPFieldGroup>
					<OTPFieldInput id="otp-0" />
					<OTPFieldSlot aria-label="Digit 2" />
					<OTPFieldSlot aria-label="Digit 3" />
				</OTPFieldGroup>
				<OTPFieldSeparator />
				<OTPFieldGroup>
					<OTPFieldSlot aria-label="Digit 4" />
					<OTPFieldSlot aria-label="Digit 5" />
					<OTPFieldSlot aria-label="Digit 6" />
				</OTPFieldGroup>
			</OTPField>
		</div>
	);
}
