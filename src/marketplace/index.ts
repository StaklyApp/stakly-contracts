/**
 * Marketplace federation v2 — schemas Zod du catalogue packs.
 *
 * Cible :
 *  - Endpoints publics AI-HUB central `/api/federated/v1/packs.*` (read-only)
 *  - Hub tRPC `marketplace.{list,fetch}` proxy
 *  - 5 packs canon Stakly seedés au démarrage (PCKDOC, PCKAIE, PCKTOOLS,
 *    PCKLLM, PCKSUPPORT)
 *
 * Sécurité :
 *  - IP whitelist Traefik (5 IPs Stakly + Docker internal)
 *  - Manifests signés ed25519 (V2 prépare la rotation cross-tenants)
 *  - Audit chain sha256 chaînée (pattern Sprint H killswitch)
 *
 * @see memo `project_marketplace_live_2026_04_22`
 * @see memo `project_marketplace_governance_quatuor_2026_06_08`
 * @see memo `project_inventaire_50_packs_2026_06_08`
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  PackSlugSchema                                                     */
/* ------------------------------------------------------------------ */

/**
 * Slug d'un pack — convention `[a-z][a-z0-9-]{2,40}`.
 *
 * Aligné avec l'inventaire 50 packs canon Stakly. Doit être stable, court,
 * URL-safe (utilisable dans `/packs.fetch?slug=`).
 */
export const PackSlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{2,40}$/, {
    message: "slug must be lowercase alphanumeric with dashes (3-41 chars)",
  });

export type PackSlug = z.infer<typeof PackSlugSchema>;

/* ------------------------------------------------------------------ */
/*  PackCategorySchema                                                 */
/* ------------------------------------------------------------------ */

/**
 * 7 catégories canon Stakly (cf. inventaire 50 packs 2026-06-08).
 *
 * - `universe` : 21 univers métier (BTP, médical, resto, etc.)
 * - `service`  : 8 services transverses (PCKDOC, PCKTOOLS, etc.)
 * - `skill`    : 3 skills réutilisables
 * - `agent`    : 2 packs agent (PCKAIE moteur IA)
 * - `infra`    : 6 packs infrastructure
 * - `hub`      : 4 packs Hub (PCKLLM, Display Engine, etc.)
 * - `mode`     : 1 mode UX (Focus, Multi-tabs)
 */
export const PackCategorySchema = z.enum([
  "universe",
  "service",
  "skill",
  "agent",
  "infra",
  "hub",
  "mode",
]);

export type PackCategory = z.infer<typeof PackCategorySchema>;

/* ------------------------------------------------------------------ */
/*  PackTrustLevelSchema                                               */
/* ------------------------------------------------------------------ */

/**
 * Niveau de confiance d'un publisher — référentiel Marketplace Trust Score.
 *
 * Cf. memo `project_marketplace_trust_score_2026_06_08`.
 */
export const PackTrustLevelSchema = z.enum([
  "unverified",
  "verified",
  "certified",
  "partner",
]);

export type PackTrustLevel = z.infer<typeof PackTrustLevelSchema>;

/* ------------------------------------------------------------------ */
/*  PackPricingTierSchema                                              */
/* ------------------------------------------------------------------ */

export const PackPricingTierSchema = z.enum([
  "free",
  "standard",
  "pro",
  "enterprise",
]);

export type PackPricingTier = z.infer<typeof PackPricingTierSchema>;

/* ------------------------------------------------------------------ */
/*  PackPublisherSchema                                                */
/* ------------------------------------------------------------------ */

export const PackPublisherSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  trust_level: PackTrustLevelSchema,
});

export type PackPublisher = z.infer<typeof PackPublisherSchema>;

/* ------------------------------------------------------------------ */
/*  PackPricingSchema                                                  */
/* ------------------------------------------------------------------ */

export const PackPricingSchema = z.object({
  tier: PackPricingTierSchema,
  /**
   * Prix mensuel en EUR. `null` autorisé (free tier explicit null Python),
   * `undefined` autorisé (champ omis).
   */
  monthly_eur: z.number().min(0).max(99999).nullable().optional(),
});

export type PackPricing = z.infer<typeof PackPricingSchema>;

/* ------------------------------------------------------------------ */
/*  PackManifestSchema                                                 */
/* ------------------------------------------------------------------ */

/**
 * Manifest d'un pack — descripteur public exposé via federation.
 *
 * - `version` : SemVer strict `\d+\.\d+\.\d+`
 * - `signature_ed25519` : hex 128 chars (64 bytes). Pour V2 stub, peut être
 *   un placeholder déterministe `seed:<slug>`.
 * - `published_at` : ISO 8601 UTC.
 */
export const PackManifestSchema = z.object({
  slug: PackSlugSchema,
  name: z.string().min(1).max(80),
  category: PackCategorySchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, {
    message: "version must be SemVer (e.g. 0.1.0)",
  }),
  description: z.string().min(1).max(280),
  publisher: PackPublisherSchema,
  pricing: PackPricingSchema,
  capabilities: z.array(z.string().min(1).max(64)).max(50),
  signature_ed25519: z.string().min(1).max(256),
  published_at: z.string(),
});

export type PackManifest = z.infer<typeof PackManifestSchema>;

/* ------------------------------------------------------------------ */
/*  MarketplaceAuditHeadSchema                                         */
/* ------------------------------------------------------------------ */

/**
 * Head de l'audit chain sha256 (pattern Sprint H killswitch).
 *
 * - `last_entry_at` : ISO 8601 du dernier append, null si vide
 * - `total_entries` : compteur entries depuis le boot du registre
 * - `hash` : sha256 hex du dernier entry, null si vide
 */
export const MarketplaceAuditHeadSchema = z.object({
  last_entry_at: z.string().nullable(),
  total_entries: z.number().int().min(0),
  hash: z.string().nullable(),
});

export type MarketplaceAuditHead = z.infer<typeof MarketplaceAuditHeadSchema>;

/* ------------------------------------------------------------------ */
/*  FederatedPacksListResponseSchema                                   */
/* ------------------------------------------------------------------ */

/**
 * Réponse `GET /api/federated/v1/packs.list`.
 *
 * Maxi 500 packs (catalogue total Stakly canonical + tiers).
 */
export const FederatedPacksListResponseSchema = z.object({
  packs: z.array(PackManifestSchema).max(500),
  total: z.number().int().min(0),
  audit_head: MarketplaceAuditHeadSchema.nullable(),
});

export type FederatedPacksListResponse = z.infer<
  typeof FederatedPacksListResponseSchema
>;

/* ------------------------------------------------------------------ */
/*  FederatedPacksFetchResponseSchema                                  */
/* ------------------------------------------------------------------ */

/**
 * Réponse `GET /api/federated/v1/packs.fetch?slug=...`.
 *
 * `install_instructions` est un hint humain (commande docker pull ou ref
 * github). Le client (Hub) le retransmet tel quel à l'UI.
 */
export const FederatedPacksFetchResponseSchema = z.object({
  pack: PackManifestSchema,
  install_instructions: z.string().min(1).max(2000).optional(),
});

export type FederatedPacksFetchResponse = z.infer<
  typeof FederatedPacksFetchResponseSchema
>;

/* ------------------------------------------------------------------ */
/*  FederatedPacksAuditHeadResponseSchema                              */
/* ------------------------------------------------------------------ */

/**
 * Réponse `GET /api/federated/v1/packs.audit_head` — équivaut à
 * `MarketplaceAuditHeadSchema` avec garantie de non-null (état initial
 * vide = `{ last_entry_at: null, total_entries: 0, hash: null }`).
 */
export const FederatedPacksAuditHeadResponseSchema = MarketplaceAuditHeadSchema;

export type FederatedPacksAuditHeadResponse = z.infer<
  typeof FederatedPacksAuditHeadResponseSchema
>;
