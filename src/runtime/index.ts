/**
 * Runtime 44C — schemas Zod des messages éphémères (MSG/INS/EVT/RSP) +
 * ROOM Matrix + ACL cascade.
 *
 * Ces types vivent dans Redis streams + canaux Matrix + bus agent. Ils
 * sont JAMAIS persistés tels quels en SQL — la transcription en
 * `stakly.agent.activity` (Postgres) appartient au Hub BFF.
 *
 * Cf. memo `project_lingua_franca_44c_runtime_2026_06_10`.
 *
 * Humain ne voit JAMAIS un 44C en UI client (cf. memo).
 */

import { z } from "zod";
import { STRICT_44C_REGEX } from "../44c/regex.js";

/* ------------------------------------------------------------------ */
/*  T44CSchema — string 44 chars strict                                */
/* ------------------------------------------------------------------ */

/**
 * Schéma Zod réutilisable pour un T44C canonique (44 chars exacts).
 */
export const T44CSchema = z
  .string()
  .length(44)
  .regex(STRICT_44C_REGEX, "T44C invalide (attendu 44 chars [A-Z0-9_])");
export type T44CString = z.infer<typeof T44CSchema>;

/* ------------------------------------------------------------------ */
/*  Common envelope — un message runtime a toujours ces champs         */
/* ------------------------------------------------------------------ */

const RuntimeEnvelopeShape = {
  /** Identifiant 44C du message lui-même. */
  id: T44CSchema,
  /** ROOM_ Matrix d'origine (canal Synapse). */
  room_id: T44CSchema,
  /** ACTR_ émetteur (humain ou agent). */
  actor_id: T44CSchema,
  /** Timestamp ISO 8601. */
  at: z.string().datetime(),
  /** Tenant scope — issu de la session, JAMAIS du client. */
  tenant_id: z.string().min(1).max(64),
  /** Trace / corrélation distribuée (UUID v4 ou ULID). */
  trace_id: z.string().min(1).max(64).optional(),
} as const;

/* ------------------------------------------------------------------ */
/*  MSG_ — chat message                                                */
/* ------------------------------------------------------------------ */

/**
 * Contenu textuel utilisateur ou agent. Pas de prompt brut ni de
 * chain-of-thought (fabrication-secret) — uniquement le rendu user-facing.
 */
export const MsgContentSchema = z.object({
  text: z.string().max(10_000),
  /** Format de rendu (text, markdown, html-safe). */
  format: z.enum(["text", "markdown", "html"]).default("markdown"),
  /** Mentions @ACTR_ — array de 44C. */
  mentions: z.array(T44CSchema).max(50).optional(),
});
export type MsgContent = z.infer<typeof MsgContentSchema>;

export const MsgEventSchema = z.object({
  ...RuntimeEnvelopeShape,
  type: z.literal("MSG_"),
  content: MsgContentSchema,
  /** ID du message parent (thread) — optionnel. */
  parent_id: T44CSchema.optional(),
});
export type MsgEvent = z.infer<typeof MsgEventSchema>;

/* ------------------------------------------------------------------ */
/*  INS_ — insight (résultat agent IA)                                 */
/* ------------------------------------------------------------------ */

/**
 * Insight = résultat d'une opération agent IA. La payload est intentionnellement
 * non-typée (record libre) car chaque skill peut produire des structures
 * variées. Le `kind` permet aux clients de discriminer.
 *
 * INTERDIT : pas de prompt, chain-of-thought, ou scope dans la payload.
 */
export const InsightKindSchema = z.enum([
  "answer",
  "summary",
  "extraction",
  "classification",
  "diagnosis",
  "recommendation",
  "score",
  "error",
]);
export type InsightKind = z.infer<typeof InsightKindSchema>;

export const InsightSchema = z.object({
  ...RuntimeEnvelopeShape,
  type: z.literal("INS_"),
  kind: InsightKindSchema,
  /** Payload arbitraire (skill-specific). */
  payload: z.record(z.string(), z.unknown()),
  /** Confiance 0..1 (null si non scoré). */
  confidence: z.number().min(0).max(1).nullable(),
  /** Latence ms de production. */
  latency_ms: z.number().int().nonnegative().optional(),
});
export type Insight = z.infer<typeof InsightSchema>;

/* ------------------------------------------------------------------ */
/*  EVT_ — system event                                                */
/* ------------------------------------------------------------------ */

export const EventKindSchema = z.enum([
  "agent.started",
  "agent.stopped",
  "agent.error",
  "task.created",
  "task.updated",
  "task.completed",
  "task.failed",
  "user.connected",
  "user.disconnected",
  "tenant.suspended",
  "tenant.resumed",
  "killswitch.triggered",
]);
export type EventKind = z.infer<typeof EventKindSchema>;

export const RuntimeEventSchema = z.object({
  ...RuntimeEnvelopeShape,
  type: z.literal("EVT_"),
  kind: EventKindSchema,
  /** Payload arbitraire kind-specific. */
  payload: z.record(z.string(), z.unknown()).optional(),
  /** Sévérité — utile pour SIEM/Loki. */
  severity: z.enum(["info", "warn", "error", "critical"]).default("info"),
});
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

/* ------------------------------------------------------------------ */
/*  RSP_ — réponse synchrone agent                                     */
/* ------------------------------------------------------------------ */

/**
 * Réponse synchrone à un appel d'agent (RPC-like). Contrairement à MSG_,
 * RSP_ a un statut + relie un request_id.
 */
export const RspStatusSchema = z.enum(["ok", "error", "timeout", "rejected"]);
export type RspStatus = z.infer<typeof RspStatusSchema>;

export const RspSchema = z.object({
  ...RuntimeEnvelopeShape,
  type: z.literal("RSP_"),
  request_id: T44CSchema,
  status: RspStatusSchema,
  /** Body si status=ok. */
  body: z.record(z.string(), z.unknown()).nullable(),
  /** Code erreur si status=error/timeout/rejected. */
  error_code: z.string().max(64).optional(),
  /** Message erreur lisible. */
  error_message: z.string().max(512).optional(),
});
export type Rsp = z.infer<typeof RspSchema>;

/* ------------------------------------------------------------------ */
/*  Union discriminée runtime                                          */
/* ------------------------------------------------------------------ */

export const RuntimeMessageSchema = z.discriminatedUnion("type", [
  MsgEventSchema,
  InsightSchema,
  RuntimeEventSchema,
  RspSchema,
]);
export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>;

/* ------------------------------------------------------------------ */
/*  ROOM_ Matrix canal                                                  */
/* ------------------------------------------------------------------ */

/**
 * Mapping logique ROOM_ → room_id Synapse + métadonnées canal.
 * Utilisé côté Hub pour traduire `ROOM_*` (44C stable) ↔ `!abc:matrix.org`
 * (id Synapse instable).
 */
export const RoomKindSchema = z.enum([
  "team",
  "agent",
  "alert",
  "support",
  "direct",
  "dm",
  "system",
]);
export type RoomKind = z.infer<typeof RoomKindSchema>;

export const RoomDescriptorSchema = z.object({
  /** T44C stable côté Stakly. */
  id: T44CSchema,
  /** room_id Synapse (`!xxx:matrix.org`). */
  matrix_room_id: z.string().regex(/^![A-Za-z0-9.:_-]+:.+$/, "matrix room_id invalide"),
  /** Nom affiché Matrix. */
  name: z.string().min(1).max(128),
  /** Topic Matrix. */
  topic: z.string().max(512).nullable(),
  kind: RoomKindSchema,
  member_count: z.number().int().nonnegative(),
  tenant_id: z.string().min(1).max(64),
});
export type RoomDescriptor = z.infer<typeof RoomDescriptorSchema>;

/* ------------------------------------------------------------------ */
/*  ACL_ cascade L0→L3                                                 */
/* ------------------------------------------------------------------ */

export const RuntimeAclLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);
export type RuntimeAclLevel = z.infer<typeof RuntimeAclLevelSchema>;

/**
 * Politique ACL d'un niveau dans la cascade.
 *
 *  - `immutable_by_lower_levels` (déjà spécifié dans display-engine) — si
 *    true, aucun niveau inférieur ne peut override ce verdict. Utile pour
 *    le killswitch L0 (Stakly coupe accès tenant).
 *  - `allowed_actors` / `forbidden_actors` : liste T44C ACTR explicites.
 *  - `default_deny` : si true et qu'aucune règle ne matche, refuser.
 */
export const AclPolicySchema = z.object({
  level: RuntimeAclLevelSchema,
  immutable_by_lower_levels: z.boolean().default(false),
  default_deny: z.boolean().default(false),
  allowed_actors: z.array(T44CSchema).max(1000).optional(),
  forbidden_actors: z.array(T44CSchema).max(1000).optional(),
  /** TTL cache de cette politique (sec). */
  ttl_sec: z.number().int().min(30).max(3600).default(300),
});
export type AclPolicy = z.infer<typeof AclPolicySchema>;

/**
 * Cascade complète ordonnée L0→L3 (au max 4 entrées).
 */
export const AclCascadeSchema = z.array(AclPolicySchema).min(1).max(4);
export type AclCascade = z.infer<typeof AclCascadeSchema>;

/**
 * Décision INTERSECTION de la cascade ACL.
 */
export const AclDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().max(256).nullable(),
  blocking_level: RuntimeAclLevelSchema.nullable(),
});
export type AclDecision = z.infer<typeof AclDecisionSchema>;
