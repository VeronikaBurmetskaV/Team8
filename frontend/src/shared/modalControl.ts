/**
 * The browser-facing part of ConfirmDialog, kept free of React so it can be tested in node
 * without a DOM: opening and closing the native <dialog>, Esc and clicks on the backdrop.
 */

/** The parts of HTMLDialogElement the dialog uses. */
export interface ModalElement {
  readonly open: boolean;
  showModal(): void;
  close(): void;
}

export interface Focusable {
  focus(): void;
}

/**
 * Opens the dialog as a modal (focus trap, Esc, ::backdrop), puts the focus on `initialFocus`
 * (the «Скасувати» button) and returns the cleanup: close the dialog and give the focus back
 * to the element that had it before, i.e. the button that opened the dialog.
 */
export function openModal(
  dialog: ModalElement,
  opener: Focusable | null,
  initialFocus: Focusable | null,
): () => void {
  if (!dialog.open) dialog.showModal();
  initialFocus?.focus();
  return () => {
    if (dialog.open) dialog.close();
    opener?.focus();
  };
}

/**
 * Esc fires `cancel` on a modal <dialog>. The browser would close it on its own; we stop that
 * and let the owner close it through `open`, so React state and the element never disagree.
 */
export function handleCancelEvent(
  event: { preventDefault(): void },
  onCancel: () => void,
): void {
  event.preventDefault();
  onCancel();
}

/**
 * A click whose target is the <dialog> itself landed on the backdrop: the content fills the
 * dialog box (no padding on the element), so a click inside always targets a child.
 */
export function isBackdropClick(event: {
  target: unknown;
  currentTarget: unknown;
}): boolean {
  return event.target === event.currentTarget;
}

/** The part of `document.body.style` that `lockPageScroll` touches. */
export interface ScrollLockTarget {
  style: { overflow: string };
}

/**
 * Stops the page behind a modal from scrolling (a native modal <dialog> does not do it) and
 * returns the cleanup that puts the previous value back.
 */
export function lockPageScroll(body: ScrollLockTarget): () => void {
  const previous = body.style.overflow;
  body.style.overflow = "hidden";
  return () => {
    body.style.overflow = previous;
  };
}
