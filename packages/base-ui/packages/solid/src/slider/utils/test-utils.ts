type Touches = Array<Pick<Touch, 'identifier' | 'clientX' | 'clientY'>>;

export function createTouches(touches: Touches) {
  return {
    changedTouches: touches.map(
      (touch) =>
        // eslint-disable-next-line compat/compat -- used in test environment only
        new Touch({
          target: document.body,
          ...touch,
        }),
    ),
  };
}

export function getHorizontalSliderRect(width = 100) {
  return {
    bottom: 10,
    height: 10,
    left: 0,
    right: width,
    toJSON() {},
    top: 0,
    width,
    x: 0,
    y: 0,
  };
}
