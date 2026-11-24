import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  Dropdown,
  DropdownView,
  dropdownStep,
  type DropdownEvent,
  type DropdownState,
} from "./Dropdown";

const OPTIONS = [
  { value: "UA", label: "UA" },
  { value: "EN", label: "EN" },
  { value: "PL", label: "PL" },
] as const;

const CLOSED: DropdownState = { open: false, active: -1 };

/** Runs events from a state; `selected` is the index of the current value. */
function run(events: DropdownEvent[], selected = 0, from = CLOSED) {
  let state = from;
  const picks: number[] = [];
  let focusButton = false;
  for (const event of events) {
    const step = dropdownStep(state, event, OPTIONS.length, selected);
    state = step.state;
    if (step.pick !== undefined) picks.push(step.pick);
    focusButton = step.focusButton ?? false;
  }
  return { state, picks, focusButton };
}

const key = (k: string): DropdownEvent => ({ type: "key", key: k });

function html(state: DropdownState) {
  return renderToString(
    <DropdownView
      label="Мова"
      options={OPTIONS}
      value="EN"
      state={state}
      ids={{ label: "l", button: "b", list: "x" }}
      reduceMotion
      onEvent={() => {}}
    />,
  );
}

describe("Dropdown", () => {
  it("closed: a button that names a listbox, no list in the page", () => {
    const markup = html(CLOSED);
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-labelledby="l b"');
    expect(markup).toMatch(/<span id="l"[^>]*>Мова<\/span>/);
    expect(markup).not.toContain('role="listbox"');
  });

  it("a click opens the list on the current value; open markup is a listbox", () => {
    const { state } = run([{ type: "toggle" }], 1);
    expect(state).toEqual({ open: true, active: 1 });

    const markup = html(state);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-controls="x"');
    expect(markup).toMatch(/role="listbox"/);
    expect(markup).toContain('aria-activedescendant="x-option-1"');
    expect(markup.match(/role="option"/g)).toHaveLength(3);
    expect(markup).toMatch(
      /id="x-option-1" role="option" aria-selected="true"/,
    );
    expect(markup).toMatch(
      /id="x-option-0" role="option" aria-selected="false"/,
    );
  });

  it("a second click closes it", () => {
    expect(run([{ type: "toggle" }, { type: "toggle" }]).state.open).toBe(
      false,
    );
  });

  it("a click on an option chooses it, closes and returns the focus", () => {
    const result = run([{ type: "toggle" }, { type: "pick", index: 2 }]);
    expect(result.picks).toEqual([2]);
    expect(result.state.open).toBe(false);
    expect(result.focusButton).toBe(true);
  });

  it("Esc closes without choosing and returns the focus", () => {
    const result = run([{ type: "toggle" }, key("ArrowDown"), key("Escape")]);
    expect(result.state.open).toBe(false);
    expect(result.picks).toEqual([]);
    expect(result.focusButton).toBe(true);
    expect(
      dropdownStep({ open: true, active: 0 }, key("Escape"), 3, 0).handled,
    ).toBe(true);
  });

  it("a click outside closes without choosing", () => {
    const result = run([{ type: "toggle" }, { type: "outside" }]);
    expect(result.state.open).toBe(false);
    expect(result.picks).toEqual([]);
  });

  it("keyboard: arrows open and move without wrapping, Enter and Space choose", () => {
    expect(run([key("ArrowDown")]).state).toEqual({ open: true, active: 0 });
    expect(run([key("Enter")], 2).state).toEqual({ open: true, active: 2 });
    expect(run([key(" ")]).state.open).toBe(true);

    const moved = run([
      key("ArrowDown"),
      key("ArrowDown"),
      key("ArrowDown"),
      key("ArrowDown"),
    ]);
    expect(moved.state.active).toBe(2); // stops at the last option
    expect(
      run([key("ArrowDown"), key("ArrowUp"), key("ArrowUp")]).state.active,
    ).toBe(0);
    expect(run([key("ArrowDown"), key("End")]).state.active).toBe(2);
    expect(run([key("ArrowDown"), key("End"), key("Home")]).state.active).toBe(
      0,
    );

    const enter = run([key("ArrowDown"), key("ArrowDown"), key("Enter")]);
    expect(enter.picks).toEqual([1]);
    expect(enter.state.open).toBe(false);
    expect(enter.focusButton).toBe(true);

    const space = run([key("ArrowDown"), key("End"), key(" ")]);
    expect(space.picks).toEqual([2]);
  });

  it("Tab closes and lets the focus move on; other keys are left alone", () => {
    const tab = dropdownStep({ open: true, active: 1 }, key("Tab"), 3, 1);
    expect(tab.state.open).toBe(false);
    expect(tab.handled).toBeFalsy();
    expect(tab.focusButton).toBeFalsy();
    expect(dropdownStep(CLOSED, key("a"), 3, 0).handled).toBeFalsy();
  });

  it("hover highlights an option only while open", () => {
    expect(
      run([{ type: "toggle" }, { type: "hover", index: 2 }]).state.active,
    ).toBe(2);
    expect(run([{ type: "hover", index: 2 }]).state).toEqual(CLOSED);
  });

  it("renders the current value's label on the button", () => {
    const markup = renderToString(
      <Dropdown
        label="Місто"
        options={[{ value: "kyiv", label: "Київ" }]}
        value="kyiv"
        onChange={vi.fn()}
      />,
    );
    expect(markup).toContain("Київ");
    expect(markup).toContain('title="Місто"');
  });
});
