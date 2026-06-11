/**
 * Documents — schemas Zod du pack Base documentaire (PCKDOC).
 *
 * Aligné contrat : `CTR__L1_000000_PCKDOC_001.000.000_2026061001.yml`.
 *
 * Architecture "Document Proactif" 4 couches :
 *   1. Stockage primaire (Nextcloud + Odoo + Matrix + GitHub canon)
 *   2. Indexation continue (webhook -> background indexer -> Qdrant + KG)
 *   3. Retrieval intelligent (hybrid dense+sparse RRF + ACL multi-héritage)
 *   4. Présentation contextuelle (tile DOC-PERTIN + Cmd+K)
 *
 * Conventions Stakly :
 *   - perm_unlink = 0 (archive jamais delete)
 *   - signature ed25519 sur audit log
 *   - ACL multi-héritage INTERSECTION (un seul forbidden = refus)
 *   - humain ne voit JAMAIS un 44C en UI client
 *
 * @see memo `project_pack_base_documentaire_2026_06_10`
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Types primitifs                                                   */
/* ------------------------------------------------------------------ */

/**
 * Type de document supporté côté stockage primaire.
 */
export const DocumentTypeSchema = z.enum([
  "markdown",
  "pdf",
  "docx",
  "xlsx",
  "image",
  "yaml",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/**
 * Backend de stockage primaire (couche 1 du Document Proactif).
 */
export const DocumentStorageBackendSchema = z.enum([
  "nextcloud",
  "odoo",
  "matrix",
  "github",
  "minio",
  "marketplace",
]);
export type DocumentStorageBackend = z.infer<
  typeof DocumentStorageBackendSchema
>;

/**
 * Source d'un tag (humain prioritaire sur IA).
 */
export const DocumentTagSourceSchema = z.enum(["ai", "human", "system"]);
export type DocumentTagSource = z.infer<typeof DocumentTagSourceSchema>;

/**
 * Kind d'une relation dans le knowledge graph.
 */
export const DocumentRelationKindSchema = z.enum([
  "depends_on",
  "replaces",
  "related_to",
]);
export type DocumentRelationKind = z.infer<typeof DocumentRelationKindSchema>;

/**
 * Action loggable sur un asset.
 */
export const DocumentAuditActionSchema = z.enum([
  "create",
  "read",
  "update",
  "archive",
  "share",
  "download",
  "preview",
]);
export type DocumentAuditAction = z.infer<typeof DocumentAuditActionSchema>;

/**
 * État d'un asset.
 */
export const DocumentStateSchema = z.enum(["active", "archived"]);
export type DocumentState = z.infer<typeof DocumentStateSchema>;

/**
 * Tier embedding pour stratégie 3 niveaux du Knowledge Hub
 * (cf. memo `project_knowledge_hub_embeddings_3tier_2026_06_08`).
 */
export const EmbeddingTierSchema = z.enum(["local-bge", "voyage", "openai"]);
export type EmbeddingTier = z.infer<typeof EmbeddingTierSchema>;

/**
 * Mode DLP (data loss prevention).
 */
export const DlpModeSchema = z.enum(["reject", "redact", "flag"]);
export type DlpMode = z.infer<typeof DlpModeSchema>;

/* ------------------------------------------------------------------ */
/*  Entities canon (alignées Odoo stakly.document.*)                  */
/* ------------------------------------------------------------------ */

/**
 * DocumentAsset — fichier principal versionné, signé, ACL-aware.
 *
 * Source canon : `stakly.document.asset` (Odoo).
 */
export const DocumentAssetSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(256),
  type: DocumentTypeSchema,
  path: z.string().min(1).max(2048),
  size: z.number().int().nonnegative(),
  mime_type: z.string().min(1).max(128),
  owner_id: z.number().int().positive(),
  /** Scope ACL (univers/équipe/projet). Le Hub applique la cascade. */
  scope_id: z.string().min(1).max(128),
  /** Signature ed25519 du content_hash de la version courante. */
  signature_ed25519: z.string().min(1).max(256).nullable(),
  state: DocumentStateSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  archived_at: z.string().datetime().nullable(),
});
export type DocumentAsset = z.infer<typeof DocumentAssetSchema>;

/**
 * DocumentVersion — versioning signé (chaîne immutable).
 */
export const DocumentVersionSchema = z.object({
  id: z.number().int().positive(),
  asset_id: z.number().int().positive(),
  version: z.string().min(1).max(32),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/, "content_hash doit être sha256 hex 64 chars"),
  signed_by: z.number().int().positive(),
  signature: z.string().min(1).max(256),
  replaces_version_id: z.number().int().positive().nullable(),
  created_at: z.string().datetime(),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

/**
 * DocumentRelation — arête knowledge graph entre 2 assets.
 */
export const DocumentRelationSchema = z.object({
  id: z.number().int().positive(),
  from_asset: z.number().int().positive(),
  to_asset: z.number().int().positive(),
  kind: DocumentRelationKindSchema,
  weight: z.number().min(0).max(1).default(1.0),
  created_at: z.string().datetime(),
}).refine(
  (data) => data.from_asset !== data.to_asset,
  { message: "Un asset ne peut pas se relier à lui-même" },
);
export type DocumentRelation = z.infer<typeof DocumentRelationSchema>;

/**
 * DocumentTag — tag humain ou IA.
 *
 * Règle : si un tag est posé en `source=human`, il prime sur tout tag IA
 * identique (cf. DOC.4 auto-tagger logic).
 */
export const DocumentTagSchema = z.object({
  id: z.number().int().positive(),
  asset_id: z.number().int().positive(),
  tag: z.string().min(1).max(64),
  source: DocumentTagSourceSchema,
  confidence: z.number().int().min(0).max(100),
});
export type DocumentTag = z.infer<typeof DocumentTagSchema>;

/**
 * DocumentAccessLog — chaîne audit immutable signée.
 */
export const DocumentAccessLogSchema = z.object({
  id: z.number().int().positive(),
  asset_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  action: DocumentAuditActionSchema,
  scope_id: z.string().min(1).max(128),
  /** Signature ed25519 de hash(asset_id|user_id|action|timestamp). */
  signature: z.string().min(1).max(256),
  timestamp: z.string().datetime(),
});
export type DocumentAccessLog = z.infer<typeof DocumentAccessLogSchema>;

/**
 * DocumentRecommendation — cache des recommandations par contexte.
 */
export const DocumentRecommendationSchema = z.object({
  id: z.number().int().positive(),
  context_scope: z.string().min(1).max(128),
  /** Liste ordonnée d'IDs d'assets recommandés. */
  asset_ids: z.array(z.number().int().positive()).max(50),
  score: z.number().min(0).max(1),
  computed_at: z.string().datetime(),
});
export type DocumentRecommendation = z.infer<typeof DocumentRecommendationSchema>;

/* ------------------------------------------------------------------ */
/*  Webhooks / indexation events                                      */
/* ------------------------------------------------------------------ */

/**
 * Évènement reçu par le background indexer du Hub. Envelope normalisée
 * peu importe la source primaire (Nextcloud/Odoo/Matrix/GitHub).
 */
export const DocumentIndexationEventKindSchema = z.enum([
  "asset.created",
  "asset.updated",
  "asset.archived",
  "asset.shared",
]);
export type DocumentIndexationEventKind = z.infer<
  typeof DocumentIndexationEventKindSchema
>;

export const DocumentIndexationEventSchema = z.object({
  kind: DocumentIndexationEventKindSchema,
  /** Backend source du webhook. */
  source: DocumentStorageBackendSchema,
  /** Tenant scope — issu de la session OIDC, JAMAIS du payload client. */
  tenant_id: z.string().min(1).max(64),
  /** Asset Odoo (résolu après ingestion). */
  asset_id: z.number().int().positive(),
  /** Hash sha256 du contenu (utilisé pour de-duplication index). */
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  /** Path canonique. */
  path: z.string().min(1).max(2048),
  /** Type de doc. */
  type: DocumentTypeSchema,
  /** Datetime ISO 8601 d'émission. */
  emitted_at: z.string().datetime(),
  /** Trace id pour corrélation distribuée. */
  trace_id: z.string().min(1).max(64).optional(),
});
export type DocumentIndexationEvent = z.infer<
  typeof DocumentIndexationEventSchema
>;

/* ------------------------------------------------------------------ */
/*  Search / recommend                                                */
/* ------------------------------------------------------------------ */

export const DocumentSearchInputSchema = z.object({
  query: z.string().min(1).max(512),
  /** Limite de résultats. */
  limit: z.number().int().positive().max(50).default(10),
  /** Filtres scope optionnels (additionnels à la session). */
  scope: z.string().min(1).max(128).optional(),
  /** Filtres type optionnels. */
  type: DocumentTypeSchema.optional(),
});
export type DocumentSearchInput = z.infer<typeof DocumentSearchInputSchema>;

export const DocumentSearchHitSchema = z.object({
  asset_id: z.number().int().positive(),
  title: z.string().min(1).max(256),
  /** Snippet ≤ 200 chars (préparé côté Hub). */
  snippet: z.string().max(200),
  /** Score combiné hybrid (dense + sparse RRF + cross-encoder). */
  score: z.number().min(0).max(1),
  /** Type pour rendu UI. */
  type: DocumentTypeSchema,
});
export type DocumentSearchHit = z.infer<typeof DocumentSearchHitSchema>;

export const DocumentSearchOutputSchema = z.object({
  hits: z.array(DocumentSearchHitSchema).max(50),
  /** Vrai si la limite a été atteinte (autres résultats potentiellement disponibles). */
  truncated: z.boolean(),
});
export type DocumentSearchOutput = z.infer<typeof DocumentSearchOutputSchema>;

export const DocumentRecommendInputSchema = z.object({
  context_scope: z.string().min(1).max(128),
  limit: z.number().int().positive().max(20).default(5),
});
export type DocumentRecommendInput = z.infer<
  typeof DocumentRecommendInputSchema
>;

export const DocumentRecommendOutputSchema = z.object({
  asset_ids: z.array(z.number().int().positive()).max(20),
  score: z.number().min(0).max(1),
  computed_at: z.string().datetime(),
});
export type DocumentRecommendOutput = z.infer<
  typeof DocumentRecommendOutputSchema
>;

/* ------------------------------------------------------------------ */
/*  MCP tool inputs/outputs (12 tools du contrat)                     */
/* ------------------------------------------------------------------ */

/** document_create */
export const DocumentCreateInputSchema = z.object({
  name: z.string().min(1).max(256),
  type: DocumentTypeSchema,
  path: z.string().min(1).max(2048),
  mime_type: z.string().min(1).max(128).optional(),
  scope_id: z.string().min(1).max(128),
  /** Source content (markdown body, base64 file blob, etc). */
  source: z.string().max(10_000_000).optional(),
});
export type DocumentCreateInput = z.infer<typeof DocumentCreateInputSchema>;

export const DocumentCreateOutputSchema = z.object({
  asset_id: z.number().int().positive(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  signature_ed25519: z.string().min(1).max(256),
});
export type DocumentCreateOutput = z.infer<typeof DocumentCreateOutputSchema>;

/** document_read */
export const DocumentReadInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** Si défini, lit cette version. Sinon dernière. */
  version: z.string().min(1).max(32).optional(),
});
export type DocumentReadInput = z.infer<typeof DocumentReadInputSchema>;

export const DocumentReadOutputSchema = z.object({
  asset: DocumentAssetSchema,
  /** Body texte ou base64 selon `type`. */
  body: z.string().max(10_000_000),
});
export type DocumentReadOutput = z.infer<typeof DocumentReadOutputSchema>;

/** document_update */
export const DocumentUpdateInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** Nouveau contenu. */
  body: z.string().max(10_000_000),
  /** Version sortante (semver). */
  version: z.string().min(1).max(32),
});
export type DocumentUpdateInput = z.infer<typeof DocumentUpdateInputSchema>;

export const DocumentUpdateOutputSchema = z.object({
  asset_id: z.number().int().positive(),
  new_version_id: z.number().int().positive(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DocumentUpdateOutput = z.infer<typeof DocumentUpdateOutputSchema>;

/** document_archive (perm_unlink=0 : archive, jamais delete) */
export const DocumentArchiveInputSchema = z.object({
  asset_id: z.number().int().positive(),
  reason: z.string().min(1).max(256).optional(),
});
export type DocumentArchiveInput = z.infer<typeof DocumentArchiveInputSchema>;

export const DocumentArchiveOutputSchema = z.object({
  asset_id: z.number().int().positive(),
  archived_at: z.string().datetime(),
});
export type DocumentArchiveOutput = z.infer<typeof DocumentArchiveOutputSchema>;

/** document_share */
export const DocumentShareInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** Scope cible (autre univers, lien extranet, etc.). */
  target_scope: z.string().min(1).max(128),
  /** TTL en secondes pour partage temporaire (0 = illimité). */
  ttl_sec: z.number().int().nonnegative().max(60 * 60 * 24 * 365).default(0),
});
export type DocumentShareInput = z.infer<typeof DocumentShareInputSchema>;

export const DocumentShareOutputSchema = z.object({
  share_token: z.string().min(1).max(256),
  expires_at: z.string().datetime().nullable(),
});
export type DocumentShareOutput = z.infer<typeof DocumentShareOutputSchema>;

/** document_summarize */
export const DocumentSummarizeInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** Cible (chars cible du résumé). */
  max_chars: z.number().int().positive().max(2000).default(500),
});
export type DocumentSummarizeInput = z.infer<
  typeof DocumentSummarizeInputSchema
>;

export const DocumentSummarizeOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional(),
});
export type DocumentSummarizeOutput = z.infer<
  typeof DocumentSummarizeOutputSchema
>;

/** document_diff */
export const DocumentDiffInputSchema = z.object({
  asset_id: z.number().int().positive(),
  from_version: z.string().min(1).max(32),
  to_version: z.string().min(1).max(32),
});
export type DocumentDiffInput = z.infer<typeof DocumentDiffInputSchema>;

export const DocumentDiffOutputSchema = z.object({
  /** Diff unifié text. */
  diff: z.string().max(10_000_000),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});
export type DocumentDiffOutput = z.infer<typeof DocumentDiffOutputSchema>;

/** document_relate */
export const DocumentRelateInputSchema = z.object({
  from_asset: z.number().int().positive(),
  to_asset: z.number().int().positive(),
  kind: DocumentRelationKindSchema,
  weight: z.number().min(0).max(1).default(1.0),
}).refine(
  (data) => data.from_asset !== data.to_asset,
  { message: "Un asset ne peut pas se relier à lui-même" },
);
export type DocumentRelateInput = z.infer<typeof DocumentRelateInputSchema>;

export const DocumentRelateOutputSchema = z.object({
  relation_id: z.number().int().positive(),
});
export type DocumentRelateOutput = z.infer<typeof DocumentRelateOutputSchema>;

/** document_audit_trail */
export const DocumentAuditTrailInputSchema = z.object({
  asset_id: z.number().int().positive(),
  limit: z.number().int().positive().max(200).default(50),
});
export type DocumentAuditTrailInput = z.infer<
  typeof DocumentAuditTrailInputSchema
>;

export const DocumentAuditTrailOutputSchema = z.object({
  logs: z.array(DocumentAccessLogSchema).max(200),
  /** Vrai si chaîne ed25519 vérifiée intégralement. */
  chain_valid: z.boolean(),
});
export type DocumentAuditTrailOutput = z.infer<
  typeof DocumentAuditTrailOutputSchema
>;

/** document_attach_to_email */
export const DocumentAttachToEmailInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** UID 44C (ou string) du message email cible. */
  email_id: z.string().min(1).max(128),
});
export type DocumentAttachToEmailInput = z.infer<
  typeof DocumentAttachToEmailInputSchema
>;

export const DocumentAttachToEmailOutputSchema = z.object({
  attached: z.boolean(),
  attachment_id: z.number().int().positive().nullable(),
});
export type DocumentAttachToEmailOutput = z.infer<
  typeof DocumentAttachToEmailOutputSchema
>;

/* ------------------------------------------------------------------ */
/*  DLP / PII patterns                                                */
/* ------------------------------------------------------------------ */

/**
 * Catégories de PII détectées par le DLP scanner pre-index.
 * Suit OWASP top sensible patterns (sans CC sans Luhn).
 */
export const PiiCategorySchema = z.enum([
  "email",
  "phone",
  "credit_card",
  "ssn",
  "passport",
  "iban",
]);
export type PiiCategory = z.infer<typeof PiiCategorySchema>;

export const PiiHitSchema = z.object({
  category: PiiCategorySchema,
  /** Snippet anonymisé (« ***@example.com »). Pas le PII brut. */
  redacted: z.string().min(1).max(64),
  /** Position dans le content (offset chars). */
  offset: z.number().int().nonnegative(),
});
export type PiiHit = z.infer<typeof PiiHitSchema>;

export const DlpScanResultSchema = z.object({
  hits: z.array(PiiHitSchema).max(1000),
  /** Mode appliqué pour ce scan. */
  mode: DlpModeSchema,
  /** Vrai si l'indexation doit être abandonnée. */
  blocked: z.boolean(),
  /** Contenu redacted si mode=redact (sinon null). */
  redacted_content: z.string().max(10_000_000).nullable(),
});
export type DlpScanResult = z.infer<typeof DlpScanResultSchema>;

/* ------------------------------------------------------------------ */
/*  Watermark                                                          */
/* ------------------------------------------------------------------ */

export const DocumentWatermarkInputSchema = z.object({
  asset_id: z.number().int().positive(),
  /** UID utilisateur. */
  user_id: z.number().int().positive(),
  /** Type de watermark voulu. */
  flavor: z.enum(["visible", "invisible", "both"]).default("both"),
});
export type DocumentWatermarkInput = z.infer<
  typeof DocumentWatermarkInputSchema
>;

export const DocumentWatermarkOutputSchema = z.object({
  /** URL/path du contenu marqué. */
  watermarked_path: z.string().min(1).max(2048),
  /** Hash sha256 du contenu marqué pour traçabilité. */
  watermark_hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DocumentWatermarkOutput = z.infer<
  typeof DocumentWatermarkOutputSchema
>;

/* ------------------------------------------------------------------ */
/*  MCP tool catalog — 12 tools canon du contrat                      */
/* ------------------------------------------------------------------ */

export const McpDocumentToolNameSchema = z.enum([
  "document_create",
  "document_read",
  "document_update",
  "document_archive",
  "document_share",
  "document_search",
  "document_summarize",
  "document_diff",
  "document_recommend",
  "document_relate",
  "document_audit_trail",
  "document_attach_to_email",
]);
export type McpDocumentToolName = z.infer<typeof McpDocumentToolNameSchema>;

/**
 * Catalogue canon des 12 MCP tools du contrat PCKDOC.
 */
export const MCP_DOCUMENT_TOOLS_CANON: ReadonlyArray<{
  name: McpDocumentToolName;
  description: string;
}> = Object.freeze([
  { name: "document_create", description: "Crée un document depuis source (markdown, fichier, prompt IA)" },
  { name: "document_read", description: "Lit le contenu d'un document" },
  { name: "document_update", description: "Met à jour un document (versionné)" },
  { name: "document_archive", description: "Archive un document (perm_unlink=0, audit immutable)" },
  { name: "document_share", description: "Partage un document avec un scope ou via extranet" },
  { name: "document_search", description: "Recherche sémantique hybrid dense+sparse" },
  { name: "document_summarize", description: "Résumé IA d'un document long" },
  { name: "document_diff", description: "Différence entre 2 versions" },
  { name: "document_recommend", description: "Documents pertinents selon contexte courant" },
  { name: "document_relate", description: "Lie 2 documents (depends_on, replaces, related_to)" },
  { name: "document_audit_trail", description: "Chain audit immutable verifiable" },
  { name: "document_attach_to_email", description: "Ajoute auto pièce jointe pertinente à un email" },
]);
