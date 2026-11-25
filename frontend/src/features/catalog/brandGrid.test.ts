import { describe, expect, it } from "vitest";
import { brandOptions } from "./catalog";
import {
  BRAND_TILE_ROWS,
  MONOGRAM_COLORS,
  brandColor,
  brandTileColumns,
  hasHiddenBrandTiles,
  monogram,
  monogramStyle,
  showBrandTiles,
  visibleBrandTiles,
} from "./brandGrid";

describe("monogram", () => {
  it("takes the first two letters of a one-word name", () => {
    expect(monogram("Barricade")).toBe("BA");
    expect(monogram("gunia")).toBe("GU");
    expect(monogram("їжа")).toBe("ЇЖ");
  });

  it("takes the first letters of the first two words", () => {
    expect(monogram("Lucky Humanoid")).toBe("LH");
    expect(monogram("  bevza   studio  kyiv ")).toBe("BS");
    expect(monogram("Ksenia-Schnaider")).toBe("KS");
  });

  it("skips apostrophes and digits after the letters", () => {
    expect(monogram("CHER'17")).toBe("CH");
    expect(monogram("Cher'17")).toBe("CH");
    expect(monogram("'Mint")).toBe("MI");
  });

  it("uses digits only when a word has no letters", () => {
    expect(monogram("1991")).toBe("19");
    expect(monogram("Studio 7")).toBe("S7");
  });

  it("gives one letter for a one-letter name and nothing for signs only", () => {
    expect(monogram("A")).toBe("A");
    expect(monogram("— ")).toBe("");
  });
});

describe("brandColor", () => {
  it("is the same for the same key", () => {
    for (const key of ["barricade", "cher'17", "lucky humanoid", "мінт"]) {
      expect(brandColor(key)).toBe(brandColor(key));
      expect(MONOGRAM_COLORS).toContain(brandColor(key));
    }
  });

  it("spreads brands over several colours", () => {
    const keys = Array.from({ length: 40 }, (_, index) => `brand ${index}`);
    expect(new Set(keys.map(brandColor)).size).toBeGreaterThan(3);
  });

  it("points the tile at the token pair of that colour", () => {
    const color = brandColor("barricade");
    expect(monogramStyle("barricade")).toEqual({
      "--monogram-bg": `var(--monogram-${color}-bg)`,
      "--monogram-fg": `var(--monogram-${color}-fg)`,
    });
  });
});

describe("brand tile grid", () => {
  const options = brandOptions(
    Array.from({ length: 10 }, (_, index) => ({ brandName: `Brand ${index}` })),
  );

  it("has 3, 4, 6 and 8 columns from phone to wide screen", () => {
    const none = { tablet: false, desktop: false, wide: false };
    expect(brandTileColumns(none)).toBe(3);
    expect(brandTileColumns({ ...none, tablet: true })).toBe(4);
    expect(brandTileColumns({ tablet: true, desktop: true, wide: false })).toBe(
      6,
    );
    expect(brandTileColumns({ tablet: true, desktop: true, wide: true })).toBe(
      8,
    );
  });

  it("shows two rows until expanded", () => {
    expect(BRAND_TILE_ROWS).toBe(2);
    expect(visibleBrandTiles(options, 3, false)).toHaveLength(6);
    expect(visibleBrandTiles(options, 3, true)).toHaveLength(10);
    expect(hasHiddenBrandTiles(options, 3)).toBe(true);
    expect(hasHiddenBrandTiles(options, 6)).toBe(false);
  });
});

describe("showBrandTiles", () => {
  const clean = {
    status: "success" as const,
    activeFilters: 0,
    singleBrandView: false,
    brandCount: 4,
  };

  it("shows the block on the clean home page and while loading", () => {
    expect(showBrandTiles(clean)).toBe(true);
    expect(showBrandTiles({ ...clean, status: "pending", brandCount: 0 })).toBe(
      true,
    );
  });

  it("hides it with any filter, on a brand page, without brands, on error", () => {
    expect(showBrandTiles({ ...clean, activeFilters: 1 })).toBe(false);
    expect(showBrandTiles({ ...clean, singleBrandView: true })).toBe(false);
    expect(showBrandTiles({ ...clean, brandCount: 0 })).toBe(false);
    expect(showBrandTiles({ ...clean, status: "error" })).toBe(false);
  });
});
