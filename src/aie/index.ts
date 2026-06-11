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
});
export type CopilotSuggestResponse = z.infer<typeof CopilotSuggestResponseSchema>;
