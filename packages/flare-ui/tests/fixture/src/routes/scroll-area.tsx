import { ScrollArea } from "@solidports/flare-ui/scroll-area";

export default function ScrollAreaRoute() {
	return (
		<div class="p-8">
			<ScrollArea class="h-48 w-64 rounded-md border">
				<div class="p-4">
					<p class="text-sm font-medium">Items</p>
					{Array.from({ length: 20 }, (_, i) => (
						<p class="py-1 text-sm">Item {i + 1}</p>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
