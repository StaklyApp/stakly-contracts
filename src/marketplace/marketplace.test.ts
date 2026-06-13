/**
 * Tests Vitest — schemas Marketplace federation v2.
 */

import { describe, it, expect } from "vitest";
import {
  PackSlugSchema,
  PackCategorySchema,
  PackTrustLevelSchema,
  PackPricingTierSchema,
  PackPublisherSchema,
  PackPricingSchema,
  PackManifestSchema,
  MarketplaceAuditHeadSchema,
  FederatedPacksListResponseSchema,
  FederatedPacksFetchResponseSchema,
  FederatedPacksAuditHeadResponseSchema,
} from "./index.js";

describe("PackSlugSchema", () => {
  it("accepts valid slugs", () => {
    expect(PackSlugSchema.parse("pckdoc")).toBe("pckdoc");
    expect(PackSlugSchema.parse("pck-llm-hub")).toBe("pck-llm-hub");
    expect(PackSlugSchema.parse("universe-btp")).toBe("universe-btp");
  });

  it("rejects slugs with uppercase, underscores or starting with digit", () => {
    expect(PackSlugSchema.safeParse("PCKDOC").success).toBe(false);
    expect(PackSlugSchema.safeParse("pck_doc").success).toBe(false);
    expect(PackSlugSchema.safeParse("1pack").success).toBe(false);
    expect(PackSlugSchema.safeParse("ab").success).toBe(false);
    expect(PackSlugSchema.safeParse("a".repeat(60)).success).toBe(false);
  });
});

describe("PackCategorySchema", () => {
  it("accepts the 7 canonical categories", () => {
    for (const cat of [
      "universe",
      "service",
      "skill",
      "agent",
      "infra",
      "hub",
      "mode",
    ] as const) {
      expect(PackCategorySchema.parse(cat)).toBe(cat);
    }
  });

  it("rejects unknown categories", () => {
    expect(PackCategorySchema.safeParse("xxx").success).toBe(false);
  });
});

describe("PackTrustLevelSchema", () => {
  it("accepts the 4 trust levels", () => {
    expect(PackTrustLevelSchema.parse("unverified")).toBe("unverified");
    expect(PackTrustLevelSchema.parse("partner")).toBe("partner");
  });
});

describe("PackPricingTierSchema", () => {
  it("accepts the 4 pricing tiers", () => {
    expect(PackPricingTierSchema.parse("free")).toBe("free");
    expect(PackPricingTierSchema.parse("enterprise")).toBe("enterprise");
  });
});

describe("PackPublisherSchema", () => {
  it("accepts a valid publisher", () => {
    const p = PackPublisherSchema.parse({
      id: "stakly-canonical",
      name: "Stakly Canonical",
      trust_level: "certified",
    });
    expect(p.name).toBe("Stakly Canonical");
  });

  it("rejects empty id or name", () => {
    expect(
      PackPublisherSchema.safeParse({
        id: "",
        name: "x",
        trust_level: "verified",
      }).success,
    ).toBe(false);
  });
});

describe("PackPricingSchema", () => {
  it("accepts pricing without monthly_eur (free tier)", () => {
    expect(PackPricingSchema.parse({ tier: "free" }).tier).toBe("free");
  });

  it("accepts pricing with monthly_eur", () => {
    expect(
      PackPricingSchema.parse({ tier: "pro", monthly_eur: 29 }).monthly_eur,
    ).toBe(29);
  });

  it("rejects negative or overflowing monthly_eur", () => {
    expect(
      PackPricingSchema.safeParse({ tier: "pro", monthly_eur: -1 }).success,
    ).toBe(false);
    expect(
      PackPricingSchema.safeParse({ tier: "pro", monthly_eur: 100000 }).success,
    ).toBe(false);
  });
});

describe("PackManifestSchema", () => {
  const valid = {
    slug: "pckdoc",
    name: "Base documentaire",
    category: "service" as const,
    version: "0.1.0",
    description: "Pack base documentaire canonique Stakly.",
    publisher: {
      id: "stakly-canonical",
      name: "Stakly Canonical",
      trust_level: "certified" as const,
    },
    pricing: { tier: "standard" as const, monthly_eur: 3 },
    capabilities: ["docs.search", "docs.index"],
    signature_ed25519: "seed:pckdoc",
    published_at: "2026-06-13T00:00:00Z",
  };

  it("accepts a valid manifest", () => {
    expect(PackManifestSchema.parse(valid).slug).toBe("pckdoc");
  });

  it("rejects non-SemVer version", () => {
    expect(
      PackManifestSchema.safeParse({ ...valid, version: "v1" }).success,
    ).toBe(false);
    expect(
      PackManifestSchema.safeParse({ ...valid, version: "0.1" }).success,
    ).toBe(false);
  });

  it("rejects empty signature", () => {
    expect(
      PackManifestSchema.safeParse({ ...valid, signature_ed25519: "" }).success,
    ).toBe(false);
  });

  it("rejects description over 280 chars", () => {
    expect(
      PackManifestSchema.safeParse({ ...valid, description: "x".repeat(281) })
        .success,
    ).toBe(false);
  });

  it("rejects more than 50 capabilities", () => {
    expect(
      PackManifestSchema.safeParse({
        ...valid,
        capabilities: Array.from({ length: 51 }, (_, i) => `cap${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("MarketplaceAuditHeadSchema", () => {
  it("accepts a populated head", () => {
    expect(
      MarketplaceAuditHeadSchema.parse({
        last_entry_at: "2026-06-13T00:00:00Z",
        total_entries: 5,
        hash: "abc",
      }).total_entries,
    ).toBe(5);
  });

  it("accepts an empty head (nulls)", () => {
    expect(
      MarketplaceAuditHeadSchema.parse({
        last_entry_at: null,
        total_entries: 0,
        hash: null,
      }).hash,
    ).toBeNull();
  });
});

describe("FederatedPacksListResponseSchema", () => {
  const manifest = {
    slug: "pckdoc",
    name: "Base documentaire",
    category: "service" as const,
    version: "0.1.0",
    description: "x",
    publisher: {
      id: "p",
      name: "Stakly",
      trust_level: "certified" as const,
    },
    pricing: { tier: "free" as const },
    capabilities: [],
    signature_ed25519: "seed",
    published_at: "2026-06-13T00:00:00Z",
  };

  it("accepts a valid list response", () => {
    const r = FederatedPacksListResponseSchema.parse({
      packs: [manifest],
      total: 1,
      audit_head: { last_entry_at: null, total_entries: 0, hash: null },
    });
    expect(r.total).toBe(1);
  });

  it("accepts null audit_head", () => {
    const r = FederatedPacksListResponseSchema.parse({
      packs: [],
      total: 0,
      audit_head: null,
    });
    expect(r.audit_head).toBeNull();
  });

  it("rejects more than 500 packs", () => {
    expect(
      FederatedPacksListResponseSchema.safeParse({
        packs: Array.from({ length: 501 }, () => manifest),
        total: 501,
        audit_head: null,
      }).success,
    ).toBe(false);
  });
});

describe("FederatedPacksFetchResponseSchema", () => {
  const manifest = {
    slug: "pckdoc",
    name: "Base documentaire",
    category: "service" as const,
    version: "0.1.0",
    description: "x",
    publisher: {
      id: "p",
      name: "Stakly",
      trust_level: "certified" as const,
    },
    pricing: { tier: "free" as const },
    capabilities: [],
    signature_ed25519: "seed",
    published_at: "2026-06-13T00:00:00Z",
  };

  it("accepts a manifest with install_instructions", () => {
    const r = FederatedPacksFetchResponseSchema.parse({
      pack: manifest,
      install_instructions: "docker pull ghcr.io/staklyapp/pckdoc:latest",
    });
    expect(r.install_instructions).toContain("docker");
  });

  it("accepts a manifest without install_instructions", () => {
    const r = FederatedPacksFetchResponseSchema.parse({ pack: manifest });
    expect(r.install_instructions).toBeUndefined();
  });
});

describe("FederatedPacksAuditHeadResponseSchema", () => {
  it("matches MarketplaceAuditHeadSchema (alias)", () => {
    const r = FederatedPacksAuditHeadResponseSchema.parse({
      last_entry_at: null,
      total_entries: 0,
      hash: null,
    });
    expect(r.total_entries).toBe(0);
  });
});
