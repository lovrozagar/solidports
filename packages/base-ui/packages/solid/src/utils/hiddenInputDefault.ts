/**
 * Gives a part's hidden checkbox or radio input its initial checked state as its default
 * (`defaultChecked`, the `checked` attribute), as React does when it first renders a controlled
 * input (`initInput`): a form reset then restores the part's initial state, and a client-rendered
 * input matches the server's markup. The `checked` property follows the state afterwards; the
 * default is set once.
 */
export function setHiddenInputDefault(input: HTMLInputElement, checked: boolean) {
  input.defaultChecked = checked;
}
