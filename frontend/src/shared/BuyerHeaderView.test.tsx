import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import {
  BuyerHeaderView,
  HeaderToggle,
  headerEnter,
  type BuyerHeaderViewProps,
} from "./BuyerHeader";
import type { HeaderMode } from "./headerState";

const noop = () => {};

/** The props of the header view in one state. */
function viewProps(
  mode: HeaderMode,
  extra: Partial<BuyerHeaderViewProps> = {},
): BuyerHeaderViewProps {
  return {
    mode,
    enter: null,
    content: {
      pathname: "/",
      city: "kyiv",
      onCity: noop,
      language: "UA",
      onLanguage: noop,
      newFavorites: 0,
    },
    reveal: false,
    panelId: "header-panel",
    fullHeight: 128,
    barHeight: 48,
    animating: false,
    reduceMotion: true,
    onToggle: noop,
    onLogo: noop,
    ...extra,
  };
}

/** The whole header in one state, as the server renders it. */
function render(mode: HeaderMode, extra: Partial<BuyerHeaderViewProps> = {}) {
  return renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <BuyerHeaderView {...viewProps(mode, extra)} />
    </MemoryRouter>,
  );
}

const count = (html: string, part: string) => html.split(part).length - 1;

/** The full header's grid (div.inner) with everything inside it, without the arrow. */
function inner(html: string): string {
  const start = html.search(/<div class="[^"]*_inner/);
  const toggle = html.search(/<button[^>]*class="[^"]*_toggle/);
  const end = html.indexOf("</header>");
  if (start < 0 || end < 0) throw new Error("header markup changed");
  // Without the closing tags of .inner, .shellContent and the shell.
  return html
    .slice(start, toggle > start ? toggle : end)
    .replace(/(<\/div>)+$/, "");
}

/** The arrow (HeaderToggle) in any state. */
const TOGGLE = /<button[^>]*data-header-toggle[^>]*>.*?<\/button>/s;

describe("buyer header: expanded from the thin bar", () => {
  it("is one <header> with exactly one FULLA logo, the full one with SWIPING", () => {
    const html = render("expanded");
    expect(count(html, "<header")).toBe(1);
    expect(count(html, ">FULLA<")).toBe(1);
    expect(html).toContain("SWIPING");
    expect(count(html, 'aria-label="FULLA — на головну"')).toBe(1);
    // The thin bar is gone, not hidden under the header.
    expect(html).not.toContain("Розгорнути меню");
  });

  it("is the same full header as at the top of the page, plus the arrow", () => {
    const full = render("full");
    const expanded = render("expanded");
    expect(inner(expanded)).toBe(inner(full));
    // Same classes on the grid: no extra padding or size for the expanded state.
    const grid = (html: string) =>
      html.match(/<div class="[^"]*_inner[^"]*"/)?.[0];
    expect(grid(expanded)).toBe(grid(full));
  });

  it("is fixed over the content while the page keeps the full header's height", () => {
    const html = render("expanded");
    expect(html).toMatch(/<div class="[^"]*_spacer[^"]*" style="height:128px"/);
    expect(html).toMatch(/id="header-panel"[^>]*data-mode="expanded"/);
  });

  it("keeps one spacer of the same height in every state (the page never moves)", () => {
    const spacer = (html: string) =>
      html.match(/<div class="[^"]*_spacer[^"]*"[^>]*>/g) ?? [];
    for (const mode of ["full", "compact", "expanded"] as const) {
      expect(spacer(render(mode))).toEqual([
        '<div class="_spacer_' +
          (spacer(render("full"))[0]?.match(/_spacer_(\w+)/)?.[1] ?? "") +
          '" style="height:128px" aria-hidden="true">',
      ]);
    }
  });

  it("changes the background by scaleY only: full height, shrunk for the bar", () => {
    const bg = (html: string) =>
      html.match(/<div class="[^"]*_shellBg[^"]*" style="([^"]*)"/)?.[1] ?? "";
    expect(bg(render("full"))).toBe("height:128px;transform:scaleY(1)");
    expect(bg(render("expanded"))).toBe("height:128px;transform:scaleY(1)");
    expect(bg(render("compact"))).toBe("height:128px;transform:scaleY(0.375)");
  });

  it("has the arrow as «Згорнути меню» (turned up), and no other arrow", () => {
    const expanded = render("expanded");
    const arrows = expanded.match(new RegExp(TOGGLE, "gs")) ?? [];
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toContain('aria-label="Згорнути меню"');
    expect(arrows[0]).toContain('aria-expanded="true"');
    expect(arrows[0]).toContain('data-expanded="true"');
    expect(arrows[0]).toContain('aria-controls="header-panel"');
    expect(render("full")).not.toMatch(TOGGLE);
  });
});

describe("buyer header: other states", () => {
  it("full: one header, one big logo, in the page flow, no arrow", () => {
    const html = render("full");
    expect(count(html, "<header")).toBe(1);
    expect(count(html, ">FULLA<")).toBe(1);
    expect(html).toContain("SWIPING");
    expect(html).not.toMatch(/<header[^>]*style=/);
    expect(html).not.toContain("Розгорнути меню");
  });

  it("compact: only the thin bar with the small logo and «Розгорнути меню»", () => {
    const html = render("compact");
    expect(count(html, "<header")).toBe(1);
    expect(count(html, ">FULLA<")).toBe(1);
    expect(html).not.toContain("SWIPING");
    expect(html).toContain('aria-label="Розгорнути меню"');
  });
});

describe("headerEnter", () => {
  it("names the animation of each change", () => {
    expect(headerEnter("full", "compact")).toBe("slide");
    expect(headerEnter("compact", "expanded")).toBe("expand");
    expect(headerEnter("expanded", "compact")).toBe("collapse");
    expect(headerEnter("compact", "full")).toBeNull();
    expect(headerEnter(null, "full")).toBeNull();
  });
});

describe("buyer header: the bar lines up with the full header", () => {
  /** Classes of the element that holds the content of each state. */
  const frame = (html: string, part: "_inner" | "_barInner") =>
    html.match(new RegExp(`<div class="([^"]*${part}[^"]*)"`))?.[1] ?? "";

  it("uses the same container as the full header", () => {
    const fullFrame = frame(render("full"), "_inner");
    const barFrame = frame(render("compact"), "_barInner");
    const container = (classes: string) =>
      classes.split(" ").find((name) => name.startsWith("_container"));
    expect(container(fullFrame)).toBeDefined();
    expect(container(barFrame)).toBe(container(fullFrame));
  });

  it("tells a keyboard press of the arrow from a mouse click", () => {
    const onToggle = vi.fn();
    const button = HeaderToggle({ expanded: false, panelId: "p", onToggle });
    const onClick = button.props.onClick as (event: { detail: number }) => void;
    onClick({ detail: 1 }); // mouse or touch
    onClick({ detail: 0 }); // Enter or Space
    expect(onToggle.mock.calls).toEqual([[false], [true]]);
  });
});

describe("the arrow is one element in the bar and in the expanded header", () => {
  type AnyProps = Record<string, unknown> & { children?: ReactNode };

  /** Where the arrow sits in the tree: the chain of [element type, key, child index]. */
  function arrowPath(mode: HeaderMode): string[] | null {
    const tree = BuyerHeaderView(viewProps(mode));
    function walk(node: ReactNode, path: string[]): string[] | null {
      const children = Array.isArray(node) ? node : [node];
      for (const [index, child] of children.entries()) {
        if (!isValidElement<AnyProps>(child)) continue;
        const name =
          typeof child.type === "string"
            ? child.type
            : ((child.type as { name?: string; displayName?: string }).name ??
              (child.type as { displayName?: string }).displayName ??
              "component");
        const here = [...path, `${name}#${String(child.key)}@${index}`];
        if (child.type === HeaderToggle) return here;
        const found = walk(child.props.children, here);
        if (found) return found;
      }
      return null;
    }
    return walk(tree, []);
  }

  it("keeps the arrow at the same place in the tree, so React does not remount it", () => {
    const compact = arrowPath("compact");
    expect(compact).not.toBeNull();
    expect(arrowPath("expanded")).toEqual(compact);
    expect(arrowPath("full")).toBeNull();
  });

  it("switches its label and aria-expanded between the states", () => {
    const compact = render("compact").match(TOGGLE)?.[0] ?? "";
    expect(compact).toContain('aria-label="Розгорнути меню"');
    expect(compact).toContain('aria-expanded="false"');
    const expanded = render("expanded").match(TOGGLE)?.[0] ?? "";
    expect(expanded).toContain('aria-label="Згорнути меню"');
    expect(expanded).toContain('aria-expanded="true"');
  });
});
