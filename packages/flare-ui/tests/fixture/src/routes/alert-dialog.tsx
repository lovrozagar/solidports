import {
	AlertDialog,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from "@solidports/flare-ui/alert-dialog";
import { buttonRender } from "../element-render.tsx";

export default function AlertDialogRoute() {
	return (
		<AlertDialog>
			<AlertDialogTrigger render={buttonRender("Delete", { variant: "destructive" })} />
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you sure?</AlertDialogTitle>
					<AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
