import { Popover, PopoverTrigger, PopoverContent } from "@solidports/flare-ui/popover";
import { buttonRender } from "../element-render.tsx";

export default function PopoverRoute() {
	return (
		<Popover>
			<PopoverTrigger render={buttonRender("Open popover", { variant: "outline" })} />
			<PopoverContent>
				<p class="text-sm">Popover content here.</p>
			</PopoverContent>
		</Popover>
	);
}
