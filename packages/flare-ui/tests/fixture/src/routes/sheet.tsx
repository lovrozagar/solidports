import {
	Sheet,
	SheetTrigger,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@solidports/flare-ui/sheet";
import { buttonRender } from "../element-render.tsx";

export default function SheetRoute() {
	return (
		<div class="flex gap-4">
			<Sheet>
				<SheetTrigger render={buttonRender("Open right", { variant: "outline" })} />
				<SheetContent side="right">
					<SheetHeader>
						<SheetTitle>Settings</SheetTitle>
						<SheetDescription>Adjust your preferences.</SheetDescription>
					</SheetHeader>
					<p class="py-4">Sheet content here.</p>
				</SheetContent>
			</Sheet>
			<Sheet>
				<SheetTrigger render={buttonRender("Open bottom", { variant: "outline" })} />
				<SheetContent side="bottom">
					<SheetHeader>
						<SheetTitle>Filters</SheetTitle>
					</SheetHeader>
					<p class="py-4">Filter options here.</p>
				</SheetContent>
			</Sheet>
		</div>
	);
}
