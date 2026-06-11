/**
 * Helpers `is44C`, `parse44C`, `format44C` — manipulation des identifiants
 * 44C en mode strict et tolérant.
 */

import {
  C44_LENGTH,
  C44_ALPHABET_REGEX,
  PARTS_44C_REGEX,
  STRICT_44C_REGEX,
} from "./regex.js";
import {
  C44_TYPES_ALL,
  type C44Level,
  type C44Parts,
  type C44Type,
  type T44C,
  asT44C,
} from "./types.js";

/* ------------------------------------------------------------------ */
/*  is44C                                                              */
/* ------------------------------------------------------------------ */

/**
 * Type-guard : `true` si `value` matche la regex stricte 44 chars.
 *
 * À utiliser systématiquement avant de typer une `string` en `T44C` :
 *
 * ```ts
 * if (is44C(input)) {
 *   // input est T44C ici
 *   send(input);
 * }
 * ```
 */
export function is44C(value: unknown): value is T44C {
  return typeof value === "string" && STRICT_44C_REGEX.test(value);
}

/**
 * Variant tolérant — accepte 1..44 chars. Utile pour slots V1 Display
 * Engine en migration.
 */
export function isLoose44C(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= C44_LENGTH &&
    C44_ALPHABET_REGEX.test(value)
  );
}

/* ------------------------------------------------------------------ */
/*  parse44C                                                           */
/* ------------------------------------------------------------------ */

/**
 * Décompose un T44C en ses 6 segments stables.
 *
 * @throws Error si format invalide (type inconnu, séparateurs absents).
 */
export function parse44C(value: string): C44Parts {
  if (typeof value !== "string") {
    throw new Error("parse44C: argument must be a string");
  }
  if (value.length === 0 || value.length > C44_LENGTH) {
    throw new Error(
      `parse44C: length ${value.length} out of bounds (1..${C44_LENGTH})`,
    );
  }

  // Strip trailing padding underscores pour matcher PARTS_44C_REGEX qui
  // accepte des segments de longueur variable. On préserve les `_` internes
  // des types eux-mêmes (ex `CTR_`, `ACL_`, `MSG_`).
  const trimmed = stripTrailingPadding(value);
  const match = trimmed.match(PARTS_44C_REGEX);
  if (!match) {
    throw new Error(
      `parse44C: invalid format (expected <TYPE>_<LEVEL>_<TENANT>_<SKU>_<VERSION>_<DATE>), got "${value}"`,
    );
  }

  const [, typeRaw, levelRaw, tenant, sku, version, date] = match;
  if (!typeRaw || !levelRaw || !tenant || !sku || !version || !date) {
    throw new Error(`parse44C: missing segment in "${value}"`);
  }

  // Le type peut avoir été stocké sans trailing `_` (ex `CTR` au lieu de `CTR_`).
  // On réintègre le `_` pour les 4 types qui en ont besoin (CTR_, ACL_, SCP_,
  // MSG_, INS_, EVT_, RSP_).
  const type = normalizeType(typeRaw);
  if (!C44_TYPES_ALL.includes(type as C44Type)) {
    throw new Error(`parse44C: unknown type "${typeRaw}" in "${value}"`);
  }

  return {
    type: type as C44Type,
    level: levelRaw as C44Level,
    tenant,
    sku,
    version,
    date,
  };
}

/**
 * Variante non-throwing : renvoie `null` si invalide.
 */
export function tryParse44C(value: string): C44Parts | null {
  try {
    return parse44C(value);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  format44C                                                          */
/* ------------------------------------------------------------------ */

/**
 * Compose un T44C canonique depuis ses 6 segments.
 *
 *  - Right-pad chaque segment avec `_` pour atteindre 44 chars exacts.
 *  - Valide chaque segment contre son alphabet.
 *  - Renvoie un T44C branded (assured 44 chars).
 *
 * @throws Error si un segment dépasse sa borne max, ou si la concat
 *               totale dépasse 44 chars.
 */
export function format44C(parts: C44Parts): T44C {
  const { type, level, tenant, sku, version, date } = parts;

  // Sanity each segment.
  validateSegment("type", type, 3, 4);
  validateSegment("level", level, 2, 2);
  validateSegment("tenant", tenant, 1, 6);
  validateSegment("sku", sku, 1, 6);
  validateSegment("version", version, 1, 3);
  validateSegment("date", date, 6, 8);

  const raw = [type, level, tenant, sku, version, date].join("_");
  if (raw.length > C44_LENGTH) {
    throw new Error(
      `format44C: composed length ${raw.length} > ${C44_LENGTH}`,
    );
  }
  const padded = raw.padEnd(C44_LENGTH, "_");
  if (!STRICT_44C_REGEX.test(padded)) {
    throw new Error(
      `format44C: padded result "${padded}" does not match STRICT_44C_REGEX`,
    );
  }
  return asT44C(padded);
}

/* ------------------------------------------------------------------ */
/*  Helpers internes                                                   */
/* ------------------------------------------------------------------ */

function stripTrailingPadding(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "_") {
    end--;
  }
  return value.slice(0, end);
}

function normalizeType(typeRaw: string): string {
  // Si le type matche un type sans `_` trailing (ex `CTR`), on essaie d'ajouter
  // `_` pour matcher la convention `CTR_`. Si déjà 4 chars, on garde tel quel.
  if (typeRaw.length === 4) {
    return typeRaw;
  }
  if (typeRaw.length === 3) {
    const candidate = `${typeRaw}_`;
    if (C44_TYPES_ALL.includes(candidate as C44Type)) {
      return candidate;
    }
  }
  return typeRaw;
}

function validateSegment(
  name: string,
  value: string,
  min: number,
  max: number,
): void {
  if (typeof value !== "string") {
    throw new Error(`format44C: segment ${name} must be a string`);
  }
  if (value.length < min || value.length > max) {
    throw new Error(
      `format44C: segment ${name} length ${value.length} out of bounds (${min}..${max})`,
    );
  }
  if (!C44_ALPHABET_REGEX.test(value)) {
    throw new Error(
      `format44C: segment ${name} "${value}" contains invalid chars (alphabet [A-Z0-9_])`,
    );
  }
}
