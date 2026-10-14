import { useBaseUIFloating } from '../../floating-ui-solid/hooks/useFloating';
import { useFloatingRootContext } from '../../floating-ui-solid/hooks/useFloatingRootContext';
import type { UseFloatingOptions } from '../../floating-ui-solid/types';
import { mergeProps } from '../../solid-1-compat';
import { useAnchorPositioningWithHook } from '../../utils/useAnchorPositioning';
import type {
  UseAnchorPositioningParameters,
  UseAnchorPositioningReturnValue,
} from '../../utils/useAnchorPositioning';

function useFloatingWithFallbackStore(options: UseFloatingOptions) {
  const fallbackStore = useFloatingRootContext(options);
  return useBaseUIFloating(
    mergeProps(options, {
      get rootContext() {
        return options.rootContext || fallbackStore;
      },
    }),
  );
}

/**
 * Positioning path for the Navigation Menu, whose active trigger supplies its root store after the
 * positioner has already rendered.
 */
export function useNavigationMenuAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  return useAnchorPositioningWithHook(params, useFloatingWithFallbackStore);
}
