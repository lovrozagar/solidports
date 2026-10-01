import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogClose,
} from "@solidports/flare-ui/dialog";
import { Button } from "@solidports/flare-ui/button";
import { buttonRender } from "../element-render.tsx";

export default function DialogRoute() {
	return (
		<Dialog>
			<DialogTrigger render={buttonRender("Open dialog")} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Dialog title</DialogTitle>
					<DialogDescription>Dialog description goes here.</DialogDescription>
				</DialogHeader>
				<p>Dialog body content.</p>
				<DialogFooter>
					<DialogClose render={buttonRender("Cancel", { variant: "outline" })} />
					<Button>Confirm</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
