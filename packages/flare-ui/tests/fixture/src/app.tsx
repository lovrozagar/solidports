import { createTrackedEffect } from "solid-js";
import type { ParentProps } from "solid-js";
import { createRouter, useSearchParams } from "@solidjs/router";
import { DirectionProvider } from "@solidports/base-ui/direction-provider";
import ButtonRoute from "./routes/button.tsx";
import BadgeRoute from "./routes/badge.tsx";
import LabelRoute from "./routes/label.tsx";
import SeparatorRoute from "./routes/separator.tsx";
import SkeletonRoute from "./routes/skeleton.tsx";
import SpinnerRoute from "./routes/spinner.tsx";
import AvatarRoute from "./routes/avatar.tsx";
import AlertRoute from "./routes/alert.tsx";
import CardRoute from "./routes/card.tsx";
import InputRoute from "./routes/input.tsx";
import TextareaRoute from "./routes/textarea.tsx";
import CheckboxRoute from "./routes/checkbox.tsx";
import RadioGroupRoute from "./routes/radio-group.tsx";
import SwitchRoute from "./routes/switch.tsx";
import ToggleRoute from "./routes/toggle.tsx";
import ToggleGroupRoute from "./routes/toggle-group.tsx";
import MeterRoute from "./routes/meter.tsx";
import DialogRoute from "./routes/dialog.tsx";
import AlertDialogRoute from "./routes/alert-dialog.tsx";
import SheetRoute from "./routes/sheet.tsx";
import DrawerRoute from "./routes/drawer.tsx";
import PopoverRoute from "./routes/popover.tsx";
import TooltipRoute from "./routes/tooltip.tsx";
import HoverCardRoute from "./routes/hover-card.tsx";
import DropdownMenuRoute from "./routes/dropdown-menu.tsx";
import ContextMenuRoute from "./routes/context-menu.tsx";
import MenubarRoute from "./routes/menubar.tsx";
import NavigationMenuRoute from "./routes/navigation-menu.tsx";
import AccordionRoute from "./routes/accordion.tsx";
import CollapsibleRoute from "./routes/collapsible.tsx";
import TabsRoute from "./routes/tabs.tsx";
import ScrollAreaRoute from "./routes/scroll-area.tsx";
import ProgressRoute from "./routes/progress.tsx";
import SliderRoute from "./routes/slider.tsx";
import ComboboxRoute from "./routes/combobox.tsx";
import SelectRoute from "./routes/select.tsx";
import AutocompleteRoute from "./routes/autocomplete.tsx";
import NumberFieldRoute from "./routes/number-field.tsx";
import OTPFieldRoute from "./routes/otp-field.tsx";
import ToastRoute from "./routes/toast.tsx";
import FormRoute from "./routes/form.tsx";
import FieldRoute from "./routes/field.tsx";

function ThemeWrapper(props: ParentProps) {
	const [params] = useSearchParams();
	createTrackedEffect(() => {
		if (params.theme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	});
	return (
		<DirectionProvider direction={params.dir === "rtl" ? "rtl" : "ltr"}>
			<main>
				<h1 class="sr-only">Flare UI fixture</h1>
				{props.children}
			</main>
		</DirectionProvider>
	);
}

const Router = createRouter({
	routes: [
		{
			component: ThemeWrapper,
			children: [
				{ path: "/button", component: ButtonRoute },
				{ path: "/badge", component: BadgeRoute },
				{ path: "/label", component: LabelRoute },
				{ path: "/separator", component: SeparatorRoute },
				{ path: "/skeleton", component: SkeletonRoute },
				{ path: "/spinner", component: SpinnerRoute },
				{ path: "/avatar", component: AvatarRoute },
				{ path: "/alert", component: AlertRoute },
				{ path: "/card", component: CardRoute },
				{ path: "/input", component: InputRoute },
				{ path: "/textarea", component: TextareaRoute },
				{ path: "/checkbox", component: CheckboxRoute },
				{ path: "/radio-group", component: RadioGroupRoute },
				{ path: "/switch", component: SwitchRoute },
				{ path: "/toggle", component: ToggleRoute },
				{ path: "/toggle-group", component: ToggleGroupRoute },
				{ path: "/meter", component: MeterRoute },
				{ path: "/dialog", component: DialogRoute },
				{ path: "/alert-dialog", component: AlertDialogRoute },
				{ path: "/sheet", component: SheetRoute },
				{ path: "/drawer", component: DrawerRoute },
				{ path: "/popover", component: PopoverRoute },
				{ path: "/tooltip", component: TooltipRoute },
				{ path: "/hover-card", component: HoverCardRoute },
				{ path: "/dropdown-menu", component: DropdownMenuRoute },
				{ path: "/context-menu", component: ContextMenuRoute },
				{ path: "/menubar", component: MenubarRoute },
				{ path: "/navigation-menu", component: NavigationMenuRoute },
				{ path: "/accordion", component: AccordionRoute },
				{ path: "/collapsible", component: CollapsibleRoute },
				{ path: "/tabs", component: TabsRoute },
				{ path: "/scroll-area", component: ScrollAreaRoute },
				{ path: "/progress", component: ProgressRoute },
				{ path: "/slider", component: SliderRoute },
				{ path: "/combobox", component: ComboboxRoute },
				{ path: "/select", component: SelectRoute },
				{ path: "/autocomplete", component: AutocompleteRoute },
				{ path: "/number-field", component: NumberFieldRoute },
				{ path: "/otp-field", component: OTPFieldRoute },
				{ path: "/toast", component: ToastRoute },
				{ path: "/form", component: FormRoute },
				{ path: "/field", component: FieldRoute },
			],
		},
	],
});

export function App() {
	return <Router />;
}
