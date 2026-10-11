import { useRef } from '../../solid-helpers';
import type { MenuFilterRootProps } from './MenuFilterRoot';

/** Splits a filterable root's props between the menu root and the filter below it. */
export function useMenuFilterRoot<Payload>(props: MenuFilterRootProps<Payload>) {
  const autoHighlight = () => props.autoHighlight ?? false;
  const virtualFocusRef = useRef<HTMLElement | null>(null);

  return {
    virtualFocusRef,
    get allowEscape() {
      return !autoHighlight();
    },
    get resetOnPointerLeave() {
      return autoHighlight() !== 'always';
    },
    get value() {
      return props.value;
    },
    get defaultValue() {
      return props.defaultValue;
    },
    get onValueChange() {
      return props.onValueChange;
    },
    get filter() {
      return props.filter;
    },
    get autoHighlight() {
      return autoHighlight();
    },
    get locale() {
      return props.locale;
    },
  };
}
