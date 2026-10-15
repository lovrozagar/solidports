import { createContext, createMemo, createSignal, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import { Popover } from '@solidports/base-ui/popover';
import { useType } from '@mui/internal-docs-infra/useType';
import type { TypeRefProps } from '@mui/internal-docs-infra/useType';
import { Popup } from '../Popup';
import { ReferenceTable } from '../ReferenceTable/ReferenceTable';
import './TypeRef.css';

const EMPTY_SET = new Set<string>();
const ActiveTypeRefContext = createContext<Accessor<ReadonlySet<string>>>(() => EMPTY_SET);

/**
 * Renders a type reference as an interactive element.
 * When clicked, displays a popover showing the type's documentation
 * rendered via `ReferenceTable`.
 *
 * Falls back to a standard anchor link when no type data is available.
 * When rendered inside a popover for the same type (self-reference),
 * renders a plain span instead of a nested popover.
 */
export function TypeRef(props: TypeRefProps) {
  const activeTypeNames = useContext(ActiveTypeRefContext);
  const typeData = useType(() => props.name);
  const [open, setOpen] = createSignal(false);
  const aliases = createMemo(() => typeData()?.meta.aliases);
  const nextActiveTypeNames = createMemo(
    () => new Set([...activeTypeNames(), props.name, ...(aliases() ?? [])]),
  );

  // Render a plain span for circular type references (direct or through intermediaries)
  const _render = createMemo(() => {
    if (activeTypeNames().has(props.name)) {
      return <span class={props.class}>{props.children}</span>;
    }

    // Fall back to a standard anchor if no type data is available
    const _typeData = typeData();
    if (!_typeData) {
      return (
        <a href={props.href} class={props.class}>
          {props.children}
        </a>
      );
    }
    if (_typeData.meta.type !== 'raw') {
      return (
        <a href={props.href} class={props.class}>
          {props.children}
        </a>
      );
    }
    return (
      <Popover.Root open={open()} onOpenChange={setOpen}>
        <Popover.Trigger openOnHover class={`${props.class ?? ''} TypeRefTrigger`.trim()}>
          {props.children}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8}>
            <Popover.Popup
              render={{
                component: Popup,
                class: 'TypeRefPopup',
              }}
            >
              <Popover.Arrow class="TypeRefArrow">
                <PopoverArrowSvg />
              </Popover.Arrow>
              <div class="TypeRefInner">
                <Popover.Title class="bui-sr-only">{_typeData.meta.name}</Popover.Title>
                <ActiveTypeRefContext value={nextActiveTypeNames}>
                  <div class="TypeRefContent">
                    {_typeData.meta.type === 'raw' ? (
                      _typeData.meta.data.formattedCode
                    ) : (
                      <ReferenceTable type={_typeData.meta} additionalTypes={[]} hideDescription />
                    )}
                  </div>
                </ActiveTypeRefContext>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  });
  return <>{_render()}</>;
}
function PopoverArrowSvg() {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        class="TypeRefArrowFill"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        class="TypeRefArrowStroke"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        class="TypeRefArrowStrokeDark"
      />
    </svg>
  );
}
