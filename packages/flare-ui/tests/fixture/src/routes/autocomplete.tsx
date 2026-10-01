import { For } from "solid-js";
import {
	Autocomplete,
	AutocompleteInput,
	AutocompleteContent,
	AutocompleteItem,
	AutocompleteEmpty,
} from "@solidports/flare-ui/autocomplete";

const options = ["React", "Solid", "Vue", "Svelte", "Angular"];

export default function AutocompleteRoute() {
	return (
		<Autocomplete>
			<AutocompleteInput placeholder="Search framework..." aria-label="Search framework" />
			<AutocompleteContent>
				<For each={options}>{(opt) => <AutocompleteItem value={opt}>{opt}</AutocompleteItem>}</For>
				<AutocompleteEmpty>No results.</AutocompleteEmpty>
			</AutocompleteContent>
		</Autocomplete>
	);
}
