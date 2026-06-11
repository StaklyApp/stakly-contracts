/**
 * 44C — Lingua franca runtime types.
 *
 * Convention `T1` Stakly v3 : tout identifiant Stakly s'exprime sur 44
 * caractères max au format `<TYPE>_<LEVEL>_<TENANT>_<SKU>_<VERSION>_<DATE>`
 * (séparateur `_`, 6 segments). 12 types canon :
 *
 *  Persistants (8) :
 *    - ACTR : ACTeuR (humain ou agent IA, cf. ACTR_44 chars memo)
 *    - EDGE : EDGE (relation orientée entre deux ACTR / ROOM / SCP)
 *    - CTR_ : ConTaineR (Docker, manifest CTR_PCKTOOLS, etc.)
 *    - PACK : PACK marketplace (L1/L2/L3)
 *    - WIRE : WIRE de configuration / câblage entre packs
 *    - ROOM : ROOM Matrix (canal Synapse)
 *    - ACL_ : Access Control List (cascade L0→L3)
 *    - SCP_ : SCoPe (périmètre / scope d'agent ou de skill)
 *
 *  Runtime éphémères (4) :
 *    - MSG_ : MeSsaGe (chat user/agent)
 *    - INS_ : INSight (résultat agent IA)
 *    - EVT_ : EVénemenT système
 *    - RSP_ : RéSPonse synchrone agent
 *
 *  + UI surfaces canonical (Z3 toolbar / dashboards) :
 *    - TILE : TuILE display
 *    - TASK : TASK projet
 *    - DISP : DISPlay unit slot
 *    - FLOW : FLOW (workflow / pipeline)
 *
 * Humain ne voit JAMAIS un 44C en UI client (cf. memo lingua franca).
 * Le 44C circule uniquement entre Hub ↔ packs ↔ Odoo / Matrix / Qdrant.
 */

/* ------------------------------------------------------------------ */
/*  Enums fermées — toute extension nécessite revue                    */
/* ------------------------------------------------------------------ */

/**
 * Types 44C persistants — stockés en base, identité stable.
 */
export const C44_TYPES_PERSISTENT = [
  "ACTR",
  "EDGE",
  "CTR_",
  "PACK",
  "WIRE",
  "ROOM",
  "ACL_",
  "SCP_",
] as const;
export type C44TypePersistent = (typeof C44_TYPES_PERSISTENT)[number];

/**
 * Types 44C runtime — éphémères, vivent dans Redis stream / SSE.
 */
export const C44_TYPES_RUNTIME = ["MSG_", "INS_", "EVT_", "RSP_"] as const;
export type C44TypeRuntime = (typeof C44_TYPES_RUNTIME)[number];

/**
 * Types 44C surface UI — slot d'affichage canonique.
 */
export const C44_TYPES_SURFACE = ["TILE", "TASK", "DISP", "FLOW"] as const;
export type C44TypeSurface = (typeof C44_TYPES_SURFACE)[number];

/**
 * Union exhaustive des 16 types 44C connus (8 + 4 + 4).
 * Cf. memo `project_lingua_franca_44c_runtime_2026_06_10`.
 */
export const C44_TYPES_ALL = [
  ...C44_TYPES_PERSISTENT,
  ...C44_TYPES_RUNTIME,
  ...C44_TYPES_SURFACE,
] as const;
export type C44Type = (typeof C44_TYPES_ALL)[number];

/**
 * Niveaux ACL cascade L0→L3 — invariant Stakly.
 *  - L0 : sécurité Stakly globale (jamais exposé client)
 *  - L1 : standard public tenant
 *  - L2 : pack-specific (créateur tiers)
 *  - L3 : user-specific (perso)
 */
export const C44_LEVELS = ["L0", "L1", "L2", "L3"] as const;
export type C44Level = (typeof C44_LEVELS)[number];

/* ------------------------------------------------------------------ */
/*  T44C — chaîne brute typée                                          */
/* ------------------------------------------------------------------ */

/**
 * Une chaîne 44C — opaque côté front. Toujours produit/validé via les
 * helpers `is44C`, `parse44C`, `format44C`.
 *
 * Utiliser via le brand TypeScript `T44C` plutôt que `string` brut pour
 * que le compilateur refuse les passages directs sans validation.
 */
declare const __brand44C: unique symbol;
export type T44C = string & { readonly [__brand44C]: "T44C" };

/**
 * Aide pour caster une string en T44C (DOIT être précédé d'un is44C/parse).
 * @internal Usage interne package contracts uniquement.
 */
export function asT44C(s: string): T44C {
  return s as T44C;
}

/* ------------------------------------------------------------------ */
/*  Parts décomposés                                                   */
/* ------------------------------------------------------------------ */

/**
 * Résultat de `parse44C(str)` — décomposition en 6 segments stables.
 *
 *   `<TYPE>_<LEVEL>_<TENANT>_<SKU>_<VERSION>_<DATE>`
 *
 *  - type    : enum C44Type (4 chars padded avec `_`)
 *  - level   : enum C44Level
 *  - tenant  : 6 chars (slug court canonique, ex `000000`, `STKMTH`)
 *  - sku     : 6 chars (sku pack ou identifiant rôle ACTR)
 *  - version : 3 chars (ex `001`, `V01`)
 *  - date    : 8 chars (YYMMDDRR — date packing avec révision RR)
 */
export interface C44Parts {
  readonly type: C44Type;
  readonly level: C44Level;
  readonly tenant: string;
  readonly sku: string;
  readonly version: string;
  readonly date: string;
}
