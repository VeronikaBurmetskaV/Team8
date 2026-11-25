import { describe, expect, it } from "vitest";
import type { BrandProfileResponse } from "../../api/types";
import {
  consentCheckbox,
  consentTransition,
  toConsentRequest,
  type ConsentEvent,
  type ConsentStep,
} from "./consent";
import { CONSENT_TEXT } from "./profileForm";

const activeProfile: BrandProfileResponse = {
  name: "Лляна",
  websiteUrl: "https://lileya.com.ua",
  logoImageId: null,
  logoUrl: null,
  consentGiven: false,
  logoDisplayUrl: null,
  consentGivenAt: null,
  consentText: null,
  state: "ACTIVE",
  feedUrl: null,
  siteDomain: null,
  siteVerifiedAt: null,
  verificationToken: null,
};

const consentedProfile: BrandProfileResponse = {
  ...activeProfile,
  consentGiven: true,
  consentGivenAt: "2026-11-23T10:00:00Z",
  consentText: CONSENT_TEXT,
  state: "CONSENTED",
};

const incompleteProfile: BrandProfileResponse = {
  ...activeProfile,
  name: null,
  state: "INCOMPLETE",
};

/** Runs events from `idle` and collects whether any of them saved. */
function run(profile: BrandProfileResponse, events: ConsentEvent[]) {
  let step: ConsentStep = "idle";
  let saves = 0;
  for (const event of events) {
    const next = consentTransition(step, event, profile);
    step = next.step;
    if (next.save) saves += 1;
  }
  return { step, saves };
}

describe("consent checkbox", () => {
  it("ticking opens the confirmation and does not save yet", () => {
    expect(run(activeProfile, ["tick"])).toEqual({
      step: "confirming",
      saves: 0,
    });
    expect(consentCheckbox(activeProfile, "confirming")).toEqual({
      checked: false,
      disabled: false,
    });
  });

  it("«Скасувати» saves nothing and leaves the box unticked", () => {
    const result = run(activeProfile, ["tick", "cancel"]);
    expect(result).toEqual({ step: "idle", saves: 0 });
    expect(consentCheckbox(activeProfile, result.step).checked).toBe(false);
  });

  it("«Підтвердити» saves once and locks the box while the request runs", () => {
    const result = run(activeProfile, ["tick", "confirm"]);
    expect(result).toEqual({ step: "saving", saves: 1 });
    expect(consentCheckbox(activeProfile, "saving")).toEqual({
      checked: true,
      disabled: true,
    });
  });

  it("a failed save unticks the box again", () => {
    const result = run(activeProfile, ["tick", "confirm", "saveFailed"]);
    expect(result.step).toBe("idle");
    expect(consentCheckbox(activeProfile, result.step)).toEqual({
      checked: false,
      disabled: false,
    });
  });

  it("cannot be unticked after consent: ticked and disabled in every step", () => {
    for (const step of ["idle", "confirming", "saving"] as const) {
      expect(consentCheckbox(consentedProfile, step)).toEqual({
        checked: true,
        disabled: true,
      });
    }
    // No event starts a new save either.
    expect(run(consentedProfile, ["tick", "confirm"]).saves).toBe(0);
  });

  it("needs a saved brand name first", () => {
    expect(consentCheckbox(incompleteProfile, "idle").disabled).toBe(true);
    expect(run(incompleteProfile, ["tick", "confirm"]).saves).toBe(0);
  });
});

describe("toConsentRequest", () => {
  it("sends the saved name and logo with consentGiven: true", () => {
    expect(
      toConsentRequest({
        ...activeProfile,
        logoUrl: "https://cdn.brand-site.ua/logo.png",
      }),
    ).toEqual({
      name: "Лляна",
      // the saved website goes back unchanged: the consent save must not clear it
      websiteUrl: "https://lileya.com.ua",
      feedUrl: null,
      logoImageId: null,
      logoUrl: "https://cdn.brand-site.ua/logo.png",
      consentGiven: true,
    });
  });
});
