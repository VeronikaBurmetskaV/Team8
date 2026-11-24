import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { lockPageScroll } from "../modalControl";
import { ProductCard } from "../ProductCard/ProductCard";
import type { SavedProduct } from "../productLists";
import { ProductModal, ProductModalView } from "./ProductModal";
import { SavedProductsView, type FocusTarget } from "./SavedProducts";
import {
  initialSavedProductsState,
  savedProductsReducer,
  type SavedProductsAction,
  type SavedProductsState,
} from "./savedProductsState";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/**
 * All elements of a tree, depth first, through the children of every element and the
 * `photoOverlay` of a ProductCard (the question about removing lives there).
 */
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [
    node,
    ...elements(node.props.children),
    ...elements(node.props.photoOverlay as ReactNode),
  ];
}

const dress: SavedProduct = {
  id: "a",
  name: "Сукня льняна",
  brandName: "Бренд А",
  priceUah: 2400,
  photoUrl: "https://example.com/a.jpg",
  productUrl: "https://brand-a.example/dress",
};
const shirt: SavedProduct = {
  id: "b",
  name: "Сорочка",
  brandName: "Бренд Б",
  priceUah: 1500,
  photoUrl: "https://example.com/b.jpg",
  productUrl: "https://brand-b.example/shirt",
};

const removeLabel = (name: string) => `Прибрати з Вподобаного: ${name}`;
const QUESTION = "Впевнені, що хочете видалити товар?";
const BRAND_LINK = "Перейти на сайт бренду";

/**
 * The list page with a real reducer behind `dispatch`: each call to `render()` draws the
 * current state, like React would after the update.
 */
function page(initialItems: SavedProduct[] = [dress, shirt]) {
  let items = initialItems;
  let state: SavedProductsState = initialSavedProductsState;
  const dispatch = (action: SavedProductsAction) => {
    state = savedProductsReducer(state, action);
  };
  const onRemove = vi.fn((id: string) => {
    items = items.filter((item) => item.id !== id);
  });
  const requestFocus = vi.fn<(target: FocusTarget) => void>();

  const props = () => ({
    titleId: "favorites-title",
    title: "Вподобане",
    items,
    emptyText: "Порожньо",
    emptyLinks: [{ to: "/feed", text: "Почати свайпати" }],
    listLabel: "Вподобані товари",
    removeLabel,
    onRemove,
    state,
    dispatch,
    reduceMotion: true,
    requestFocus,
  });

  const render = () => {
    const all = elements(SavedProductsView(props()));
    const byLabel = (label: string) =>
      all.find((element) => element.props["aria-label"] === label);
    const cardButton = (name: string) => byLabel(`Відкрити картку: ${name}`);
    const button = (text: string) =>
      all.find(
        (element) =>
          element.type === "button" && element.props.children === text,
      );
    const modal = all.find((element) => element.type === ProductModal);
    if (!modal) throw new Error("no ProductModal");
    const cardOf = (id: string) =>
      all.find(
        (element) =>
          element.type === ProductCard &&
          (element.props.card as SavedProduct).id === id,
      );
    const question = all.find(
      (element) => element.props.role === "alertdialog",
    );
    return { all, byLabel, cardButton, button, modal, cardOf, question };
  };

  const html = () => renderToString(SavedProductsView(props()));

  const click = (element: ReactElement<AnyProps> | undefined) => {
    if (!element) throw new Error("nothing to click");
    const event = { stopPropagation: vi.fn() };
    (element.props.onClick as (e: typeof event) => void)(event);
    return event;
  };

  return { render, html, click, onRemove, requestFocus };
}

describe("«Вподобане»: the compact card", () => {
  it("has no «Прибрати», no flip and no «Перейти на сайт бренду»", () => {
    const { render, html } = page();
    const view = render();
    expect(view.all.some((element) => element.type === "a")).toBe(false);
    expect(view.button("Прибрати")).toBeUndefined();
    expect(view.cardOf("a")?.props.flippable).toBe(false);
    const markup = html();
    expect(markup).not.toContain(BRAND_LINK);
    expect(markup).not.toContain("Перевернути");
  });

  it("the whole card is one focusable button «Відкрити картку: …»", () => {
    const card = page().render().cardButton("Сукня льняна");
    expect(card?.props.role).toBe("button");
    expect(card?.props.tabIndex).toBe(0);
  });

  it("a compact ProductCard renders neither «Перевернути» nor the back side", () => {
    const html = renderToString(<ProductCard card={dress} flippable={false} />);
    expect(html).not.toContain("Перевернути");
    expect(html).not.toContain("Деталі товару");
    expect(html).toContain("Сукня льняна");
  });

  it("the feed card is unchanged: «Перевернути», the back side, no blur, no overlay box", () => {
    const html = renderToString(<ProductCard card={dress} />);
    expect(html).toContain("Перевернути");
    expect(html).toContain("Деталі товару");
    expect(html).not.toContain("blur(");
    expect(html).not.toContain("photoOverlay");
  });
});

describe("«Вподобане»: removing with the «×»", () => {
  it("the «×» shows the question on its own card and blurs only that photo", () => {
    const { render, click } = page();
    const before = render();
    expect(before.question).toBeUndefined();
    expect(before.cardOf("a")?.props.photoBlurred).toBe(false);

    const cross = click(before.byLabel(removeLabel(dress.name)));
    expect(cross.stopPropagation).toHaveBeenCalledOnce();

    const after = render();
    expect(after.cardOf("a")?.props.photoBlurred).toBe(true);
    expect(after.cardOf("b")?.props.photoBlurred).toBe(false);
    // The question is the overlay of card «a», not a dialog of the page.
    const overlay = elements(
      after.cardOf("a")?.props.photoOverlay as ReactNode,
    );
    expect(overlay).toContain(after.question);
    expect(
      elements(after.cardOf("b")?.props.photoOverlay as ReactNode),
    ).not.toContain(after.question);
    expect(after.button("Видалити")).toBeDefined();
    expect(after.button("Скасувати")).toBeDefined();
  });

  it("the question is a labelled alertdialog inside the card's <article>, not a <dialog>", () => {
    const { render, click, html } = page();
    click(render().byLabel(removeLabel(dress.name)));
    const markup = html();

    const question = markup.match(
      /<div[^>]*role="alertdialog"[^>]*aria-labelledby="([^"]+)"/,
    );
    expect(question).not.toBeNull();
    expect(markup).toContain(`<p id="${question?.[1]}"`);
    expect(markup).toContain(QUESTION);
    // Inside the first card's <article>…</article>.
    const article = markup.slice(
      markup.indexOf("<article"),
      markup.indexOf("</article>"),
    );
    expect(article).toContain('role="alertdialog"');
    expect(article).toContain("blur(10px)");
    expect(markup).not.toMatch(/<dialog[^>]*alertdialog/);
    expect(markup.match(/role="alertdialog"/g)).toHaveLength(1);
  });

  it("while asking, the «×» is hidden and the card does not open the full card", () => {
    const { render, click } = page();
    click(render().byLabel(removeLabel(dress.name)));
    const view = render();
    expect(view.byLabel(removeLabel(dress.name))).toBeUndefined();
    expect(view.cardButton("Сукня льняна")).toBeUndefined();

    // Nothing around card «a» is a button or reacts to a click now.
    const cardA = view.cardOf("a") as ReactElement<AnyProps>;
    const around = view.all.filter(
      (element) =>
        element !== cardA && elements(element.props.children).includes(cardA),
    );
    expect(around.length).toBeGreaterThan(0);
    for (const element of around) {
      expect(element.props.role).not.toBe("button");
      expect(element.props.onClick).toBeUndefined();
    }
    expect(render().modal.props.product).toBeNull();

    // The other cards work as usual.
    expect(view.byLabel(removeLabel(shirt.name))).toBeDefined();
    click(view.cardButton("Сорочка"));
    expect(render().modal.props.product).toEqual(shirt);
  });

  it("only one question at a time", () => {
    const { render, click } = page();
    click(render().byLabel(removeLabel(dress.name)));
    click(render().byLabel(removeLabel(shirt.name)));
    const view = render();
    expect(view.cardOf("a")?.props.photoBlurred).toBe(false);
    expect(view.cardOf("b")?.props.photoBlurred).toBe(true);
    expect(
      view.all.filter((element) => element.props.role === "alertdialog"),
    ).toHaveLength(1);
  });

  it("«Скасувати» removes nothing, takes the blur off and gives the focus back to the «×»", () => {
    const { render, click, onRemove, requestFocus } = page();
    click(render().byLabel(removeLabel(dress.name)));

    click(render().button("Скасувати"));
    const after = render();
    expect(onRemove).not.toHaveBeenCalled();
    expect(after.question).toBeUndefined();
    expect(after.cardOf("a")?.props.photoBlurred).toBe(false);
    expect(after.byLabel(removeLabel(dress.name))).toBeDefined();
    expect(requestFocus).toHaveBeenLastCalledWith({ kind: "remove", id: "a" });
  });

  it("Esc is «Скасувати»: nothing is removed", () => {
    const { render, click, onRemove, requestFocus } = page();
    click(render().byLabel(removeLabel(dress.name)));

    const other = {
      key: "a",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    const onKeyDown = render().question?.props.onKeyDown as (
      e: typeof other,
    ) => void;
    onKeyDown(other);
    expect(render().question).toBeDefined();

    const esc = {
      key: "Escape",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    onKeyDown(esc);
    expect(esc.preventDefault).toHaveBeenCalledOnce();
    expect(render().question).toBeUndefined();
    expect(onRemove).not.toHaveBeenCalled();
    expect(requestFocus).toHaveBeenLastCalledWith({ kind: "remove", id: "a" });
  });

  it("«Видалити» removes the product and moves the focus to the next card", () => {
    const { render, click, onRemove, requestFocus } = page();
    click(render().byLabel(removeLabel(dress.name)));

    click(render().button("Видалити"));
    const after = render();
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("a");
    expect(after.question).toBeUndefined();
    expect(after.cardOf("a")).toBeUndefined();
    expect(after.cardOf("b")).toBeDefined();
    expect(requestFocus).toHaveBeenLastCalledWith({ kind: "card", id: "b" });
  });

  it("removing the last product moves the focus to the previous card, then the title", () => {
    const { render, click, requestFocus } = page();
    click(render().byLabel(removeLabel(shirt.name)));
    click(render().button("Видалити"));
    expect(requestFocus).toHaveBeenLastCalledWith({ kind: "card", id: "a" });

    click(render().byLabel(removeLabel(dress.name)));
    click(render().button("Видалити"));
    expect(requestFocus).toHaveBeenLastCalledWith({ kind: "title" });
  });
});

describe("«Вподобане»: the full card over the page", () => {
  it("a click on the card opens the modal with that product", () => {
    const { render, click } = page();
    expect(render().modal.props.product).toBeNull();
    click(render().cardButton("Сукня льняна"));
    expect(render().modal.props.product).toEqual(dress);
  });

  it("Enter and Space open it too; other keys do not", () => {
    for (const key of ["Enter", " "]) {
      const { render } = page();
      const event = { key, preventDefault: vi.fn() };
      const card = render().cardButton("Сорочка");
      (card?.props.onKeyDown as (e: typeof event) => void)(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(render().modal.props.product).toEqual(shirt);
    }
    const { render } = page();
    const card = render().cardButton("Сорочка");
    (card?.props.onKeyDown as (e: object) => void)({
      key: "a",
      preventDefault: vi.fn(),
    });
    expect(render().modal.props.product).toBeNull();
  });

  it("the «×» is not inside the card button and does not open the modal", () => {
    const { render, click } = page();
    const view = render();
    const card = view.cardButton("Сукня льняна");
    const cross = view.byLabel(removeLabel(dress.name));
    expect(elements(card?.props.children)).not.toContain(cross);
    click(cross);
    expect(render().modal.props.product).toBeNull();
  });

  it("the modal is a labelled dialog with the flipping card and «Перейти на сайт бренду»", () => {
    const html = renderToString(
      <ProductModal product={dress} onClose={() => {}} />,
    );
    expect(html).toMatch(/<dialog[^>]*role="dialog"/);
    expect(html).toContain('aria-modal="true"');
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeDefined();
    expect(html).toMatch(
      new RegExp(`<h2 id="${labelledBy}"[^>]*>Сукня льняна</h2>`),
    );
    expect(html).toContain("Перевернути");
    expect(html).toContain("Деталі товару");
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*href="https://brand-a.example/dress\\?utm_source=fulla"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>${BRAND_LINK}</a>`,
      ),
    );
    expect(html).toContain('aria-label="Закрити картку"');
  });

  it("closes by its «×», by Esc and by a click on the dimmed page", () => {
    const onClose = vi.fn();
    const all = elements(
      ProductModalView({
        product: dress,
        onClose,
        titleId: "t",
        reduceMotion: true,
      }),
    );
    const dialog = all[0];
    if (!dialog || dialog.type !== "dialog") throw new Error("no <dialog>");

    const esc = { preventDefault: vi.fn() };
    (dialog.props.onCancel as (e: typeof esc) => void)(esc);
    expect(esc.preventDefault).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledTimes(1);

    const close = all.find(
      (element) => element.props["aria-label"] === "Закрити картку",
    );
    (close?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(2);

    // The backdrop: the element with onClick that is neither a button nor the dialog.
    const backdrop = all.find(
      (element) =>
        element.type !== "button" &&
        element !== dialog &&
        typeof element.props.onClick === "function",
    );
    (backdrop?.props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("the list closes the modal through the reducer", () => {
    const { render, click } = page();
    click(render().cardButton("Сукня льняна"));
    (render().modal.props.onClose as () => void)();
    expect(render().modal.props.product).toBeNull();
  });

  it("locks the page scroll while open and gives it back after", () => {
    const body = { style: { overflow: "auto" } };
    const unlock = lockPageScroll(body);
    expect(body.style.overflow).toBe("hidden");
    unlock();
    expect(body.style.overflow).toBe("auto");
  });
});

describe("savedProductsReducer", () => {
  it("opening a card and asking to remove never show both at once", () => {
    const open = savedProductsReducer(initialSavedProductsState, {
      type: "open",
      id: "a",
    });
    expect(open).toEqual({ openId: "a", confirmId: null });
    const asking = savedProductsReducer(open, { type: "askRemove", id: "b" });
    expect(asking).toEqual({ openId: null, confirmId: "b" });
    expect(savedProductsReducer(asking, { type: "closeQuestion" })).toEqual(
      initialSavedProductsState,
    );
  });
});
