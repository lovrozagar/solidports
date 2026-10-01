import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
	SelectGroup,
	SelectGroupLabel,
	SelectSeparator,
} from "@solidports/flare-ui/select";
import { Label } from "@solidports/flare-ui/label";

export default function SelectRoute() {
	return (
		<Select id="fruit">
			<Label id="fruit-label" class="mb-2 block">
				Fruit
			</Label>
			<SelectTrigger class="w-[180px]">
				<SelectValue placeholder="Select a fruit" />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectGroupLabel>Fruits</SelectGroupLabel>
					<SelectItem value="apple">Apple</SelectItem>
					<SelectItem value="banana">Banana</SelectItem>
					<SelectItem value="cherry">Cherry</SelectItem>
				</SelectGroup>
				<SelectSeparator />
				<SelectGroup>
					<SelectGroupLabel>Vegetables</SelectGroupLabel>
					<SelectItem value="carrot">Carrot</SelectItem>
					<SelectItem value="broccoli">Broccoli</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
