/** After a failed submit, move focus to the first invalid field inside `root`. */
export function focusFirstInvalid(root: ParentNode | null | undefined = document) {
  requestAnimationFrame(() => {
    root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
