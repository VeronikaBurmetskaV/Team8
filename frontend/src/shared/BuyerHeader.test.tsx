import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router";
import { CompactBarView, HeaderToggle, isBarToggleClick } from "./BuyerHeader";
import { headerTexts as t } from "./messages.uk";
import { headerReducer, INITIAL_HEADER_STATE } from "./headerState";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

/** All elements of a tree returned by a hook-free component, depth first. */
function elements(node: ReactNode): ReactElement<AnyProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<AnyProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function bar() {
  const onToggle = vi.fn();
  const onLogo = vi.fn();
  const tree = CompactBarView({ onToggle, onLogo });
  const all = elements(tree);
  const root = all[0];
  const logo = all.find((element) => element.type === Link);
  if (!root || !logo) throw new Error("bar markup changed");
  return { root, logo, onToggle, onLogo };
}

/** The arrow of the shell (one element for the bar and the expanded header). */
function arrow(expanded: boolean) {
  const onToggle = vi.fn();
  const button = HeaderToggle({ expanded, panelId: "header-panel", onToggle });
  return { arrow: button, onToggle };
}

/** A click event whose target is (or is inside) `tag`, as the bar's onClick sees it. */
function clickOn(tag: "div" | "a" | "button") {
  return {
    target: {
      closest: (selector: string) =>
        tag !== "div" && selector.includes(tag) ? {} : null,
    },
  };
}

describe("buyer header: thin bar", () => {
  it("appears once the page scrolls past the full header", () => {
    const scrolled = headerReducer(INITIAL_HEADER_STATE, {
      type: "scroll",
      y: 600,
      maxY: 5000,
      fullHeight: 128,
    });
    expect(scrolled.mode).toBe("compact");
    // The bar's own markup: small FULLA without «SWIPING» and the arrow.
    const { logo } = bar();
    expect(logo.props.children).toBe("FULLA");
  });

  it("arrow: «Розгорнути меню», aria-expanded=false, controls the panel", () => {
    const { arrow: button } = arrow(false);
    expect(button.props["aria-label"]).toBe(t.compactExpand);
    expect(button.props["aria-label"]).toBe("Розгорнути меню");
    expect(button.props["aria-expanded"]).toBe(false);
    expect(button.props["aria-controls"]).toBe("header-panel");
    expect(button.props.type).toBe("button");
  });

  it("arrow when open: «Згорнути меню», aria-expanded=true", () => {
    const { arrow: button } = arrow(true);
    expect(button.props["aria-label"]).toBe("Згорнути меню");
    expect(button.props["aria-expanded"]).toBe(true);
    // the chevron turns up (CSS rotate) by this attribute
    expect(button.props["data-expanded"]).toBe(true);
  });

  it("a click on the arrow opens, and then closes, the header", () => {
    const { arrow: button, onToggle } = arrow(false);
    (button.props.onClick as (event: { detail: number }) => void)({
      detail: 1,
    });
    expect(onToggle).toHaveBeenCalledTimes(1);

    let state = headerReducer(INITIAL_HEADER_STATE, {
      type: "scroll",
      y: 600,
      maxY: 5000,
      fullHeight: 128,
    });
    state = headerReducer(state, { type: "toggle", y: 600 });
    expect(state.mode).toBe("expanded");
    state = headerReducer(state, { type: "toggle", y: 600 });
    expect(state.mode).toBe("compact");
  });

  it("a click on the bar itself toggles; on the logo or the arrow it does not (twice)", () => {
    const { root, onToggle } = bar();
    const onClick = root.props.onClick as (event: unknown) => void;
    onClick(clickOn("div"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    onClick(clickOn("a"));
    onClick(clickOn("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(isBarToggleClick(null)).toBe(true);
  });

  it("the logo leads to / and scrolls to the top", () => {
    const { logo, onLogo } = bar();
    expect(logo.props.to).toBe("/");
    expect(logo.props["aria-label"]).toBe(t.logoLabel);
    (logo.props.onClick as () => void)();
    expect(onLogo).toHaveBeenCalledTimes(1);
  });

  it("Esc and another page close the expanded header", () => {
    const open = headerReducer(
      headerReducer(INITIAL_HEADER_STATE, {
        type: "scroll",
        y: 600,
        maxY: 5000,
        fullHeight: 128,
      }),
      { type: "toggle", y: 0 },
    );
    // BuyerHeader dispatches `collapse` on Esc (closesOnKey) and on a pathname change.
    expect(headerReducer(open, { type: "collapse" }).mode).toBe("compact");
  });
});
