/**
 * Tests des schemas du pack Base documentaire (PCKDOC).
 *
 * Cible : +30 tests pour blinder le contrat lingua franca avant
 * publication v0.2.0.
 */

import { describe, expect, it } from "vitest";
import {
  DocumentAssetSchema,
  DocumentVersionSchema,
  DocumentRelationSchema,
  DocumentTagSchema,
  DocumentAccessLogSchema,
  DocumentRecommendationSchema,
  DocumentIndexationEventSchema,
  DocumentSearchInputSchema,
  DocumentSearchOutputSchema,
  DocumentRecommendInputSchema,
  DocumentCreateInputSchema,
  DocumentCreateOutputSchema,
  DocumentArchiveInputSchema,
  DocumentRelateInputSchema,
  DocumentAuditTrailOutputSchema,
  PiiCategorySchema,
  DlpScanResultSchema,
  DocumentWatermarkInputSchema,
  DocumentWatermarkOutputSchema,
  DocumentTypeSchema,
  DocumentTagSourceSchema,
  DocumentRelationKindSchema,
  DocumentAuditActionSchema,
  DocumentStorageBackendSchema,
  EmbeddingTierSchema,
  DlpModeSchema,
  McpDocumentToolNameSchema,
  MCP_DOCUMENT_TOOLS_CANON,
} from "./index.js";

const ISO_NOW = "2026-06-11T12:00:00.000Z";
const SHA256 = "a".repeat(64);

describe("Documents — Enums", () => {
  it("DocumentType expose 7 types", () => {
    expect(DocumentTypeSchema.options).toEqual([
      "markdown",
      "pdf",
      "docx",
      "xlsx",
      "image",
      "yaml",
      "other",
    ]);
  });

  it("DocumentTagSource = ai|human|system", () => {
    expect(DocumentTagSourceSchema.options).toEqual(["ai", "human", "system"]);
  });

  it("DocumentRelationKind = depends_on|replaces|related_to", () => {
    expect(DocumentRelationKindSchema.options).toEqual([
      "depends_on",
      "replaces",
      "related_to",
    ]);
  });

  it("DocumentAuditAction expose 7 actions canon", () => {
    expect(DocumentAuditActionSchema.options).toHaveLength(7);
    expect(DocumentAuditActionSchema.options).toContain("archive");
    expect(DocumentAuditActionSchema.options).toContain("share");
  });

  it("DocumentStorageBackend = 6 backends primaires", () => {
    expect(DocumentStorageBackendSchema.options).toEqual([
      "nextcloud",
      "odoo",
      "matrix",
      "github",
      "minio",
      "marketplace",
    ]);
  });

  it("EmbeddingTier = 3 tiers Knowledge Hub canon", () => {
    expect(EmbeddingTierSchema.options).toEqual(["local-bge", "voyage", "openai"]);
  });

  it("DlpMode = reject|redact|flag", () => {
    expect(DlpModeSchema.options).toEqual(["reject", "redact", "flag"]);
  });
});

describe("Documents — DocumentAsset", () => {
  const asset = {
    id: 1,
    name: "Brief PCKDOC 2026-06-10",
    type: "markdown" as const,
    path: "/docs/brief-pckdoc.md",
    size: 12_345,
    mime_type: "text/markdown",
    owner_id: 42,
    scope_id: "marketing",
    signature_ed25519: "ed25519:base64sig",
    state: "active" as const,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
    archived_at: null,
  };

  it("accepte un asset valide", () => {
    expect(() => DocumentAssetSchema.parse(asset)).not.toThrow();
  });

  it("rejette un asset sans owner_id", () => {
    const { owner_id: _, ...broken } = asset;
    expect(DocumentAssetSchema.safeParse(broken).success).toBe(false);
  });

  it("rejette un type inconnu", () => {
    expect(
      DocumentAssetSchema.safeParse({ ...asset, type: "video" }).success,
    ).toBe(false);
  });

  it("accepte signature_ed25519 = null (asset jamais signé encore)", () => {
    expect(
      DocumentAssetSchema.safeParse({ ...asset, signature_ed25519: null })
        .success,
    ).toBe(true);
  });
});

describe("Documents — DocumentVersion", () => {
  const v = {
    id: 11,
    asset_id: 1,
    version: "1.0.0",
    content_hash: SHA256,
    signed_by: 42,
    signature: "ed25519:sig",
    replaces_version_id: null,
    created_at: ISO_NOW,
  };

  it("accepte une version valide", () => {
    expect(() => DocumentVersionSchema.parse(v)).not.toThrow();
  });

  it("rejette un content_hash mal formé (pas 64 hex)", () => {
    expect(
      DocumentVersionSchema.safeParse({ ...v, content_hash: "abc123" })
        .success,
    ).toBe(false);
  });

  it("accepte replaces_version_id non-null", () => {
    expect(
      DocumentVersionSchema.safeParse({ ...v, replaces_version_id: 10 })
        .success,
    ).toBe(true);
  });
});

describe("Documents — DocumentRelation", () => {
  it("accepte une relation valide", () => {
    expect(() =>
      DocumentRelationSchema.parse({
        id: 99,
        from_asset: 1,
        to_asset: 2,
        kind: "depends_on",
        weight: 0.8,
        created_at: ISO_NOW,
      }),
    ).not.toThrow();
  });

  it("rejette self-relation (from == to)", () => {
    const result = DocumentRelationSchema.safeParse({
      id: 99,
      from_asset: 1,
      to_asset: 1,
      kind: "related_to",
      weight: 1.0,
      created_at: ISO_NOW,
    });
    expect(result.success).toBe(false);
  });

  it("rejette weight > 1", () => {
    expect(
      DocumentRelationSchema.safeParse({
        id: 99,
        from_asset: 1,
        to_asset: 2,
        kind: "related_to",
        weight: 1.5,
        created_at: ISO_NOW,
      }).success,
    ).toBe(false);
  });
});

describe("Documents — DocumentTag", () => {
  it("accepte un tag IA avec confidence 75", () => {
    expect(() =>
      DocumentTagSchema.parse({
        id: 1,
        asset_id: 1,
        tag: "marketing",
        source: "ai",
        confidence: 75,
      }),
    ).not.toThrow();
  });

  it("rejette confidence > 100", () => {
    expect(
      DocumentTagSchema.safeParse({
        id: 1,
        asset_id: 1,
        tag: "x",
        source: "human",
        confidence: 150,
      }).success,
    ).toBe(false);
  });
});

describe("Documents — DocumentAccessLog", () => {
  it("accepte un log d'audit valide", () => {
    expect(() =>
      DocumentAccessLogSchema.parse({
        id: 1,
        asset_id: 1,
        user_id: 42,
        action: "read",
        scope_id: "marketing",
        signature: "ed25519:sig",
        timestamp: ISO_NOW,
      }),
    ).not.toThrow();
  });

  it("rejette une action non-canon", () => {
    expect(
      DocumentAccessLogSchema.safeParse({
        id: 1,
        asset_id: 1,
        user_id: 42,
        action: "haxxor",
        scope_id: "x",
        signature: "x",
        timestamp: ISO_NOW,
      }).success,
    ).toBe(false);
  });
});

describe("Documents — Indexation event", () => {
  it("accepte un event Nextcloud asset.created", () => {
    expect(() =>
      DocumentIndexationEventSchema.parse({
        kind: "asset.created",
        source: "nextcloud",
        tenant_id: "000003",
        asset_id: 1,
        content_hash: SHA256,
        path: "/Docs/brief.md",
        type: "markdown",
        emitted_at: ISO_NOW,
      }),
    ).not.toThrow();
  });

  it("rejette un tenant_id vide", () => {
    expect(
      DocumentIndexationEventSchema.safeParse({
        kind: "asset.created",
        source: "nextcloud",
        tenant_id: "",
        asset_id: 1,
        content_hash: SHA256,
        path: "/x.md",
        type: "markdown",
        emitted_at: ISO_NOW,
      }).success,
    ).toBe(false);
  });
});

describe("Documents — Search", () => {
  it("accepte un search input minimal", () => {
    const parsed = DocumentSearchInputSchema.parse({ query: "rgpd" });
    expect(parsed.limit).toBe(10);
  });

  it("rejette une query vide", () => {
    expect(DocumentSearchInputSchema.safeParse({ query: "" }).success).toBe(
      false,
    );
  });

  it("valide un search output", () => {
    expect(() =>
      DocumentSearchOutputSchema.parse({
        hits: [
          {
            asset_id: 1,
            title: "doc",
            snippet: "snip",
            score: 0.9,
            type: "markdown",
          },
        ],
        truncated: false,
      }),
    ).not.toThrow();
  });
});

describe("Documents — Recommend", () => {
  it("accepte un recommend input avec defaut limit=5", () => {
    const parsed = DocumentRecommendInputSchema.parse({
      context_scope: "marketing",
    });
    expect(parsed.limit).toBe(5);
  });
});

describe("Documents — Create/Archive/Relate inputs", () => {
  it("DocumentCreateInput accepte un payload markdown minimal", () => {
    expect(() =>
      DocumentCreateInputSchema.parse({
        name: "x",
        type: "markdown",
        path: "/docs/x.md",
        scope_id: "rh",
      }),
    ).not.toThrow();
  });

  it("DocumentCreateOutput exige un signature ed25519", () => {
    expect(
      DocumentCreateOutputSchema.safeParse({
        asset_id: 1,
        content_hash: SHA256,
      }).success,
    ).toBe(false);
  });

  it("DocumentArchiveInput accepte sans reason", () => {
    expect(() =>
      DocumentArchiveInputSchema.parse({ asset_id: 1 }),
    ).not.toThrow();
  });

  it("DocumentRelateInput rejette self-relate", () => {
    expect(
      DocumentRelateInputSchema.safeParse({
        from_asset: 5,
        to_asset: 5,
        kind: "related_to",
      }).success,
    ).toBe(false);
  });
});

describe("Documents — Audit trail", () => {
  it("accepte un trail avec chain_valid=true", () => {
    expect(() =>
      DocumentAuditTrailOutputSchema.parse({
        logs: [],
        chain_valid: true,
      }),
    ).not.toThrow();
  });
});

describe("Documents — DLP", () => {
  it("PiiCategory expose 6 catégories", () => {
    expect(PiiCategorySchema.options).toHaveLength(6);
    expect(PiiCategorySchema.options).toContain("email");
    expect(PiiCategorySchema.options).toContain("iban");
  });

  it("DlpScanResult avec mode=reject + blocked=true", () => {
    expect(() =>
      DlpScanResultSchema.parse({
        hits: [{ category: "email", redacted: "***@x.com", offset: 5 }],
        mode: "reject",
        blocked: true,
        redacted_content: null,
      }),
    ).not.toThrow();
  });

  it("DlpScanResult avec mode=redact + content non-null", () => {
    expect(() =>
      DlpScanResultSchema.parse({
        hits: [],
        mode: "redact",
        blocked: false,
        redacted_content: "Hello [REDACTED]",
      }),
    ).not.toThrow();
  });
});

describe("Documents — Watermark", () => {
  it("DocumentWatermarkInput accepte default flavor", () => {
    const parsed = DocumentWatermarkInputSchema.parse({
      asset_id: 1,
      user_id: 42,
    });
    expect(parsed.flavor).toBe("both");
  });

  it("DocumentWatermarkOutput exige hash sha256", () => {
    expect(
      DocumentWatermarkOutputSchema.safeParse({
        watermarked_path: "/x.pdf",
        watermark_hash: "abc",
      }).success,
    ).toBe(false);
  });
});

describe("Documents — MCP catalog", () => {
  it("McpDocumentToolName liste les 12 tools canon", () => {
    expect(McpDocumentToolNameSchema.options).toHaveLength(12);
  });

  it("MCP_DOCUMENT_TOOLS_CANON contient document_recommend", () => {
    const names = MCP_DOCUMENT_TOOLS_CANON.map((t) => t.name);
    expect(names).toContain("document_recommend");
    expect(names).toContain("document_attach_to_email");
  });

  it("MCP_DOCUMENT_TOOLS_CANON est gelé", () => {
    expect(Object.isFrozen(MCP_DOCUMENT_TOOLS_CANON)).toBe(true);
  });

  it("Chaque tool a une description non-vide", () => {
    for (const tool of MCP_DOCUMENT_TOOLS_CANON) {
      expect(tool.description.length).toBeGreaterThan(5);
    }
  });
});

describe("Documents — DocumentRecommendation", () => {
  it("accepte une recommandation cache", () => {
    expect(() =>
      DocumentRecommendationSchema.parse({
        id: 1,
        context_scope: "marketing",
        asset_ids: [1, 2, 3],
        score: 0.85,
        computed_at: ISO_NOW,
      }),
    ).not.toThrow();
  });

  it("rejette score > 1", () => {
    expect(
      DocumentRecommendationSchema.safeParse({
        id: 1,
        context_scope: "x",
        asset_ids: [],
        score: 1.5,
        computed_at: ISO_NOW,
      }).success,
    ).toBe(false);
  });
});
