import {
	Drawer,
	DrawerTrigger,
	DrawerContent,
	DrawerHandle,
	DrawerHeader,
	DrawerTitle,
	DrawerDescription,
	DrawerFooter,
	DrawerClose,
} from "@solidports/flare-ui/drawer";
import { Button } from "@solidports/flare-ui/button";
import { buttonRender } from "../element-render.tsx";

export default function DrawerRoute() {
	return (
		<Drawer>
			<DrawerTrigger render={buttonRender("Open drawer", { variant: "outline" })} />
			<DrawerContent>
				<DrawerHandle />
				<DrawerHeader>
					<DrawerTitle>Drawer title</DrawerTitle>
					<DrawerDescription>Drag to dismiss.</DrawerDescription>
				</DrawerHeader>
				<p class="p-4">Drawer content here.</p>
				<DrawerFooter>
					<Button>Submit</Button>
					<DrawerClose render={buttonRender("Cancel", { variant: "outline" })} />
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
