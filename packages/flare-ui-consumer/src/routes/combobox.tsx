import { createSignal } from "solid-js";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxInputGroup,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxLabel,
	ComboboxTrigger,
} from "@solidports/flare-ui/combobox";

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

export default function ComboboxRoute() {
	return (
		<div class="p-8">
			<Combobox>
				<ComboboxLabel class="mb-2">Fruit</ComboboxLabel>
				<ComboboxInputGroup>
					<ComboboxInput placeholder="Search fruit..." />
					<ComboboxTrigger />
				</ComboboxInputGroup>
				<ComboboxContent>
					{fruits.map((f) => (
						<ComboboxItem value={f}>
							<ComboboxItemIndicator />
							{f}
						</ComboboxItem>
					))}
					<ComboboxEmpty>No results.</ComboboxEmpty>
				</ComboboxContent>
			</Combobox>
		</div>
	);
}
