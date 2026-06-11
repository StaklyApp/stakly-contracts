/**
 * Regex strictes pour valider un T44C.
 *
 * Format canonique : `<TYPE>_<LEVEL>_<TENANT>_<SKU>_<VERSION>_<DATE>`
 *   - TYPE    : 4 chars [A-Z0-9_] (un des C44_TYPES_ALL)
 *   - LEVEL   : 2 chars [A-Z0-9] (L0|L1|L2|L3)
 *   - TENANT  : 6 chars [A-Z0-9]
 *   - SKU     : 6 chars [A-Z0-9]
 *   - VERSION : 3 chars [A-Z0-9]
 *   - DATE    : 8 chars [A-Z0-9] (YYMMDDRR)
 *
 * Total : 4+1+2+1+6+1+6+1+3+1+8 = 34 chars caractères pertinents + 5 séparateurs
 *        = 39, padding à 44 caractères max si segments plus courts.
 *
 * Stratégie 44 chars EXACTS : tous les segments sont right-padded avec `_`
 * pour atteindre la longueur fixe. Le regex full-string `STRICT_44C_REGEX`
 * valide 44 caractères exacts. Le regex `LOOSE_44C_REGEX` accepte 1-44
 * caractères pour les usages slot UI/legacy.
 */

/**
 * Regex strict — UN identifiant 44C canonique sur 44 chars exacts.
 * Forme : `^[A-Z0-9_]{44}$`
 *
 * - Lettres majuscules + chiffres + underscore.
 * - Pas d'espace, pas de caractère spécial.
 * - Longueur 44 EXACTS.
 */
export const STRICT_44C_REGEX = /^[A-Z0-9_]{44}$/;

/**
 * Regex permissif — 1 à 44 chars, alphabet T44C (UPPERCASE + 0-9 + `_`).
 * Utile pour slots Display Engine en transition (V1 acceptait `tile:tile:foo`).
 */
export const LOOSE_44C_REGEX = /^[A-Z0-9_]{1,44}$/;

/**
 * Regex décomposé — 6 segments séparés par `_` (sans padding).
 * Capture les 6 groupes : type, level, tenant, sku, version, date.
 *
 * Tolérance : segments de longueur variable mais bornes T1 :
 *   type [A-Z_]{3,4}, level L[0-3], tenant [A-Z0-9]{1,6},
 *   sku [A-Z0-9]{1,6}, version [A-Z0-9]{1,3}, date [A-Z0-9]{6,8}.
 */
export const PARTS_44C_REGEX =
  /^([A-Z][A-Z_]{2,3})_(L[0-3])_([A-Z0-9]{1,6})_([A-Z0-9]{1,6})_([A-Z0-9]{1,3})_([A-Z0-9]{6,8})$/;

/**
 * Longueur fixe d'un T44C canonique.
 */
export const C44_LENGTH = 44 as const;

/**
 * Alphabet autorisé pour un T44C (UPPERCASE alpha + chiffres + underscore).
 */
export const C44_ALPHABET_REGEX = /^[A-Z0-9_]+$/;
