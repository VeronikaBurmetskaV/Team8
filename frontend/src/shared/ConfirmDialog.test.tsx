import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { ConfirmDialog, ConfirmDialogView } from "./ConfirmDialog";
import {
  handleCancelEvent,
  isBackdropClick,
  openModal,
  type ModalElement,
} from "./modalControl";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/** All elements of a tree returned by a hook-free component, depth first. */
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function view(open: boolean) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const tree = ConfirmDialogView({
    open,
    title: "Ви точно хочете вийти з профілю?",
    confirmLabel: "Вийти",
    cancelLabel: "Скасувати",
    onConfirm,
    onCancel,
    titleId: "dialog-title",
    reduceMotion: true,
  });
  const all = elements(tree);
  const button = (text: string) => {
    const found = all.find(
      (element) => element.type === "button" && element.props.children === text,
    );
    if (!found) throw new Error(`no button «${text}»`);
    return found;
  };
  const dialog = all[0];
  if (!dialog || dialog.type !== "dialog") throw new Error("no <dialog>");
  return { all, button, dialog, onConfirm, onCancel };
}

function fakeDialog(): ModalElement & {
  showModal: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const dialog = {
    open: false,
    showModal: vi.fn(() => {
      dialog.open = true;
    }),
    close: vi.fn(() => {
      dialog.open = false;
    }),
  };
  return dialog;
}

describe("ConfirmDialog", () => {
  it("is a labelled alert dialog on the native <dialog>", () => {
    const html = renderToString(
      <ConfirmDialog
        open
        title="Ви точно хочете вийти з профілю?"
        confirmLabel="Вийти"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toMatch(/^<dialog[^>]*role="alertdialog"/);
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeDefined();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain("Ви точно хочете вийти з профілю?");
    expect(html).toContain(">Скасувати</button>");
  });

  it("opens as a modal, focuses «Скасувати» and gives the focus back on close", () => {
    const dialog = fakeDialog();
    const opener = { focus: vi.fn() };
    const cancel = { focus: vi.fn() };

    const close = openModal(dialog, opener, cancel);
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(cancel.focus).toHaveBeenCalledOnce();

    close();
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
    expect(opener.focus).toHaveBeenCalledOnce();
  });

  it("shows its buttons only while open", () => {
    expect(view(false).all.some((element) => element.type === "button")).toBe(
      false,
    );
    expect(view(true).button("Скасувати")).toBeDefined();
  });

  it("«Підтвердити» calls onConfirm, not onCancel", () => {
    const { button, onConfirm, onCancel } = view(true);
    (button("Вийти").props.onClick as () => void)();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("«Скасувати» calls onCancel, not onConfirm", () => {
    const { button, onConfirm, onCancel } = view(true);
    (button("Скасувати").props.onClick as () => void)();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Esc closes through onCancel instead of the browser closing it alone", () => {
    const { dialog, onCancel, onConfirm } = view(true);
    const event = { preventDefault: vi.fn() };
    (dialog.props.onCancel as (e: typeof event) => void)(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    // The same through the helper.
    const onEsc = vi.fn();
    handleCancelEvent({ preventDefault: () => {} }, onEsc);
    expect(onEsc).toHaveBeenCalledOnce();
  });

  it("a click on the backdrop cancels, a click inside does not", () => {
    const { dialog, onCancel } = view(true);
    const onClick = dialog.props.onClick as (e: object) => void;
    const self = {};
    onClick({ target: {}, currentTarget: self });
    expect(onCancel).not.toHaveBeenCalled();
    onClick({ target: self, currentTarget: self });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(isBackdropClick({ target: self, currentTarget: self })).toBe(true);
  });
});
