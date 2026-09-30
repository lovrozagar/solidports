export enum MenuViewportCssVars {
  /**
   * The width of the parent popup.
   * Placed on the 'previous' container; stores width when previous content was rendered.
   * Can freeze popup dimensions when animating between content.
   */
  popupWidth = '--popup-width',
  /**
   * The height of the parent popup.
   * Placed on the 'previous' container; stores height when previous content was rendered.
   * Can freeze popup dimensions when animating between content.
   */
  popupHeight = '--popup-height',
}
