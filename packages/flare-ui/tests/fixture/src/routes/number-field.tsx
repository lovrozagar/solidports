import {
	NumberField,
	NumberFieldGroup,
	NumberFieldInput,
	NumberFieldDecrement,
	NumberFieldIncrement,
} from "@solidports/flare-ui/number-field";

export default function NumberFieldRoute() {
	return (
		<div class="flex flex-col gap-4 max-w-xs">
			<NumberField defaultValue={0}>
				<NumberFieldGroup>
					<NumberFieldDecrement />
					<NumberFieldInput aria-label="Quantity" />
					<NumberFieldIncrement />
				</NumberFieldGroup>
			</NumberField>
			<NumberField defaultValue={5} min={0} max={10} disabled>
				<NumberFieldGroup>
					<NumberFieldDecrement />
					<NumberFieldInput aria-label="Disabled quantity" />
					<NumberFieldIncrement />
				</NumberFieldGroup>
			</NumberField>
		</div>
	);
}
