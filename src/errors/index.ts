/**
 * StaklyError — discriminated union des erreurs typées Stakly v3.
 *
 * Sert de contrat commun entre Hub BFF (lèveur) et Stakly UI (handler).
 * Un consommateur peut switcher sur `code` pour afficher le bon UX.
 *
 * Conventions :
 *  - `code` est un littéral string (enum fermée).
 *  - `message` est lisible humain mais PAS la source de vérité pour la
 *    logique : la logique switch sur `code`.
 *  - `details` est libre (debug payload), JAMAIS de secret/PII brut.
 *
 * Mapping HTTP / tRPC :
 *  - UNAUTHORIZED   → 401
 *  - FORBIDDEN      → 403
 *  - NOT_FOUND      → 404
 *  - BAD_REQUEST    → 400
 *  - CONFLICT       → 409
 *  - ACL_DENIED     → 403 (sous-cas de FORBIDDEN avec niveau bloquant)
 *  - TENANT_MISSING → 403
 *  - ACTOR_INVALID  → 400
 *  - RATE_LIMIT     → 429
 *  - INTERNAL       → 500
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Codes — enum fermée                                                */
/* ------------------------------------------------------------------ */

export const StaklyErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "ACL_DENIED",
  "TENANT_MISSING",
  "ACTOR_INVALID",
  "RATE_LIMIT",
  "INTERNAL",
]);
export type StaklyErrorCode = z.infer<typeof StaklyErrorCodeSchema>;

/* ------------------------------------------------------------------ */
/*  Base error envelope                                                */
/* ------------------------------------------------------------------ */

const BaseErrorShape = {
  message: z.string().min(1).max(512),
  /** Trace / corrélation request_id pour log lookup. */
  request_id: z.string().max(64).optional(),
  /** Détail libre (JAMAIS de secret ou PII brut). */
  details: z.record(z.string(), z.unknown()).optional(),
} as const;

/* ------------------------------------------------------------------ */
/*  Variantes typées                                                   */
/* ------------------------------------------------------------------ */

export const UnauthorizedErrorSchema = z.object({
  code: z.literal("UNAUTHORIZED"),
  ...BaseErrorShape,
});

export const ForbiddenErrorSchema = z.object({
  code: z.literal("FORBIDDEN"),
  ...BaseErrorShape,
});

export const NotFoundErrorSchema = z.object({
  code: z.literal("NOT_FOUND"),
  ...BaseErrorShape,
  /** Ressource demandée (ex `agent.std-rh-onboarding`). */
  resource: z.string().max(128).optional(),
});

export const BadRequestErrorSchema = z.object({
  code: z.literal("BAD_REQUEST"),
  ...BaseErrorShape,
  /** Champ fautif (ex `slot`, `tenant`). */
  field: z.string().max(64).optional(),
});

export const ConflictErrorSchema = z.object({
  code: z.literal("CONFLICT"),
  ...BaseErrorShape,
});

export const AclDeniedErrorSchema = z.object({
  code: z.literal("ACL_DENIED"),
  ...BaseErrorShape,
  /** Niveau ACL qui a bloqué (debug audit). */
  blocking_level: z.enum(["L0", "L1", "L2", "L3"]),
});

export const TenantMissingErrorSchema = z.object({
  code: z.literal("TENANT_MISSING"),
  ...BaseErrorShape,
});

export const ActorInvalidErrorSchema = z.object({
  code: z.literal("ACTOR_INVALID"),
  ...BaseErrorShape,
  /** Actor 44C / uid invalide. */
  actor: z.string().max(128).optional(),
});

export const RateLimitErrorSchema = z.object({
  code: z.literal("RATE_LIMIT"),
  ...BaseErrorShape,
  retry_after_ms: z.number().int().nonnegative(),
});

export const InternalErrorSchema = z.object({
  code: z.literal("INTERNAL"),
  ...BaseErrorShape,
});

/* ------------------------------------------------------------------ */
/*  Union discriminée                                                  */
/* ------------------------------------------------------------------ */

export const StaklyErrorSchema = z.discriminatedUnion("code", [
  UnauthorizedErrorSchema,
  ForbiddenErrorSchema,
  NotFoundErrorSchema,
  BadRequestErrorSchema,
  ConflictErrorSchema,
  AclDeniedErrorSchema,
  TenantMissingErrorSchema,
  ActorInvalidErrorSchema,
  RateLimitErrorSchema,
  InternalErrorSchema,
]);
export type StaklyError = z.infer<typeof StaklyErrorSchema>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Type-guard : `true` si `value` est une StaklyError valide.
 */
export function isStaklyError(value: unknown): value is StaklyError {
  return StaklyErrorSchema.safeParse(value).success;
}

/**
 * Construit une StaklyError avec validation immédiate.
 */
export function makeStaklyError<T extends StaklyError>(err: T): T {
  return StaklyErrorSchema.parse(err) as T;
}

/* ------------------------------------------------------------------ */
/*  Mapping HTTP                                                       */
/* ------------------------------------------------------------------ */

const HTTP_STATUS_MAP: Readonly<Record<StaklyErrorCode, number>> = Object.freeze({
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  ACL_DENIED: 403,
  TENANT_MISSING: 403,
  ACTOR_INVALID: 400,
  RATE_LIMIT: 429,
  INTERNAL: 500,
});

/**
 * Renvoie le code HTTP associé à un StaklyErrorCode.
 */
export function httpStatusForStaklyError(code: StaklyErrorCode): number {
  return HTTP_STATUS_MAP[code];
}
