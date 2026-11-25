import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { BrandProfileResponse } from "../../api/types";
import { brandProfileQueryKey } from "../../shared/brandProfile";
import { BrandProfilePage } from "./BrandProfilePage";
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
};

const consentedProfile: BrandProfileResponse = {
  ...activeProfile,
  consentGiven: true,
  consentGivenAt: "2026-11-23T10:00:00Z",
  consentText: CONSENT_TEXT,
  state: "CONSENTED",
};

/** Renders /brand/profile as after a page load: the profile comes only from GET (the cache). */
function render(profile: BrandProfileResponse): string {
  const client = new QueryClient();
  client.setQueryData(brandProfileQueryKey, profile);
  return renderToString(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/brand/profile"]}>
        <BrandProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function checkbox(html: string): string {
  const match = html.match(/<input[^>]*type="checkbox"[^>]*>/);
  if (!match) throw new Error("no checkbox");
  return match[0];
}

describe("/brand/profile consent", () => {
  it("after a reload with saved consent the box is ticked and disabled", () => {
    const html = render(consentedProfile);
    expect(checkbox(html)).toContain('checked=""');
    expect(checkbox(html)).toContain('disabled=""');
    expect(html).toContain("Згоду надано 23.11.2026");
  });

  it("without consent the box is unticked and can be ticked", () => {
    const html = render(activeProfile);
    expect(checkbox(html)).not.toContain("checked");
    expect(checkbox(html)).not.toContain("disabled");
    expect(html).not.toContain("Згоду надано");
  });

  it("without a saved name the box is disabled with a hint", () => {
    const html = render({ ...activeProfile, name: null, state: "INCOMPLETE" });
    expect(checkbox(html)).toContain('disabled=""');
    expect(html).toContain("Спочатку збережіть назву бренду");
  });
});
