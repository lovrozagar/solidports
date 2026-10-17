import type { JSX } from '@solidjs/web';
import { CSPContext } from './CSPContext';
import type { CSPContextValue } from './CSPContext';
import { provideContext } from '../solid-helpers';

/**
 * Provides a default Content Security Policy (CSP) configuration for Base UI components that
 * require inline `<style>` or `<script>` tags.
 *
 * Documentation: [Base UI CSP Provider](https://base-ui.com/react/utils/csp-provider)
 */
export function CSPProvider(props: CSPProvider.Props) {
  const contextValue: CSPContextValue = {
    disableStyleElements: () => props.disableStyleElements,
    nonce: () => props.nonce,
  };

  return provideContext(CSPContext, contextValue, () => <>{props.children}</>);
}

export interface CSPProviderState {}

export interface CSPProviderProps {
  children?: JSX.Element | undefined;
  /**
   * The nonce value to apply to inline `<style>` and `<script>` tags.
   */
  nonce?: string | undefined;
  /**
   * Whether inline `<style>` elements created by Base UI components should not be rendered. Instead, components must specify the CSS styles via custom class names or other methods.
   * @default false
   */
  disableStyleElements?: boolean | undefined;
}

export namespace CSPProvider {
  export type State = CSPProviderState;
  export type Props = CSPProviderProps;
}
