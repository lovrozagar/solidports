import {
  useAnchorPositioning,
  type UseAnchorPositioningParameters,
  type UseAnchorPositioningReturnValue,
} from '../../utils/useAnchorPositioning';

/**
 * Positioning path for the Navigation Menu, whose active trigger supplies its root store after the
 * positioner has already rendered.
 */
export function useNavigationMenuAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  return useAnchorPositioning(params);
}
