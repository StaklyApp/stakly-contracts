/**
 * AIE — schemas Zod du runtime container stakly-v3-ai-engine.
 *
 * Concerne :
 *  - mTLS config (certs paths, fingerprints)
 *  - Killswitch poll (~30s) résultat
 *  - Healthcheck (healthz + readyz + metrics)
 *  - Inference request/response (avec ACL check + audit ed25519)
 *
 * @see memo `project_ai_engine_container_2026_06_10`
 * @see memo `project_l0_ai_hub_killswitch_souverain_2026_06_08`
 */

import { z } from "zod";
import {
  KillswitchStateSchema,
  InstanceTenantIdSchema,
  GroupSlotSchema,
} from "../agents-instances/index.js";
import {
  AclCascadeSchema,
  AclDecisionSchema,
  RuntimeAclLevelSchema,
} from "../runtime/index.js";

/* ------------------------------------------------------------------ */
/*  MTLSConfigSchema                                                   */
/* ------------------------------------------------------------------ */

/**
 * Configuration mTLS vers AI-HUB central. Pas de bearer simple — TLS
 * mutual auth + ed25519 signed nonce anti-replay.
 *
 * Note : les chemins doivent pointer vers Vault-mounted secrets en prod.
 */
export const MTLSConfigSchema = z.object({
  /** URL AI-HUB cible (https obligatoire). */
  ai_hub_url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message: "ai_hub_url doit être HTTPS",
    }),
  /** Path vers client cert PEM. */
  client_cert_path: z.string().min(1).max(512),
  /** Path vers client key PEM. */
  client_key_path: z.string().min(1).max(512),
  /** Path vers CA bundle PEM (verifies AI-HUB cert). */
  ca_bundle_path: z.string().min(1).max(512),
  /** Fingerprint SHA-256 attendu du cert serveur AI-HUB (pinning). */
  server_fingerprint_sha256: z
    .string()
    .regex(/^[A-Fa-f0-9]{64}$/, "fingerprint SHA-256 invalide (64 hex)"),
  /** Tenant ID — envoyé en header X-Stakly-Tenant. */
  tenant_id: z.string().min(1).max(64),
  /** Path Vault vers la clé ed25519 de signing. */
  ed25519_signing_key_vault_path: z.string().min(1).max(512),
});
export type MTLSConfig = z.infer<typeof MTLSConfigSchema>;

/* ------------------------------------------------------------------ */
/*  KillswitchPollResultSchema                                         */
/* ------------------------------------------------------------------ */

/**
 * Résultat d'un poll AI-HUB. Si refus OU pas de réponse → engine bascule
 * en IDLE forced (TTL 30s max).
 */
export const KillswitchPollResultSchema = z.object({
  state: KillswitchStateSchema,
  /** Latence du poll en ms. */
  latency_ms: z.number().int().nonnegative(),
  /** Trace ID corrélation (UUID/ULID). */
  trace_id: z.string().min(1).max(64),
  /** Si true, l'engine doit forcer IDLE state immédiatement. */
  must_force_idle: z.boolean(),
});
export type KillswitchPollResult = z.infer<typeof KillswitchPollResultSchema>;

/* ------------------------------------------------------------------ */
/*  AIEHealthCheckSchema                                               */
/* ------------------------------------------------------------------ */

/**
 * Healthcheck unifié /healthz et /readyz.
 *
 *  - healthz : container UP + dépendances OK (toujours répond 200 si UP)
 *  - readyz  : healthz + killswitch active + L0 cache freshness OK
 */
export const AIEHealthStatusSchema = z.enum(["ok", "degraded", "down"]);
export type AIEHealthStatus = z.infer<typeof AIEHealthStatusSchema>;

export const AIEHealthCheckSchema = z.object({
  /** UP / degraded / DOWN. */
  status: AIEHealthStatusSchema,
  /** Version SemVer du container. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "SemVer requise"),
  /** Timestamp ISO. */
  at: z.string().datetime(),
  /** Sub-checks (ai_hub_reachable, vault_unsealed, l0_cache_fresh, etc.). */
  checks: z.record(
    z.string(),
    z.object({
      ok: z.boolean(),
      latency_ms: z.number().int().nonnegative().optional(),
      message: z.string().max(256).optional(),
    }),
  ),
  /** Killswitch courant (résumé). */
  killswitch_status: z.enum(["active", "idle_forced", "unknown"]),
  /** Uptime container en secondes. */
  uptime_sec: z.number().int().nonnegative(),
});
export type AIEHealthCheck = z.infer<typeof AIEHealthCheckSchema>;

/* ------------------------------------------------------------------ */
/*  InferenceRequestSchema                                             */
/* ------------------------------------------------------------------ */

/**
 * Requête d'inférence vers l'engine. La payload est intentionnellement
 * neutre — le prompt brut est résolu CÔTÉ ENGINE via cascade L0-L3 +
 * AI-HUB fetch. Le caller NE PEUT PAS injecter un prompt arbitraire
 * (anti-jailbreak fabrication-secret).
 */
export const InferenceRequestSchema = z.object({
  /** Slug d'agent (`agent.{pole}-{function}`). */
  agent_slug: z
    .string()
    .min(1)
    .max(44)
    .regex(/^agent\.[a-z0-9._-]+$/i, "agent slug invalide"),
  /** Tenant ID — issu de la session, NEVER from request body. */
  tenant_id: z.string().min(1).max(64),
  /** Acteur appelant (ACTR_ 44C). */
  actor_id: z.string().length(44),
  /** ID du scope ACL appliqué. */
  scope_id: z.number().int().positive(),
  /** Cascade ACL résolue (input pour l'ACL check). */
  acl_cascade: AclCascadeSchema,
  /** Message utilisateur — texte safe (pas de prompt injection allowed). */
  user_message: z.string().min(1).max(8_192),
  /** Contexte runtime libre (cohérent avec INS_ payload). */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Trace ID corrélation. */
  trace_id: z.string().min(1).max(64),
});
export type InferenceRequest = z.infer<typeof InferenceRequestSchema>;

/* ------------------------------------------------------------------ */
/*  InferenceResponseSchema                                            */
/* ------------------------------------------------------------------ */

/**
 * Réponse d'inférence. La réponse est explicite sur l'ACL decision pour
 * audit + UI feedback. Pas de chain-of-thought ni prompt système exposé.
 */
export const InferenceResponseSchema = z.object({
  /** Status (allow → ok, deny → forbidden, kill → killswitch). */
  status: z.enum(["ok", "forbidden", "killswitch", "error"]),
  /** Décision ACL résolue. */
  acl_decision: AclDecisionSchema,
  /** Texte de réponse (si ok). */
  output_text: z.string().max(16_384).nullable(),
  /** Métriques. */
  latency_ms: z.number().int().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  /** Signature ed25519 de la réponse pour audit chain. */
  signature: z.string().min(1).max(256).nullable(),
  trace_id: z.string().min(1).max(64),
  /** Code d'erreur si status != ok. */
  error_code: z.string().max(64).nullable(),
  error_message: z.string().max(512).nullable(),
});
export type InferenceResponse = z.infer<typeof InferenceResponseSchema>;

/* ------------------------------------------------------------------ */
/*  Helper : INTERSECTION ACL cascade                                  */
/* ------------------------------------------------------------------ */

/**
 * Décision INTERSECTION sur une cascade ACL :
 *  - forbidden_actors d'un seul layer = refus immédiat
 *  - immutable_by_lower_levels = layers inférieurs ignorent leur verdict
 *  - default_deny + aucune règle qui matche = refus
 *
 * Retourne `AclDecision`. Algo réutilisable côté engine + Hub.
 */
export function resolveAclCascade(
  cascade: z.infer<typeof AclCascadeSchema>,
  actor_id: string,
): z.infer<typeof AclDecisionSchema> {
  // Order: L0, L1, L2, L3. Process in order.
  // immutable_by_lower_levels at level L_n: if L_n produces a verdict,
  // it cannot be overridden by L_{n+1..3}.
  const levelOrder = ["L0", "L1", "L2", "L3"] as const;
  const sorted = [...cascade].sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level),
  );

  let immutableVerdict: z.infer<typeof AclDecisionSchema> | null = null;
  let allowSeen = false;

  for (const policy of sorted) {
    // Step 1: forbidden at any layer = immediate deny
    if (policy.forbidden_actors?.includes(actor_id)) {
      return {
        allowed: false,
        reason: `forbidden at ${policy.level}`,
        blocking_level: policy.level,
      };
    }
    // Step 2: allow at any layer counts
    if (policy.allowed_actors?.includes(actor_id)) {
      allowSeen = true;
      if (policy.immutable_by_lower_levels) {
        immutableVerdict = {
          allowed: true,
          reason: `allowed at ${policy.level} (immutable)`,
          blocking_level: null,
        };
      }
    }
    // Step 3: default_deny + no rule matched
    if (
      policy.default_deny &&
      !policy.allowed_actors?.includes(actor_id) &&
      !policy.forbidden_actors?.includes(actor_id) &&
      policy.immutable_by_lower_levels
    ) {
      immutableVerdict = {
        allowed: false,
        reason: `default_deny at ${policy.level} (immutable)`,
        blocking_level: policy.level,
      };
    }
  }

  if (immutableVerdict) return immutableVerdict;

  if (allowSeen) {
    return {
      allowed: true,
      reason: "intersection allowed",
      blocking_level: null,
    };
  }

  // Default behavior : deny if any default_deny present, else allow.
  const anyDefaultDeny = sorted.some((p) => p.default_deny);
  if (anyDefaultDeny) {
    const blocker = sorted.find((p) => p.default_deny)!;
    return {
      allowed: false,
      reason: "default_deny + no allow rule matched",
      blocking_level: blocker.level,
    };
  }
  return { allowed: true, reason: "no rule matched (open)", blocking_level: null };
}

/* ------------------------------------------------------------------ */
/*  CopilotSuggestRequestSchema (Sprint F.5b)                          */
/* ------------------------------------------------------------------ */

/**
 * Requête de suggestion copilote pour l'édition d'instructions d'agent.
 * Appelée depuis l'UI `AICopilotTab` via Hub tRPC `agentInstances.copilotSuggest`,
 * relayée à AIE `POST /copilot/suggest`.
 *
 * Le moteur :
 *  1. Check killswitch — si idle_forced → mock structuré (Iris en pause)
 *  2. Check ACL cascade INTERSECTION L0→L3
 *  3. Appel LLM stub (Ollama/vLLM en prod)
 *  4. Audit ed25519 chain
 *  5. Retourne {suggestions, was_idle_forced, audit_signature}
 *
 * @see memo `project_l0_ai_hub_killswitch_souverain_2026_06_08`
 */
export const CopilotSuggestRequestSchema = z.object({
  /** Slot human-friendly du groupe (ex: GRPMGR-MARKETING). */
  groupSlot: GroupSlotSchema,
  /** Layer cible de la suggestion (L0/L1/L2/L3). */
  layer: RuntimeAclLevelSchema,
  /** Texte brouillon en cours d'édition côté UI. */
  draftText: z.string().min(0).max(8_000),
  /** Contexte (instructions héritées des layers supérieurs). */
  instructionsContext: z.string().max(4_000).optional(),
  /** Tenant ID — issu de la session OIDC, jamais du body. */
  tenant: InstanceTenantIdSchema,
  /** Acteur appelant (ACTR_ 44C) pour ACL. */
  actor_id: z.string().length(44),
  /** Cascade ACL résolue (input pour le check INTERSECTION). */
  acl_cascade: AclCascadeSchema,
  /** Trace ID corrélation. */
  trace_id: z.string().min(1).max(64),
});
export type CopilotSuggestRequest = z.infer<typeof CopilotSuggestRequestSchema>;

/* ------------------------------------------------------------------ */
/*  CopilotSuggestionSchema                                            */
/* ------------------------------------------------------------------ */

/**
 * Une suggestion individuelle (kind discriminant + payload).
 *  - `rewrite`       : remplacement du brouillon par une version améliorée
 *  - `addition`      : ajout d'un paragraphe complémentaire
 *  - `lint_warning`  : avertissement structurel (anti-pattern, drift, etc.)
 */
export const CopilotSuggestionKindSchema = z.enum([
  "rewrite",
  "addition",
  "lint_warning",
]);
export type CopilotSuggestionKind = z.infer<typeof CopilotSuggestionKindSchema>;

export const CopilotSuggestionSchema = z.object({
  id: z.string().min(1).max(64),
  kind: CopilotSuggestionKindSchema,
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(500),
  reasoning: z.string().max(300).optional(),
  /** Confiance 0-100. */
  confidence: z.number().min(0).max(100),
});
export type CopilotSuggestion = z.infer<typeof CopilotSuggestionSchema>;

/* ------------------------------------------------------------------ */
/*  CopilotSuggestResponseSchema                                       */
/* ------------------------------------------------------------------ */

/**
 * Réponse copilote — toujours valide même si killswitch IDLE
 * (mock structuré renvoyé avec `was_idle_forced: true`).
 */
export const CopilotSuggestResponseSchema = z.object({
  /** 0 à 10 suggestions. Si killswitch IDLE → mock canned (3 typiques). */
  suggestions: z.array(CopilotSuggestionSchema).max(10),
  /** True si killswitch en mode idle_forced (mock servi). */
  was_idle_forced: z.boolean(),
  /** Signature ed25519 chaînée — audit append-only. */
  audit_signature: z.string().min(1).max(256),
  /** Timestamp ISO de génération. */
  generated_at: z.string().datetime(),
  /** Trace ID corrélation. */
  trace_id: z.string().min(1).max(64),
  /** Décision ACL résolue (UI peut afficher banner forbidden). */
  acl_decision: AclDecisionSchema,
  /**
   * Backend LLM réellement utilisé (Sprint G.7).
   *  - `"stub"`     : heuristique locale (Sprint F.5b)
   *  - `"ollama"`   : phi3:mini / llama3.2 / etc. local container
   *  - `"vllm"`     : déploiement vLLM futur
   *  - `null`       : pas de LLM call (killswitch idle ou ACL forbidden)
   */
  llm_backend: z.enum(["stub", "ollama", "vllm"]).nullable().optional(),
  /** Nom du modèle utilisé (ex: `phi3:mini`). null si pas de LLM call. */
  llm_model: z.string().max(80).nullable().optional(),
  /** Latence inférence LLM en ms (Sprint G.7). null si pas de LLM call. */
  llm_latency_ms: z.number().int().min(0).max(120_000).nullable().optional(),
  /**
   * True si Ollama a échoué (timeout/JSON invalide/5xx) et le stub heuristique
   * a été servi en fallback. Si true, `llm_backend === "stub"`.
   */
  was_ollama_fallback: z.boolean().optional(),
});
export type CopilotSuggestResponse = z.infer<typeof CopilotSuggestResponseSchema>;

/* ------------------------------------------------------------------ */
/*  CopilotSuggest streaming (Sprint G.8 — SSE)                        */
/* ------------------------------------------------------------------ */

/**
 * Backend LLM (réutilisé dans les events streaming).
 */
export const CopilotLlmBackendSchema = z.enum(["stub", "ollama", "vllm"]);
export type CopilotLlmBackend = z.infer<typeof CopilotLlmBackendSchema>;

/**
 * Event SSE émis au tout début du stream (avant le moindre token).
 * Permet à l'UI d'afficher un indicateur "Iris réfléchit..." + telemetry partielle.
 */
export const CopilotStreamStartedEventSchema = z.object({
  type: z.literal("started"),
  trace_id: z.string().min(1).max(64),
  tenant: z.string().min(1).max(64),
  llm_backend: CopilotLlmBackendSchema.nullable(),
  llm_model: z.string().max(80).nullable(),
  started_at: z.string().datetime(),
});
export type CopilotStreamStartedEvent = z.infer<
  typeof CopilotStreamStartedEventSchema
>;

/**
 * Event SSE émis pour chaque chunk de texte reçu d'Ollama.
 * `tokens_so_far` permet à l'UI d'afficher un compteur.
 */
export const CopilotStreamChunkEventSchema = z.object({
  type: z.literal("chunk"),
  /** Texte brut du chunk (token ou groupe de tokens). */
  text: z.string().max(2_000),
  /** Compteur cumulatif depuis le début du stream. */
  tokens_so_far: z.number().int().min(0),
});
export type CopilotStreamChunkEvent = z.infer<
  typeof CopilotStreamChunkEventSchema
>;

/**
 * Event SSE émis quand une suggestion complète a été parsée (JSON valide).
 * L'UI peut l'afficher progressivement.
 */
export const CopilotStreamSuggestionEventSchema = z.object({
  type: z.literal("suggestion"),
  /** Index ordinal de la suggestion (0-based). */
  index: z.number().int().min(0).max(9),
  suggestion: CopilotSuggestionSchema,
});
export type CopilotStreamSuggestionEvent = z.infer<
  typeof CopilotStreamSuggestionEventSchema
>;

/**
 * Event SSE final — contient le payload complet équivalent à la réponse
 * non-streaming, + telemetry de tokens totaux.
 */
export const CopilotStreamDoneEventSchema = z.object({
  type: z.literal("done"),
  suggestions: z.array(CopilotSuggestionSchema).max(10),
  was_idle_forced: z.boolean(),
  was_ollama_fallback: z.boolean(),
  audit_signature: z.string().min(1).max(256),
  llm_backend: CopilotLlmBackendSchema.nullable(),
  llm_model: z.string().max(80).nullable(),
  llm_latency_ms: z.number().int().min(0).max(120_000),
  total_tokens: z.number().int().min(0),
  generated_at: z.string().datetime(),
});
export type CopilotStreamDoneEvent = z.infer<
  typeof CopilotStreamDoneEventSchema
>;

/**
 * Event SSE d'erreur — termine le stream. UI affiche un badge + retry.
 */
export const CopilotStreamErrorCodeSchema = z.enum([
  "killswitch_idle",
  "acl_forbidden",
  "llm_timeout",
  "llm_invalid_json",
  "internal",
]);
export type CopilotStreamErrorCode = z.infer<
  typeof CopilotStreamErrorCodeSchema
>;

export const CopilotStreamErrorEventSchema = z.object({
  type: z.literal("error"),
  code: CopilotStreamErrorCodeSchema,
  message: z.string().max(500),
});
export type CopilotStreamErrorEvent = z.infer<
  typeof CopilotStreamErrorEventSchema
>;

/**
 * Union discriminée de tous les events SSE possibles.
 * Le caller (UI) doit valider chaque event reçu via `safeParse`.
 */
export const CopilotStreamEventSchema = z.discriminatedUnion("type", [
  CopilotStreamStartedEventSchema,
  CopilotStreamChunkEventSchema,
  CopilotStreamSuggestionEventSchema,
  CopilotStreamDoneEventSchema,
  CopilotStreamErrorEventSchema,
]);
export type CopilotStreamEvent = z.infer<typeof CopilotStreamEventSchema>;

/* ------------------------------------------------------------------ */
/*  AI-HUB Admin Killswitch (Sprint G.9)                               */
/* ------------------------------------------------------------------ */

/**
 * État runtime du killswitch tel que vu par AI-HUB central.
 *
 *  - `active`      : poll OK, engine tourne normalement
 *  - `idle_forced` : Stakly a forcé l'engine en pause (TTL 30s revalidé)
 *  - `degraded`    : poll partiel, engine fonctionne en mode dégradé
 *
 * Distinct du `KillswitchToggleInput.active` (boolean) côté Hub→OPA :
 * ici on lit l'état RÉEL côté AI-HUB qui fait foi pour les engines.
 *
 * Cf. mémoire `project_l0_ai_hub_killswitch_souverain_2026_06_08`.
 */
export const AiHubKillswitchStateSchema = z.enum([
  "active",
  "idle_forced",
  "degraded",
]);
export type AiHubKillswitchState = z.infer<typeof AiHubKillswitchStateSchema>;

/**
 * État d'un tenant côté AI-HUB. Surface NORMALISÉE : aucun champ interne
 * (clé Vault, jeton mTLS, signature ed25519...) n'est exposé.
 */
export const AiHubKillswitchTenantStateSchema = z.object({
  /** Slug du tenant (ex: `000003`, `000010`). */
  tenant_id: z.string().min(1).max(64),
  /** État courant (cf. `AiHubKillswitchStateSchema`). */
  state: AiHubKillswitchStateSchema,
  /** Raison libre — `null` si aucun toggle explicite (mode default). */
  reason: z.string().max(500).nullable(),
  /** Timestamp ISO-8601 de la dernière mise à jour (UTC ou offset). */
  updated_at: z.string().datetime({ offset: true }),
  /** Acteur qui a posé/changé l'état (email ou actor_id). `null` si default. */
  updated_by: z.string().max(128).nullable(),
  /** Timestamp ISO-8601 d'expiration auto-revoke. `null` si pas d'expiration. */
  expires_at: z.string().datetime().nullable(),
});
export type AiHubKillswitchTenantState = z.infer<
  typeof AiHubKillswitchTenantStateSchema
>;

/**
 * Tête (head) du log audit AI-HUB. Métadonnées de la chaîne ed25519
 * append-only — la chaîne complète n'est PAS exposée à l'UI (sécurité +
 * volume), seule la head sert à monitorer la freshness.
 */
export const AiHubKillswitchAuditHeadSchema = z.object({
  /** Timestamp ISO-8601 de la dernière entrée du chain. `null` si vide. */
  last_entry_at: z.string().datetime({ offset: true }).nullable(),
  /** Nombre total d'entrées dans le chain (>= 0). */
  total_entries: z.number().int().min(0),
  /** Hash SHA-256 hexa de la dernière entrée. `null` si chain vide. */
  hash: z.string().regex(/^[A-Fa-f0-9]{64}$/, "SHA-256 hex 64 chars requis").nullable(),
});
export type AiHubKillswitchAuditHead = z.infer<
  typeof AiHubKillswitchAuditHeadSchema
>;

/**
 * Réponse de `admin.aiHubKillswitch.list` — tous les tenants + head audit.
 */
export const AiHubKillswitchListResponseSchema = z.object({
  tenants: z.array(AiHubKillswitchTenantStateSchema),
  audit_head: AiHubKillswitchAuditHeadSchema.nullable(),
});
export type AiHubKillswitchListResponse = z.infer<
  typeof AiHubKillswitchListResponseSchema
>;

/**
 * Entrée du `admin.aiHubKillswitch.set` — force la bascule.
 *
 * `reason` est OBLIGATOIRE pour traçabilité audit RGPD / EU AI Act, même
 * pour un retour à `active` via cette route (à distinguer de `clear`).
 */
export const AiHubKillswitchSetRequestSchema = z.object({
  tenant_id: z.string().min(1).max(64),
  state: AiHubKillswitchStateSchema,
  reason: z.string().min(3).max(500),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type AiHubKillswitchSetRequest = z.infer<
  typeof AiHubKillswitchSetRequestSchema
>;

/**
 * Entrée du `admin.aiHubKillswitch.clear` — reset à `active`.
 */
export const AiHubKillswitchClearRequestSchema = z.object({
  tenant_id: z.string().min(1).max(64),
});
export type AiHubKillswitchClearRequest = z.infer<
  typeof AiHubKillswitchClearRequestSchema
>;

/**
 * Réponse de `set` / `clear` — succès + état résultant.
 */
export const AiHubKillswitchMutationResponseSchema = z.object({
  success: z.literal(true),
  state: AiHubKillswitchStateSchema,
  tenant_id: z.string().min(1).max(64),
});
export type AiHubKillswitchMutationResponse = z.infer<
  typeof AiHubKillswitchMutationResponseSchema
>;
