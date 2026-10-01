import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@solidports/flare-ui/accordion";

export default function AccordionRoute() {
	return (
		<div class="p-8 max-w-sm">
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger>Is it accessible?</AccordionTrigger>
					<AccordionContent>Follows WAI-ARIA pattern.</AccordionContent>
				</AccordionItem>
				<AccordionItem value="b">
					<AccordionTrigger>How does it work?</AccordionTrigger>
					<AccordionContent>Click the trigger to expand or collapse each panel.</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
