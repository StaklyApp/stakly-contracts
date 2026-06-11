import { describe, expect, it } from "vitest";
import {
  AppDescriptorSchema,
  AppsListInputSchema,
  AppsListOutputSchema,
  AppsListSchema,
  DEFAULT_APPS_CANON,
  UniverseColorTokenSchema,
  UniverseSlugSchema,
} from "./index.js";

describe("Apps — UniverseSlug", () => {
  it("expose 7 univers canon", () => {
    expect(UniverseSlugSchema.options).toHaveLength(7);
    expect(UniverseSlugSchema.options).toEqual([
      "accueil",
      "marketing",
      "ventes",
      "rh",
      "compta",
      "support",
      "infrastructure",
    ]);
  });

  it("rejette un slug inconnu", () => {
    expect(UniverseSlugSchema.safeParse("finance").success).toBe(false);
  });
});

describe("Apps — UniverseColorToken", () => {
  it("expose 6 tokens (sans accueil)", () => {
    expect(UniverseColorTokenSchema.options).toHaveLength(6);
    expect(UniverseColorTokenSchema.options).toContain("ops");
  });
});

describe("Apps — AppDescriptor", () => {
  it("valide un descriptor complet", () => {
    const ok = AppDescriptorSchema.parse({
      slug: "marketing",
      label: "Marketing",
      icon: "megaphone",
      href: "/univers/marketing",
      color_token: "marketing",
      sequence: 200,
      acl_granted: true,
    });
    expect(ok.slug).toBe("marketing");
  });

  it("accepte color_token null (accueil)", () => {
    const ok = AppDescriptorSchema.parse({
      slug: "accueil",
      label: "Accueil",
      icon: "home",
      href: "/univers/accueil",
      color_token: null,
      sequence: 100,
      acl_granted: true,
    });
    expect(ok.color_token).toBeNull();
  });

  it("accepte pinTags optionnel", () => {
    const ok = AppDescriptorSchema.parse({
      slug: "accueil",
      label: "Accueil",
      icon: "home",
      href: "/univers/accueil",
      color_token: null,
      sequence: 100,
      acl_granted: true,
      pinTags: ["direction", "ops"],
    });
    expect(ok.pinTags).toEqual(["direction", "ops"]);
  });

  it("rejette un slug hors canon 7", () => {
    const r = AppDescriptorSchema.safeParse({
      slug: "shopify",
      label: "Shopify",
      icon: "shopping-cart",
      href: "/univers/shopify",
      color_token: null,
      sequence: 999,
      acl_granted: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejette label vide", () => {
    const r = AppDescriptorSchema.safeParse({
      slug: "marketing",
      label: "",
      icon: "megaphone",
      href: "/univers/marketing",
      color_token: "marketing",
      sequence: 200,
      acl_granted: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejette acl_granted non-boolean", () => {
    const r = AppDescriptorSchema.safeParse({
      slug: "rh",
      label: "RH",
      icon: "users",
      href: "/univers/rh",
      color_token: "rh",
      sequence: 600,
      acl_granted: "yes" as unknown as boolean,
    });
    expect(r.success).toBe(false);
  });
});

describe("Apps — AppsList", () => {
  it("valide DEFAULT_APPS_CANON contre AppsListSchema", () => {
    const parsed = AppsListSchema.parse([...DEFAULT_APPS_CANON]);
    expect(parsed).toHaveLength(7);
  });

  it("accepte une liste vide", () => {
    expect(AppsListSchema.parse([])).toEqual([]);
  });
});

describe("Apps — AppsListInput", () => {
  it("accepte tenant optionnel", () => {
    expect(AppsListInputSchema.parse({}).tenant).toBeUndefined();
    expect(AppsListInputSchema.parse({ tenant: "000000" }).tenant).toBe(
      "000000",
    );
  });

  it("rejette champs en plus (strict mode)", () => {
    const r = AppsListInputSchema.safeParse({
      tenant: "000000",
      extra: "nope",
    });
    expect(r.success).toBe(false);
  });
});

describe("Apps — DEFAULT_APPS_CANON", () => {
  it("contient 7 univers ordonnés par sequence", () => {
    expect(DEFAULT_APPS_CANON).toHaveLength(7);
    const sequences = DEFAULT_APPS_CANON.map((a) => a.sequence);
    const sorted = [...sequences].sort((a, b) => a - b);
    expect(sequences).toEqual(sorted);
  });

  it("a tous les slugs distincts", () => {
    const slugs = DEFAULT_APPS_CANON.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("seul accueil a color_token null", () => {
    const nullTokens = DEFAULT_APPS_CANON.filter((a) => a.color_token === null);
    expect(nullTokens).toHaveLength(1);
    expect(nullTokens[0]?.slug).toBe("accueil");
  });

  it("est figé via Object.freeze", () => {
    expect(Object.isFrozen(DEFAULT_APPS_CANON)).toBe(true);
  });
});

describe("Apps — AppsListOutput", () => {
  it("alias = AppsListSchema", () => {
    const r = AppsListOutputSchema.parse([...DEFAULT_APPS_CANON]);
    expect(r).toHaveLength(7);
  });
});
