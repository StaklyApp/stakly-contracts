/**
 * Tools — schemas Zod de la Toolbar Outils Z3 (4ème zone d'écran).
 *
 * Aligné sur `stakly-hub/src/trpc/routes/tools.ts` et
 * `stakly-ui/src/components/StaklyShell/ToolsToolbar.tsx`.
 *
 * 5 outils transverses canon (cf. memo `project_toolbar_outils_z3_2026_06_10`) :
 *   diagrams / illustrations / imageAi / templates / documents
 *
 * Hotkeys Cmd+Shift+{D,I,G,T,F}. Mode standalone + insert.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  ToolId — 5 outils Z3 canon                                          */
/* ------------------------------------------------------------------ */

export const ToolIdSchema = z.enum([
  "diagrams",
  "illustrations",
  "imageAi",
  "templates",
  "documents",
]);
export type ToolId = z.infer<typeof ToolIdSchema>;

/**
 * Tier de monétisation. `free` = inclus dans le pack base.
 * `pro` / `premium` = nécessite quota Stripe additionnel.
 */
export const ToolTierSchema = z.enum(["free", "pro", "premium"]);
export type ToolTier = z.infer<typeof ToolTierSchema>;

/**
 * Mode d'exécution. `client_only` = tout vit en navigateur (ex Mermaid,
 * Excalidraw). `hub_proxy` = passe par Hub BFF (Image AI, Documents).
 */
export const ToolBackendSchema = z.enum(["client_only", "hub_proxy"]);
export type ToolBackend = z.infer<typeof ToolBackendSchema>;

/**
 * Mode d'usage UI. `standalone` = page dédiée. `insert` = inséré dans le
 * doc/tile courant.
 */
export const ToolKindSchema = z.enum(["standalone", "insert"]);
export type ToolKind = z.infer<typeof ToolKindSchema>;

/**
 * Famille fonctionnelle — utilisé par la palette pour grouper.
 */
export const ToolFamilySchema = z.enum([
  "creative",
  "documents",
  "automation",
  "data",
  "other",
]);
export type ToolFamily = z.infer<typeof ToolFamilySchema>;

/* ------------------------------------------------------------------ */
/*  ToolDescriptor                                                      */
/* ------------------------------------------------------------------ */

/**
 * Descripteur d'un outil Z3. Whitelist stricte.
 */
export const ToolDescriptorSchema = z.object({
  id: ToolIdSchema,
  label: z.string().min(1).max(64),
  icon: z.string().min(1).max(64),
  shortcut: z.string().min(1).max(32),
  tier: ToolTierSchema,
  backend: ToolBackendSchema,
  /** Famille fonctionnelle (palette grouping) — optionnel. */
  family: ToolFamilySchema.optional(),
  /** Mode d'usage UI — optionnel (défaut côté UI = `standalone`). */
  kind: ToolKindSchema.optional(),
});
export type ToolDescriptor = z.infer<typeof ToolDescriptorSchema>;

/**
 * Liste d'outils — retour de `tools.list`.
 */
export const ToolsListSchema = z.array(ToolDescriptorSchema);
export type ToolsList = z.infer<typeof ToolsListSchema>;

/* ------------------------------------------------------------------ */
/*  Inputs/outputs tRPC                                                 */
/* ------------------------------------------------------------------ */

export const ToolsListInputSchema = z.object({}).strict();
export type ToolsListInput = z.infer<typeof ToolsListInputSchema>;

export const ToolsListOutputSchema = ToolsListSchema;
export type ToolsListOutput = z.infer<typeof ToolsListOutputSchema>;

export const ToolsInvokeInputSchema = z.object({
  tool: ToolIdSchema,
  /** Payload libre — non interprété en MVP. */
  params: z.record(z.string(), z.unknown()).optional(),
});
export type ToolsInvokeInput = z.infer<typeof ToolsInvokeInputSchema>;

export const ToolsInvokeOutputSchema = z.object({
  status: z.literal("stubbed"),
  tool: ToolIdSchema,
  echo: z.record(z.string(), z.unknown()).nullable(),
});
export type ToolsInvokeOutput = z.infer<typeof ToolsInvokeOutputSchema>;

/* ------------------------------------------------------------------ */
/*  Canon 5 outils — données par défaut                                 */
/* ------------------------------------------------------------------ */

/**
 * Catalogue par défaut V1 — figé.
 * Le pack marketplace pourra l'enrichir via manifest CTR_PCKTOOLS (S3+).
 */
export const DEFAULT_TOOLS_CANON: ReadonlyArray<ToolDescriptor> = Object.freeze([
  {
    id: "diagrams",
    label: "Diagrammes",
    icon: "git-branch",
    shortcut: "cmd+shift+d",
    tier: "free",
    backend: "client_only",
  },
  {
    id: "illustrations",
    label: "Illustrations",
    icon: "pen-tool",
    shortcut: "cmd+shift+i",
    tier: "free",
    backend: "client_only",
  },
  {
    id: "imageAi",
    label: "Image AI",
    icon: "image-plus",
    shortcut: "cmd+shift+g",
    tier: "pro",
    backend: "hub_proxy",
  },
  {
    id: "templates",
    label: "Templates",
    icon: "layout",
    shortcut: "cmd+shift+t",
    tier: "free",
    backend: "hub_proxy",
  },
  {
    id: "documents",
    label: "Documents",
    icon: "file-text",
    shortcut: "cmd+shift+f",
    tier: "free",
    backend: "hub_proxy",
  },
]);
