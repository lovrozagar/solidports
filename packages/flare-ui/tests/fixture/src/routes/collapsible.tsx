import { createSignal } from "solid-js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@solidports/flare-ui/collapsible";
import { buttonRender } from "../element-render.tsx";

export default function CollapsibleRoute() {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="p-8 max-w-sm">
			<Collapsible open={open()} onOpenChange={setOpen}>
				<CollapsibleTrigger render={buttonRender("Toggle", { variant: "outline" })} />
				<CollapsibleContent>
					<p class="py-2 text-sm">Hidden item 1</p>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
