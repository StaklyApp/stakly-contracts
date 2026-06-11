/**
 * Agents Instances — schemas Zod du pack PCKAIE (Pack natif Moteur IA).
 *
 * Modèle 4 entités principales :
 *   1. AgentInstance — instance d'agent IA déployée (id, slug, model, runtime…)
 *   2. AgentScope    — scope groupe pour ACL (44C, group_ids, cascade L0-L3)
 *   3. AgentRoom     — mapping Matrix room_id ↔ 44C ROOM_
 *   4. AgentInstruction — cascade instruction par layer L0/L1/L2/L3
 *
 * Conventions Stakly :
 *   - ACL multi-héritage INTERSECTION (forbidden d'un seul groupe = refus)
 *   - L0 fabrication-secret : humain ne voit JAMAIS un 44C en UI client.
 *     Toujours utiliser un slot human-friendly type "GRPMGR-XYZ" pour URL.
 *   - immutable_by_lower_levels : un L0/L1 peut interdire override par L2/L3
 *   - perm_unlink = 0 (archive jamais delete)
 *   - audit ed25519 chain sur tous mutations
 *
 * @see memo `project_ai_engine_container_2026_06_10`
 * @see memo `project_instructions_groupes_brief_jalon_f_2026_06_01`
 * @see memo `project_instructions_agents_4_niveaux_2026_06_08`
 */

import { z } from "zod";
import { T44CSchema, RuntimeAclLevelSchema } from "../runtime/index.js";

/* ------------------------------------------------------------------ */
/*  Identifiants                                                       */
/* ------------------------------------------------------------------ */

/**
 * Slot human-friendly pour groupe (URL safe). Format "GRPMGR-XYZ" ou
 * "ENT-ROOT" : préfixe 3-6 chars + tiret + suffixe 3-12 chars [A-Z0-9].
 *
 * Humain voit ce slot, JAMAIS le 44C correspondant (fabrication-secret).
 */
export const GroupSlotSchema = z
  .string()
  .min(7)
  .max(24)
  .regex(/^[A-Z]{2,6}-[A-Z0-9]{3,16}$/, "group slot invalide (ex: GRPMGR-XYZ)");
export type GroupSlot = z.infer<typeof GroupSlotSchema>;

/**
 * Tenant ID — issu de la session Authentik. JAMAIS du client.
 */
export const InstanceTenantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9._-]+$/i, "tenant id invalide");
export type InstanceTenantId = z.infer<typeof InstanceTenantIdSchema>;

/**
 * Slug d'agent — identifiant publique stable. `agent.{pole}-{function}`.
 */
export const InstanceAgentSlugSchema = z
  .string()
  .min(1)
  .max(44)
  .regex(/^agent\.[a-z0-9._-]+$/i, "agent slug invalide");
export type InstanceAgentSlug = z.infer<typeof InstanceAgentSlugSchema>;

/* ------------------------------------------------------------------ */
/*  Killswitch state                                                   */
/* ------------------------------------------------------------------ */

/**
 * État du killswitch L0 pour une instance.
 *
 *  - `active`     : poll AI-HUB autorise — agent opérationnel
 *  - `idle_forced`: poll AI-HUB refusé (403/coupé) — agent silencieux <30s
 *  - `unknown`    : pas encore polled (warmup state)
 */
export const KillswitchStateSchema = z.object({
  status: z.enum(["active", "idle_forced", "unknown"]),
  last_check_at: z.string().datetime().nullable(),
  last_ok_at: z.string().datetime().nullable(),
  /** Code retour du dernier poll (403 = killswitch). */
  last_http_code: z.number().int().min(0).max(599).nullable(),
  reason: z.string().max(256).nullable(),
});
export type KillswitchState = z.infer<typeof KillswitchStateSchema>;

/* ------------------------------------------------------------------ */
/*  AgentInstance                                                      */
/* ------------------------------------------------------------------ */

/**
 * Runtime d'exécution. `ollama` = local (000003 ou client), `vllm` = GPU,
 * `openai` = passerelle, `stub` = mode test.
 */
export const AgentRuntimeSchema = z.enum(["ollama", "vllm", "openai", "stub"]);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export const AgentInstanceSchema = z.object({
  id: z.number().int().positive(),
  slug: InstanceAgentSlugSchema,
  tenant_id: InstanceTenantIdSchema,
  /** Modèle ex: "llama3.1:70b", "gpt-4o-mini", "stub". */
  model: z.string().min(1).max(128),
  runtime: AgentRuntimeSchema,
  /** FK vers AgentScope (id). */
  instructions_scope_id: z.number().int().positive().nullable(),
  killswitch: KillswitchStateSchema,
  /** ed25519 signature de la définition immutable. */
  signature: z.string().min(1).max(256).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  /** Soft-delete archive flag (perm_unlink=0). */
  archived: z.boolean().default(false),
});
export type AgentInstance = z.infer<typeof AgentInstanceSchema>;

/* ------------------------------------------------------------------ */
/*  AgentScope                                                         */
/* ------------------------------------------------------------------ */

/**
 * AgentScope — groupe d'agents pour ACL multi-héritage.
 *
 * Un scope porte :
 *  - un identifiant 44C stable côté Stakly
 *  - un slot human-friendly côté humain
 *  - une liste de groupes Odoo `group_ids` (Identity Group Mesh)
 *  - une cascade de niveaux ACL L0→L3 (résolution intersection)
 */
export const AgentScopeSchema = z.object({
  id: z.number().int().positive(),
  /** T44C stable Stakly (jamais exposé brut côté humain). */
  scope_44c: T44CSchema,
  /** Slot URL-safe ex "GRPMGR-MARKETING". */
  slot: GroupSlotSchema,
  /** Libellé humain. */
  name: z.string().min(1).max(128),
  tenant_id: InstanceTenantIdSchema,
  /** IDs de groupes Odoo HR pour cascade Identity Group Mesh. */
  group_ids: z.array(z.number().int().positive()).max(64),
  /** ID du scope parent (DAG agent ↔ groupe ↔ groupe parent). */
  parent_id: z.number().int().positive().nullable(),
  /** Niveaux ACL ordonnés L0→L3 inclus dans ce scope. */
  acl_levels: z.array(RuntimeAclLevelSchema).max(4),
  /** ID Matrix room (44C ROOM_) — canal interne unique. */
  matrix_room_44c: T44CSchema.nullable(),
  created_at: z.string().datetime(),
  archived: z.boolean().default(false),
});
export type AgentScope = z.infer<typeof AgentScopeSchema>;

/* ------------------------------------------------------------------ */
/*  AgentRoom                                                          */
/* ------------------------------------------------------------------ */

/**
 * Mapping Matrix room_id (Synapse) ↔ 44C ROOM_ (stable Stakly).
 *
 * Chaque scope a UN canal Matrix dédié — le SEUL canal d'échange
 * interne autorisé entre les agents du groupe (cf. brief Franck 2026-06-01).
 */
export const ExternalChannelKindSchema = z.enum([
  "matrix",
  "whatsapp",
  "telegram",
  "email",
]);
export type ExternalChannelKind = z.infer<typeof ExternalChannelKindSchema>;

export const AgentRoomSchema = z.object({
  id: z.number().int().positive(),
  scope_id: z.number().int().positive(),
  room_44c: T44CSchema,
  matrix_room_id: z
    .string()
    .regex(/^![A-Za-z0-9.:_-]+:.+$/, "matrix room_id invalide"),
  name: z.string().min(1).max(128),
  /** Kind du canal — par défaut "matrix" (canal interne unique). */
  kind: ExternalChannelKindSchema.default("matrix"),
  /** Address pour canaux externes (email, +33xxx, @telegram). */
  external_address: z.string().max(256).nullable(),
  tenant_id: InstanceTenantIdSchema,
  created_at: z.string().datetime(),
  archived: z.boolean().default(false),
});
export type AgentRoom = z.infer<typeof AgentRoomSchema>;

/* ------------------------------------------------------------------ */
/*  AgentInstruction (cascade L0-L3)                                   */
/* ------------------------------------------------------------------ */

/**
 * Une instruction = une entrée de la cascade (layer, scope, content).
 *
 * Unique par (layer, scope_id). Si layer L0 + immutable_by_lower_levels,
 * les layers inférieurs ne peuvent PAS override.
 *
 * Cf. memo `project_instructions_agents_4_niveaux_2026_06_08` (10 cauchemars).
 */
export const AgentInstructionSchema = z.object({
  id: z.number().int().positive(),
  scope_id: z.number().int().positive(),
  layer: RuntimeAclLevelSchema,
  /** Contenu Markdown. 16k max — éviter context bloat. */
  content: z.string().min(1).max(16_384),
  /**
   * Si true, ce layer ne peut être override par les layers inférieurs.
   * L0 default true (fabrication-secret Stakly), L1/L2/L3 default false.
   */
  immutable_by_lower_levels: z.boolean().default(false),
  /** ed25519 signature pour anti-altération (audit chain). */
  signature: z.string().min(1).max(256).nullable(),
  /** Auteur (ACTR_ 44C ou "L0_STAKLY"). */
  author: z.string().min(1).max(64),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  /** Version SemVer pour rollback. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "SemVer requise"),
  archived: z.boolean().default(false),
});
export type AgentInstruction = z.infer<typeof AgentInstructionSchema>;

/* ------------------------------------------------------------------ */
/*  Cascade utility — résolution L0→L3 intersection                    */
/* ------------------------------------------------------------------ */

/**
 * Cascade résolue (read-side). On rend un array ordonné L0→L3 + l'état
 * d'héritage par layer (badge "hérité de L0" côté UI).
 */
export const ResolvedInstructionCascadeSchema = z.object({
  scope_id: z.number().int().positive(),
  layers: z
    .array(
      z.object({
        layer: RuntimeAclLevelSchema,
        instruction: AgentInstructionSchema.nullable(),
        inherited_from: RuntimeAclLevelSchema.nullable(),
        /** Si true, le layer courant est bloqué par un layer supérieur immutable. */
        locked: z.boolean(),
      }),
    )
    .min(1)
    .max(4),
});
export type ResolvedInstructionCascade = z.infer<
  typeof ResolvedInstructionCascadeSchema
>;

/* ------------------------------------------------------------------ */
/*  Whitelist fabrication-secret                                       */
/* ------------------------------------------------------------------ */

/**
 * Champs INTERDITS de fuiter côté UI client — protection fabrication-secret.
 * Utilisé en invariance tests sur AgentInstance + AgentInstruction.
 */
export const FORBIDDEN_INSTANCE_FIELDS = [
  "prompt",
  "system_prompt",
  "chain_of_thought",
  "raw_output",
  "vault_secret",
  "l0_raw",
] as const;
