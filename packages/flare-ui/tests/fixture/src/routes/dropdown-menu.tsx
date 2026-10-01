import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
} from "@solidports/flare-ui/dropdown-menu";
import { buttonRender } from "../element-render.tsx";

export default function DropdownMenuRoute() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={buttonRender("Open menu", { variant: "outline" })} />
			<DropdownMenuContent>
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem>
					Billing <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					Log out <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
