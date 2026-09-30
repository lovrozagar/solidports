/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createSignal, onCleanup, onMount, type ParentProps } from "solid-js"
import { CompositeRoot } from "../internals/composite/root/CompositeRoot"
import {
	FloatingNode,
	FloatingTree,
	useFloatingNodeId,
	useFloatingTree,
} from "../floating-ui-solid"
import { type MenuRoot } from "../menu/root/MenuRoot"
import { MenuOpenEventDetails } from "../menu/utils/types"
import { splitComponentProps, useRef } from "../solid-helpers"
import { StateAttributesMapping } from "../utils/getStateAttributesProps"
import { BaseUIComponentProps } from "../utils/types"
import { useBaseUiId } from "../utils/useBaseUiId"
import { REASONS } from "../utils/reasons"
import { MenubarContext, useMenubarContext } from "./MenubarContext"
import { MenubarDataAttributes } from "./MenubarDataAttributes"

const menubarStateAttributesMapping: StateAttributesMapping<Menubar.State> = {
	hasSubmenuOpen(value) {
		return value ? { [MenubarDataAttributes.hasSubmenuOpen]: "" } : null
	},
}

/**
 * The container for menus.
 *
 * Documentation: [Base UI Menubar](https://base-ui.com/react/components/menubar)
 */
export function Menubar(props: Menubar.Props) {
	const [renderProps, local, elementProps] = splitComponentProps(props, [
		"orientation",
		"loopFocus",
		"modal",
		"disabled",
		"id",
		"children",
	])
	const orientation = () => local.orientation ?? "horizontal"
	const loopFocus = () => local.loopFocus ?? true
	const modal = () => local.modal ?? true
	const disabled = () => local.disabled ?? false
	const idProp = () => local.id

	const [contentElement, setContentElement] = createSignal<HTMLElement | null | undefined>()
	const [hasSubmenuOpen, setHasSubmenuOpen] = createSignal(false)
	const allowMouseUpTriggerRef = useRef(false)

	const id = useBaseUiId(idProp)

	const state: Menubar.State = {
		get hasSubmenuOpen() {
			return hasSubmenuOpen()
		},
		get modal() {
			return modal()
		},
		get orientation() {
			return orientation()
		},
	}

	const context: MenubarContext = {
		allowMouseUpTriggerRef,
		contentElement,
		disabled,
		hasSubmenuOpen,
		modal,
		orientation,
		rootId: id,
		setContentElement,
		setHasSubmenuOpen,
	}

	return (
		<MenubarContext.Provider value={context}>
			<FloatingTree>
				<MenubarContent>
					<CompositeRoot
						render={renderProps.render}
						class={renderProps.class}
						state={state}
						stateAttributesMapping={menubarStateAttributesMapping}
						refs={[
							(el) => {
								if (typeof props.ref === "function") {
									props.ref(el as HTMLDivElement)
								} else {
									// eslint-disable-next-line solid/reactivity
									props.ref = el as any
								}
							},
							setContentElement,
						]}
						props={[{ id: id(), role: "menubar" }, elementProps]}
						orientation={orientation()}
						loopFocus={loopFocus()}
						highlightItemOnHover={hasSubmenuOpen()}
					>
						{local.children}
					</CompositeRoot>
				</MenubarContent>
			</FloatingTree>
		</MenubarContext.Provider>
	)
}

function MenubarContent(props: ParentProps) {
	const nodeId = useFloatingNodeId()
	const tree = useFloatingTree()
	if (!tree) {
		throw new Error('Base UI: Menubar must be used within <FloatingTree>.')
	}
	const { events: menuEvents } = tree
	const rootContext = useMenubarContext()

	function onSubmenuOpenChange(details: MenuOpenEventDetails) {
		if (!details.nodeId || details.parentNodeId !== nodeId()) {
			return
		}

		if (details.open) {
			/* Skip redundant writes: signal equality already short-circuits, but reads of `hasSubmenuOpen` here also serve as a dependency on the signal which retracks under listener invocation in dev. */
			if (!rootContext.hasSubmenuOpen()) {
				rootContext.setHasSubmenuOpen(true)
			}
		} else if (
			details.reason !== REASONS.siblingOpen &&
			details.reason !== REASONS.listNavigation
		) {
			rootContext.setHasSubmenuOpen(false)
		}
	}

	onMount(() => {
		menuEvents.on("menuopenchange", onSubmenuOpenChange)
		onCleanup(() => {
			menuEvents.off("menuopenchange", onSubmenuOpenChange)
		})
	})

	return <FloatingNode id={nodeId()}>{props.children}</FloatingNode>
}

export interface MenubarState {
	/**
	 * The orientation of the menubar.
	 */
	orientation: MenuRoot.Orientation
	/**
	 * Whether the menubar is modal.
	 */
	modal: boolean
	/**
	 * Whether any submenu within the menubar is open.
	 */
	hasSubmenuOpen: boolean
}

export interface MenubarProps extends BaseUIComponentProps<"div", Menubar.State> {
	/**
	 * Whether the menubar is modal.
	 * @default true
	 */
	modal?: boolean | undefined
	/**
	 * Whether the whole menubar is disabled.
	 * @default false
	 */
	disabled?: boolean | undefined
	/**
	 * The orientation of the menubar.
	 * @default 'horizontal'
	 */
	orientation?: MenuRoot.Orientation | undefined
	/**
	 * Whether to loop keyboard focus back to the first item
	 * when the end of the list is reached while using the arrow keys.
	 * @default true
	 */
	loopFocus?: boolean | undefined
}

export namespace Menubar {
	export type State = MenubarState
	export type Props = MenubarProps
}
