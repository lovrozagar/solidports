import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@solidports/flare-ui/tooltip";
import { buttonRender } from "../element-render.tsx";

export default function TooltipRoute() {
	return (
		<TooltipProvider delay={0}>
			<Tooltip>
				<TooltipTrigger render={buttonRender("Hover me", { variant: "outline" })} />
				<TooltipContent>Tooltip text</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
