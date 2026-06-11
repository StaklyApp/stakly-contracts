/**
 * Agents CQRS — schemas Zod du module agent-stats (Postgres snapshot +
 * Redis stream delta).
 *
 * Aligné sur `stakly-hub/src/agent-stats/schemas.ts`. Source unique de
 * vérité pour les types AgentSnapshot / AgentDelta / AgentStream consommés
 * par Stakly UI (composant `<AgentTile />`) et publiés par les adapters
 * Hub.
 *
 * Périmètre fabrication-secret STRICT :
 *   - JAMAIS de prompt / chain-of-thought / output_schema / scope_in/out.
 *   - Whitelist `FORBIDDEN_AGENT_STATS_FIELDS` testée en invariance.
 *
 * Cf. memos :
 *   - `project_canon_agents_standards_11_2026_06_08`
 *   - `project_agent_uid_dual_2026_06_08`
 *   - `feedback_stakly_fabrication_secret`
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Identifiants                                                       */
/* ------------------------------------------------------------------ */

/**
 * Slot d'agent — identifiant publique stable, client-facing.
 * Format `agent.{pole}-{function}`, 44 chars max (invariant T1 Stakly).
 */
export const SlotIdSchema = z
  .string()
  .min(1)
  .max(44)
  .regex(/^agent\.[a-z0-9._-]+$/i, "slot id invalide");
export type SlotId = z.infer<typeof SlotIdSchema>;

/**
 * tenant_id — issu de la session Authentik. JAMAIS du client.
 */
export const TenantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9._-]+$/i, "tenant id invalide");
export type TenantId = z.infer<typeof TenantIdSchema>;

/* ------------------------------------------------------------------ */
/*  AgentStatus state machine                                          */
/* ------------------------------------------------------------------ */

export const AgentStatusSchema = z.enum([
  "IDLE",
  "RUNNING",
  "ERROR",
  "PAUSED",
  "TERMINATED",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/* ------------------------------------------------------------------ */
/*  TokenConsumption                                                   */
/* ------------------------------------------------------------------ */

export const TokenConsumptionSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cost_eur: z.number().nonnegative(),
  since: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type TokenConsumption = z.infer<typeof TokenConsumptionSchema>;

/* ------------------------------------------------------------------ */
/*  JobStatus                                                          */
/* ------------------------------------------------------------------ */

export const JobStateSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);
export type JobState = z.infer<typeof JobStateSchema>;

export const JobKindSchema = z.enum([
  "chat",
  "tool_call",
  "batch_inference",
  "eval",
]);
export type JobKind = z.infer<typeof JobKindSchema>;

export const JobStatusSchema = z.object({
  job_id: z.string().min(1).max(128),
  kind: JobKindSchema,
  state: JobStateSchema,
  progress: z.number().min(0).max(100).nullable(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  latency_ms: z.number().int().nonnegative().nullable(),
});
export type JobStatus = z.infer<typeof JobStatusSchema>;

/* ------------------------------------------------------------------ */
/*  AgentSnapshot — vue agrégée                                        */
/* ------------------------------------------------------------------ */

export const AgentSnapshotSchema = z.object({
  slot: SlotIdSchema,
  tenant_id: TenantIdSchema,
  status: AgentStatusSchema,
  last_activity_at: z.string().datetime().nullable(),
  current_job: JobStatusSchema.nullable(),
  tokens_24h: TokenConsumptionSchema,
  delegation_depth: z.number().int().min(0).max(3),
  snapshot_version: z.number().int().nonnegative(),
  source: z.enum(["db_only", "db_plus_stream", "stream_only"]),
});
export type AgentSnapshot = z.infer<typeof AgentSnapshotSchema>;

export const AgentSnapshotListSchema = z.array(AgentSnapshotSchema);
export type AgentSnapshotList = z.infer<typeof AgentSnapshotListSchema>;

/* ------------------------------------------------------------------ */
/*  AgentDelta — events temps-réel                                     */
/* ------------------------------------------------------------------ */

export const StatusChangeDeltaSchema = z.object({
  type: z.literal("status_change"),
  slot: SlotIdSchema,
  tenant_id: TenantIdSchema,
  at: z.string().datetime(),
  from: AgentStatusSchema,
  to: AgentStatusSchema,
});
export type StatusChangeDelta = z.infer<typeof StatusChangeDeltaSchema>;

export const TokenAppendDeltaSchema = z.object({
  type: z.literal("token_append"),
  slot: SlotIdSchema,
  tenant_id: TenantIdSchema,
  at: z.string().datetime(),
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  cost_eur: z.number().nonnegative(),
});
export type TokenAppendDelta = z.infer<typeof TokenAppendDeltaSchema>;

export const JobEventDeltaSchema = z.object({
  type: z.literal("job_event"),
  slot: SlotIdSchema,
  tenant_id: TenantIdSchema,
  at: z.string().datetime(),
  job: JobStatusSchema,
});
export type JobEventDelta = z.infer<typeof JobEventDeltaSchema>;

export const AgentDeltaSchema = z.discriminatedUnion("type", [
  StatusChangeDeltaSchema,
  TokenAppendDeltaSchema,
  JobEventDeltaSchema,
]);
export type AgentDelta = z.infer<typeof AgentDeltaSchema>;

/* ------------------------------------------------------------------ */
/*  AgentStream — snapshot + deltas SSE                                */
/* ------------------------------------------------------------------ */

export const AgentStreamSchema = z.object({
  snapshot: AgentSnapshotSchema,
  deltas: z.array(AgentDeltaSchema),
  nextCursor: z.string().max(64).nullable(),
  pollAfterMs: z.number().int().min(1000).max(60_000),
});
export type AgentStream = z.infer<typeof AgentStreamSchema>;

/* ------------------------------------------------------------------ */
/*  Inputs tRPC                                                        */
/* ------------------------------------------------------------------ */

export const ListAgentStatsInputSchema = z.object({
  status: AgentStatusSchema.optional(),
  pole: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9._-]+$/i)
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
export type ListAgentStatsInput = z.infer<typeof ListAgentStatsInputSchema>;

export const DetailAgentStatsInputSchema = z.object({
  slot: SlotIdSchema,
});
export type DetailAgentStatsInput = z.infer<typeof DetailAgentStatsInputSchema>;

export const StreamAgentStatsInputSchema = z.object({
  slot: SlotIdSchema,
  sinceCursor: z.string().max(64).optional(),
});
export type StreamAgentStatsInput = z.infer<typeof StreamAgentStatsInputSchema>;

export const StreamAgentStatsOutputSchema = AgentStreamSchema;
export type StreamAgentStatsOutput = AgentStream;

/* ------------------------------------------------------------------ */
/*  Constantes runtime                                                 */
/* ------------------------------------------------------------------ */

export const TOKEN_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_POLL_AFTER_MS = 5_000;
export const DELTA_STALE_AFTER_MS = 60_000;

/**
 * Whitelist invariance — TOUS ces champs sont INTERDITS dans n'importe
 * quel AgentSnapshot / AgentDelta / payload `agents.*`. Toute introduction
 * accidentelle (refacto Odoo etc.) doit faire planter le contrat.
 *
 * Cf. `feedback_stakly_fabrication_secret`.
 */
export const FORBIDDEN_AGENT_STATS_FIELDS: readonly string[] = [
  "prompt",
  "chain_of_thought",
  "output_schema",
  "required_inputs",
  "scope_in",
  "scope_out",
  "system_prompt",
  "tools",
  "context_window",
];
