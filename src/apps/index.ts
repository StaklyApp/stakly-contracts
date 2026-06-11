/**
 * Apps — schemas Zod du canon 7 univers Stakly v3.
 *
 * Aligné sur `stakly-hub/src/trpc/routes/apps.ts` et `stakly-ui` AppLauncher.
 *
 * 7 univers canon (sidebar drilldown) :
 *   accueil / marketing / ventes / rh / compta / support / infrastructure
 *
 * Référence : memo `project_navigation_architecture_cible_2026_06_08`.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  UniverseSlug — 7 univers canon                                     */
/* ------------------------------------------------------------------ */

/**
 * Slug technique stable. Tout pack qui revendique une "présence sidebar"
 * doit s'aligner sur l'un de ces 7 slugs (ou ouvrir un PR pour étendre).
 */
export const UniverseSlugSchema = z.enum([
  "accueil",
  "marketing",
  "ventes",
  "rh",
  "compta",
  "support",
  "infrastructure",
]);
export type UniverseSlug = z.infer<typeof UniverseSlugSchema>;

/**
 * Token couleur métier (cf. design/theme.ts > universeColorTokens).
 * Null = pas de couleur (accueil).
 */
export const UniverseColorTokenSchema = z.enum([
  "marketing",
  "ventes",
  "rh",
  "compta",
  "support",
  "ops",
]);
export type UniverseColorToken = z.infer<typeof UniverseColorTokenSchema>;

/* ------------------------------------------------------------------ */
/*  AppDescriptor — entry du launcher                                   */
/* ------------------------------------------------------------------ */

/**
 * Descripteur d'une "app" (univers) côté App Launcher 9-dots / sidebar.
 *
 * Whitelist stricte — toute extension nécessite revue. Pas de
 * `requiredACL` côté front V1 (filtrage fait en amont via OPA + groupes
 * Authentik). En V2 on rajoutera un champ `acl_visibility: T44C[]` pour
 * exposer les niveaux ACL requis (debug/audit).
 */
export const AppDescriptorSchema = z.object({
  /** Slug technique stable (cf. `universeFixtures`). */
  slug: UniverseSlugSchema,
  /** Libellé affiché dans le launcher. */
  label: z.string().min(1).max(64),
  /** Icone (emoji ou lucide-id). */
  icon: z.string().min(1).max(64),
  /** URL absolue côté Stakly UI. */
  href: z.string().min(1).max(256),
  /** Token couleur métier — null = accueil. */
  color_token: UniverseColorTokenSchema.nullable(),
  /** Ordre dans la grille (sequence sidebar). */
  sequence: z.number().int(),
  /**
   * ACL granted : true = visible dans le launcher.
   * V1 : tous = true. V2 : calculé via OPA + groupes Authentik.
   */
  acl_granted: z.boolean(),
  /**
   * Tags d'épingle pour filtrer/agréger (ex pinTags: ['direction'] sur
   * la tuile d'accueil pour cross-département). Optionnel V1.
   */
  pinTags: z.array(z.string().max(32)).optional(),
});
export type AppDescriptor = z.infer<typeof AppDescriptorSchema>;

/**
 * Liste d'apps — retour de `apps.list`.
 */
export const AppsListSchema = z.array(AppDescriptorSchema);
export type AppsList = z.infer<typeof AppsListSchema>;

/* ------------------------------------------------------------------ */
/*  Inputs/outputs tRPC                                                 */
/* ------------------------------------------------------------------ */

export const AppsListInputSchema = z
  .object({
    tenant: z.string().min(1).max(64).optional(),
  })
  .strict();
export type AppsListInput = z.infer<typeof AppsListInputSchema>;

export const AppsListOutputSchema = AppsListSchema;
export type AppsListOutput = z.infer<typeof AppsListOutputSchema>;

/* ------------------------------------------------------------------ */
/*  Canon 7 univers — données par défaut                                */
/* ------------------------------------------------------------------ */

/**
 * Catalogue par défaut V1 — figé, 7 univers canon Stakly.
 * Sequence et slugs alignés sur `universeFixtures` côté UI.
 *
 * Note : la source unique reste le router `apps.list` côté Hub BFF.
 * Ce constant est exposé pour les tests et les fallbacks SSR/SSG.
 */
export const DEFAULT_APPS_CANON: ReadonlyArray<AppDescriptor> = Object.freeze([
  {
    slug: "accueil",
    label: "Accueil",
    icon: "home",
    href: "/univers/accueil",
    color_token: null,
    sequence: 100,
    acl_granted: true,
  },
  {
    slug: "marketing",
    label: "Marketing",
    icon: "megaphone",
    href: "/univers/marketing",
    color_token: "marketing",
    sequence: 200,
    acl_granted: true,
  },
  {
    slug: "ventes",
    label: "Ventes",
    icon: "trendingUp",
    href: "/univers/ventes",
    color_token: "ventes",
    sequence: 300,
    acl_granted: true,
  },
  {
    slug: "rh",
    label: "RH",
    icon: "users",
    href: "/univers/rh",
    color_token: "rh",
    sequence: 600,
    acl_granted: true,
  },
  {
    slug: "compta",
    label: "Compta",
    icon: "calculator",
    href: "/univers/compta",
    color_token: "compta",
    sequence: 700,
    acl_granted: true,
  },
  {
    slug: "support",
    label: "Support",
    icon: "headphones",
    href: "/univers/support",
    color_token: "support",
    sequence: 750,
    acl_granted: true,
  },
  {
    slug: "infrastructure",
    label: "OPS Infrastructure",
    icon: "server",
    href: "/univers/infrastructure",
    color_token: "ops",
    sequence: 810,
    acl_granted: true,
  },
]);
