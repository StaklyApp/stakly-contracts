/**
 * Display Engine — schemas Zod du module stakly-display-engine v3.
 *
 * Repris (sans rupture comportementale) depuis `stakly-hub/src/display-engine/types.ts`
 * et étendu pour couvrir les 10 kinds canon (cf. brief module d'affichage
 * unifié 2026-06-07 + sprint Tools Z3 2026-06-10).
 *
 * Le slot est l'identifiant client-side d'UNE unité d'affichage.
 *
 * Format strict T1 :
 *   - V1 (acceptée) : `<type>:<kind>:<target>[:<modifier>]`, ≤ 44 chars
 *   - V2 (cible) : T44C canonique `DISP_L?_<tenant>_<sku>_<version>_<date>`
 *
 * ACL multi-héritage INTERSECTION centralisée — un refus d'un seul niveau
 * cascade arrête tout (cf. memo `project_moteur_ia_acl_2026_06_10`).
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  DisplayUnitKind — 10 surfaces canon                                */
/* ------------------------------------------------------------------ */

/**
 * 10 kinds canon couvrant toutes les surfaces UI Stakly v3 :
 *
 *   - tile         : 240×120 — surface principale dashboard
 *   - mini-card    : 120×45 — sidebar drill / agent-bar
 *   - card-large   : 360×200 — hero / drill principal
 *   - icon         : 50×25 — barre top systray
 *   - sub-menu     : ligne menu déroulant (sidebar Z1)
 *   - stat         : tuile statistique compacte
 *   - insight      : encart résultat agent IA (text + meta)
 *   - action       : bouton/CTA actionnable
 *   - menu         : entrée menu principal (Z1 niveau 1)
 *   - card         : carte standard (générique, fallback)
 */
export const DisplayUnitKindSchema = z.enum([
  "tile",
  "mini-card",
  "card-large",
  "icon",
  "sub-menu",
  "stat",
  "insight",
  "action",
  "menu",
  "card",
]);
export type DisplayUnitKind = z.infer<typeof DisplayUnitKindSchema>;

/* ------------------------------------------------------------------ */
/*  Slot — type/kind/target + niveau ACL                               */
/* ------------------------------------------------------------------ */

/**
 * Types de slot — chaque type route vers un resolver dédié dans Hub BFF.
 * V1 = 3 types principaux (tile, task, room). Extension P2.DE.3 prévue
 * (agent, metric, doc).
 */
export const SlotTypeSchema = z.enum(["tile", "task", "room"]);
export type SlotType = z.infer<typeof SlotTypeSchema>;

/**
 * Slot kind — V1 historique = 3 renderers (tile/mini-card/card-large).
 * Jalon E2 (2026-06-11) : étendu aux 10 kinds canon pour que le slot grammar
 * `<type>:<kind>:<target>` puisse adresser TOUTES les surfaces (icon, stat,
 * insight, action, menu, sub-menu, card). Reste aligné `DisplayUnitKindSchema`.
 *
 * NB : `SlotKindSchema` et `DisplayUnitKindSchema` sont volontairement
 * distincts pour pouvoir diverger plus tard (ex : ajouter `chart` côté
 * `DisplayUnitKind` sans rendre le slot grammar parseable).
 */
export const SlotKindSchema = z.enum([
  "tile",
  "mini-card",
  "card-large",
  "icon",
  "sub-menu",
  "stat",
  "insight",
  "action",
  "menu",
  "card",
]);
export type SlotKind = z.infer<typeof SlotKindSchema>;

/**
 * Niveau ACL — cascade L0→L3. L0 est REJETÉ explicitement par tout
 * resolver Display Engine (cf. acl-check.ts du hub).
 */
export const AclLevelSchema = z.enum(["L0", "L1", "L2", "L3"]);
export type AclLevel = z.infer<typeof AclLevelSchema>;

/* ------------------------------------------------------------------ */
/*  SlotDescriptor (parsed)                                            */
/* ------------------------------------------------------------------ */

/**
 * Descripteur typé d'un slot après parsing. Reflet 1:1 de l'interface
 * `SlotDescriptor` du hub.
 */
export const SlotDescriptorSchema = z.object({
  /** Slot original tel que reçu (chaîne brute, ≤ 44 chars). */
  raw: z.string().min(1).max(44),
  type: SlotTypeSchema,
  kind: SlotKindSchema,
  target: z.string().min(1),
  level: AclLevelSchema,
  cacheTtlSec: z.number().int().positive().optional(),
});
export type SlotDescriptor = z.infer<typeof SlotDescriptorSchema>;

/* ------------------------------------------------------------------ */
/*  DisplayUnitSpec — spec déclarative côté pack manifest              */
/* ------------------------------------------------------------------ */

/**
 * Spec déclarative d'une unité d'affichage telle que définie dans un
 * manifest de pack marketplace. Le Hub BFF résout `slot` → `DisplayResolved`
 * en appelant le bon resolver/renderer.
 */
export const DisplayUnitSpecSchema = z.object({
  slot: z.string().min(1).max(44),
  kind: DisplayUnitKindSchema,
  /** Source de données (id résolveur Hub) — ex `tile:tile:summary-rh`. */
  source: z.string().min(1).max(64),
  /** Métadonnées libres pour le pack (titre par défaut, hint, etc.). */
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type DisplayUnitSpec = z.infer<typeof DisplayUnitSpecSchema>;

/* ------------------------------------------------------------------ */
/*  Payloads V1 renderers (3 kinds historiques)                        */
/* ------------------------------------------------------------------ */

const ToneSchema = z.enum(["neutral", "info", "success", "warn", "danger"]);
export type DisplayTone = z.infer<typeof ToneSchema>;

const BadgeSchema = z.object({
  value: z.string(),
  tone: ToneSchema,
});

export const DisplayTilePayloadSchema = z.object({
  kind: z.literal("tile"),
  slot: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: BadgeSchema.optional(),
  hint: z.string().optional(),
});
export type DisplayTilePayload = z.infer<typeof DisplayTilePayloadSchema>;

export const DisplayMiniCardPayloadSchema = z.object({
  kind: z.literal("mini-card"),
  slot: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  badge: BadgeSchema.optional(),
  iconHint: z.string().optional(),
});
export type DisplayMiniCardPayload = z.infer<typeof DisplayMiniCardPayloadSchema>;

export const DisplayCardLargePayloadSchema = z.object({
  kind: z.literal("card-large"),
  slot: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  rows: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .max(20),
  badge: BadgeSchema.optional(),
});
export type DisplayCardLargePayload = z.infer<typeof DisplayCardLargePayloadSchema>;

/* ------------------------------------------------------------------ */
/*  Payloads V2 renderers (7 kinds Jalon E2)                           */
/* ------------------------------------------------------------------ */

/**
 * Tone enrichi V2 — superset stricte de ToneSchema (qui contient
 * `warn`). On garde `warn` (compat V1) ET on ajoute `warning` (V2 spec).
 * Côté UI on dégrade ; côté tests on accepte les deux noms.
 */
const ToneV2Schema = z.enum([
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
]);
export type DisplayToneV2 = z.infer<typeof ToneV2Schema>;

/**
 * Tone des stat tile — sans `info` pour rester aligné brief
 * (neutral/success/warning/danger uniquement).
 */
const StatToneSchema = z.enum(["neutral", "success", "warning", "danger"]);
export type DisplayStatTone = z.infer<typeof StatToneSchema>;

/* ============ 1. icon (40×40 atomic action) ============ */

const IconBadgeSchema = z.object({
  count: z.number().int().min(0),
  dot: z.boolean().optional(),
});

export const DisplayPayloadIconSchema = z.object({
  kind: z.literal("icon"),
  slot: z.string(),
  /** Nom d'icone Lucide (ex `bell`, `inbox`, `shield-check`). */
  icon: z.string().min(1).max(48),
  /** Label accessible (aria-label) — max 24 chars. */
  label: z.string().min(1).max(24),
  tone: ToneV2Schema,
  href: z.string().min(1).max(512).optional(),
  /** Identifiant 44C `ACT_*` à dispatcher côté front. */
  onClick: z.string().min(1).max(44).optional(),
  badge: IconBadgeSchema.optional(),
});
export type DisplayPayloadIcon = z.infer<typeof DisplayPayloadIconSchema>;

/* ============ 2. sub-menu (navigation item, 2 niveaux max) ============ */

const SubMenuChildSchema = z.object({
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(512),
  active: z.boolean().optional(),
});

const SubMenuBadgeSchema = z.object({
  count: z.number().int().min(0),
});

export const DisplayPayloadSubMenuSchema = z.object({
  kind: z.literal("sub-menu"),
  slot: z.string(),
  label: z.string().min(1).max(40),
  icon: z.string().max(48).optional(),
  href: z.string().min(1).max(512),
  active: z.boolean().optional(),
  /** Maximum 10 enfants — 2 niveaux de hiérarchie. */
  children: z.array(SubMenuChildSchema).max(10).optional(),
  badge: SubMenuBadgeSchema.optional(),
});
export type DisplayPayloadSubMenu = z.infer<typeof DisplayPayloadSubMenuSchema>;

/* ============ 3. stat (180×100 metric tile) ============ */

const StatDeltaSchema = z.object({
  value: z.number(),
  period: z.enum(["day", "week", "month"]),
  direction: z.enum(["up", "down", "flat"]),
});

export const DisplayPayloadStatSchema = z.object({
  kind: z.literal("stat"),
  slot: z.string(),
  label: z.string().min(1).max(32),
  value: z.union([z.string().max(32), z.number()]),
  unit: z.string().max(8).optional(),
  delta: StatDeltaSchema.optional(),
  tone: StatToneSchema,
  icon: z.string().max(48).optional(),
});
export type DisplayPayloadStat = z.infer<typeof DisplayPayloadStatSchema>;

/* ============ 4. insight (320×140 AI-generated insight) ============ */

const InsightSourceSchema = z.object({
  /** UID 44C de l'agent (ex `agent.std-cmo`). */
  agent_id: z.string().min(1).max(64),
  /** Label humain (ex `Iris CMO`). */
  agent_label: z.string().min(1).max(40),
});

const InsightActionSchema = z.object({
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(512).optional(),
  onClick: z.string().min(1).max(44).optional(),
});

export const DisplayPayloadInsightSchema = z.object({
  kind: z.literal("insight"),
  slot: z.string(),
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(200),
  source: InsightSourceSchema,
  confidence: z.number().min(0).max(100).optional(),
  actions: z.array(InsightActionSchema).max(3).optional(),
  /** Datetime ISO 8601 de génération du payload. */
  generated_at: z.string().datetime(),
});
export type DisplayPayloadInsight = z.infer<typeof DisplayPayloadInsightSchema>;

/* ============ 5. action (atomic CTA with optional confirm) ============ */

const ActionConfirmSchema = z.object({
  title: z.string().min(1).max(60),
  message: z.string().min(1).max(280),
});

const ActionDestinationSchema = z.object({
  type: z.enum(["href", "action_id", "mcp_tool"]),
  value: z.string().min(1).max(512),
});

export const DisplayPayloadActionSchema = z.object({
  kind: z.literal("action"),
  slot: z.string(),
  label: z.string().min(1).max(32),
  variant: z.enum(["primary", "secondary", "danger", "ghost"]),
  icon: z.string().max(48).optional(),
  confirm: ActionConfirmSchema.optional(),
  destination: ActionDestinationSchema,
  disabled: z.boolean().optional(),
  /** Shortcut clavier (ex `Cmd+S`, `Ctrl+Shift+P`). */
  shortcut: z.string().max(24).optional(),
});
export type DisplayPayloadAction = z.infer<typeof DisplayPayloadActionSchema>;

/* ============ 6. menu (dropdown list) ============ */

const MenuItemSchema = z.object({
  label: z.string().min(1).max(40),
  icon: z.string().max(48).optional(),
  href: z.string().min(1).max(512).optional(),
  onClick: z.string().min(1).max(44).optional(),
  shortcut: z.string().max(24).optional(),
  separator: z.boolean().optional(),
  danger: z.boolean().optional(),
});

export const DisplayPayloadMenuSchema = z.object({
  kind: z.literal("menu"),
  slot: z.string(),
  title: z.string().max(40).optional(),
  items: z.array(MenuItemSchema).min(1).max(12),
  align: z.enum(["start", "end"]).optional(),
});
export type DisplayPayloadMenu = z.infer<typeof DisplayPayloadMenuSchema>;

/* ============ 7. card (360×180 free content) ============ */

const CardImageSchema = z.object({
  url: z.string().min(1).max(2048),
  alt: z.string().min(1).max(120),
});

const CardFooterSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(512).optional(),
});

const CardMetaSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(80),
});

export const DisplayPayloadCardSchema = z.object({
  kind: z.literal("card"),
  slot: z.string(),
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(280),
  image: CardImageSchema.optional(),
  footer: CardFooterSchema.optional(),
  tone: z.enum(["neutral", "info", "success"]).optional(),
  meta: z.array(CardMetaSchema).max(4).optional(),
});
export type DisplayPayloadCard = z.infer<typeof DisplayPayloadCardSchema>;

/**
 * Union discriminée — payload effectif renvoyé par `display.get`.
 *
 * Jalon E2 (2026-06-11) : étendue de 3 à 10 kinds canon. La cascade ACL
 * multi-héritage INTERSECTION s'applique uniformément à TOUS les kinds —
 * un payload icon/insight/action n'a aucun privilège différent d'une tile.
 */
export const DisplayPayloadSchema = z.discriminatedUnion("kind", [
  DisplayTilePayloadSchema,
  DisplayMiniCardPayloadSchema,
  DisplayCardLargePayloadSchema,
  DisplayPayloadIconSchema,
  DisplayPayloadSubMenuSchema,
  DisplayPayloadStatSchema,
  DisplayPayloadInsightSchema,
  DisplayPayloadActionSchema,
  DisplayPayloadMenuSchema,
  DisplayPayloadCardSchema,
]);
export type DisplayPayload = z.infer<typeof DisplayPayloadSchema>;

/* ------------------------------------------------------------------ */
/*  DisplayResolved — vue agrégée resolver + renderer                  */
/* ------------------------------------------------------------------ */

/**
 * État résolu d'une unité d'affichage : spec + payload rendu prêt à
 * coller dans `<DisplayUnit />`. Utilisé par `display.get`.
 */
export const DisplayResolvedSchema = z.object({
  spec: DisplayUnitSpecSchema,
  payload: DisplayPayloadSchema,
  /** TTL effectif retenu pour ce slot (ms). */
  cacheTtlMs: z.number().int().positive(),
  /** Indique si la résolution vient du cache (debug). */
  fromCache: z.boolean(),
});
export type DisplayResolved = z.infer<typeof DisplayResolvedSchema>;

/* ------------------------------------------------------------------ */
/*  DisplayCatalog — debug / discovery                                 */
/* ------------------------------------------------------------------ */

export const DisplayCatalogEntrySchema = z.object({
  slot: z.string().min(1).max(44),
  type: SlotTypeSchema,
  kind: SlotKindSchema,
  target: z.string().min(1),
  label: z.string().min(1),
});
export type DisplayCatalogEntry = z.infer<typeof DisplayCatalogEntrySchema>;

export const DisplayCatalogSchema = z.array(DisplayCatalogEntrySchema);
export type DisplayCatalog = z.infer<typeof DisplayCatalogSchema>;

/* ------------------------------------------------------------------ */
/*  ACL multi-héritage INTERSECTION                                    */
/* ------------------------------------------------------------------ */

/**
 * Cascade ACL — un slot peut hériter de plusieurs niveaux. Le calcul
 * d'autorisation est une INTERSECTION : toute interdiction d'un niveau
 * cascade arrête immédiatement (cf. memo `project_moteur_ia_acl_2026_06_10`).
 *
 *  - `cascade` : liste ordonnée des niveaux à évaluer (toujours L0 en
 *    premier, jamais inversé)
 *  - `immutable_by_lower_levels` : si true sur un niveau, les niveaux
 *    inférieurs ne peuvent jamais override (kill switch L0)
 */
export const ACLCascadeEntrySchema = z.object({
  level: AclLevelSchema,
  immutable_by_lower_levels: z.boolean().optional().default(false),
  forbidden: z.boolean().optional().default(false),
  reason: z.string().max(256).optional(),
});
export type ACLCascadeEntry = z.infer<typeof ACLCascadeEntrySchema>;

export const ACLCascadeSchema = z.array(ACLCascadeEntrySchema);
export type ACLCascade = z.infer<typeof ACLCascadeSchema>;

/**
 * Décision finale après INTERSECTION de la cascade ACL.
 */
export const ACLDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().max(256).nullable(),
  /** Niveau qui a tranché — utile pour debug audit log. */
  blocking_level: AclLevelSchema.nullable(),
});
export type ACLDecision = z.infer<typeof ACLDecisionSchema>;

/* ------------------------------------------------------------------ */
/*  Inputs/outputs tRPC                                                */
/* ------------------------------------------------------------------ */

export const SLOT_MAX_LENGTH = 44 as const;

export const DisplayGetInputSchema = z.object({
  slot: z.string().min(1).max(SLOT_MAX_LENGTH),
});
export type DisplayGetInput = z.infer<typeof DisplayGetInputSchema>;

export const DisplayStreamInputSchema = z.object({
  slot: z.string().min(1).max(SLOT_MAX_LENGTH),
});
export type DisplayStreamInput = z.infer<typeof DisplayStreamInputSchema>;

export const DisplayStreamOutputSchema = z.object({
  payload: DisplayPayloadSchema,
  pollAfterMs: z.number().int().positive(),
});
export type DisplayStreamOutput = z.infer<typeof DisplayStreamOutputSchema>;

export const DisplayListInputSchema = z.object({
  tenant: z.string().min(1).max(16).optional(),
  kind: SlotKindSchema.optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type DisplayListInput = z.infer<typeof DisplayListInputSchema>;

export const DisplayListOutputSchema = DisplayCatalogSchema;
export type DisplayListOutput = z.infer<typeof DisplayListOutputSchema>;
