import { describe, expect, it } from "vitest";
import { feedCommandForKey } from "./keyboard";

describe("feed keyboard", () => {
  it("maps arrows and space", () => {
    expect(feedCommandForKey({ key: "ArrowRight", targetTag: "BODY" })).toBe(
      "like",
    );
    expect(feedCommandForKey({ key: "ArrowLeft", targetTag: "BODY" })).toBe(
      "skip",
    );
    expect(feedCommandForKey({ key: " ", targetTag: "BODY" })).toBe("flip");
  });

  it("ignores other keys and shortcuts with modifiers", () => {
    expect(feedCommandForKey({ key: "Enter" })).toBeNull();
    expect(feedCommandForKey({ key: "ArrowLeft", altKey: true })).toBeNull();
    expect(feedCommandForKey({ key: "ArrowRight", metaKey: true })).toBeNull();
  });

  it("leaves space to a focused button", () => {
    expect(feedCommandForKey({ key: " ", targetTag: "BUTTON" })).toBeNull();
    expect(feedCommandForKey({ key: "ArrowRight", targetTag: "BUTTON" })).toBe(
      "like",
    );
  });

  it("never fires inside form fields", () => {
    expect(
      feedCommandForKey({ key: "ArrowLeft", targetTag: "INPUT" }),
    ).toBeNull();
    expect(feedCommandForKey({ key: " ", targetEditable: true })).toBeNull();
  });
});
