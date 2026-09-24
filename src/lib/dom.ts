/**
 * After a failed submit, move focus to the first invalid field inside `root`,
 * or, when the problem is not a single field (e.g. a whole week plan), bring
 * the first error message into view.
 */
export function focusFirstInvalid(root: ParentNode | null | undefined = document) {
  requestAnimationFrame(() => {
    const field = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (field) {
      field.focus();
      return;
    }
    root?.querySelector<HTMLElement>('.field-error, [role="alert"]')?.scrollIntoView({ block: 'center' });
  });
}
