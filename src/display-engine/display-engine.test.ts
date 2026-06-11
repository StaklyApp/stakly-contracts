import { describe, expect, it } from "vitest";
import {
  ACLCascadeSchema,
  ACLDecisionSchema,
  AclLevelSchema,
  DisplayCardLargePayloadSchema,
  DisplayCatalogSchema,
  DisplayGetInputSchema,
  DisplayListInputSchema,
  DisplayListOutputSchema,
  DisplayMiniCardPayloadSchema,
  DisplayPayloadActionSchema,
  DisplayPayloadCardSchema,
  DisplayPayloadIconSchema,
  DisplayPayloadInsightSchema,
  DisplayPayloadMenuSchema,
  DisplayPayloadSchema,
  DisplayPayloadStatSchema,
  DisplayPayloadSubMenuSchema,
  DisplayResolvedSchema,
  DisplayStreamInputSchema,
  DisplayStreamOutputSchema,
  DisplayTilePayloadSchema,
  DisplayUnitKindSchema,
  DisplayUnitSpecSchema,
  SlotDescriptorSchema,
  SlotKindSchema,
  SlotTypeSchema,
  SLOT_MAX_LENGTH,
} from "./index.js";

describe("Display Engine — DisplayUnitKind", () => {
  it("expose 10 kinds canon", () => {
    const opts = DisplayUnitKindSchema.options;
    expect(opts).toHaveLength(10);
    expect(opts).toContain("tile");
    expect(opts).toContain("mini-card");
    expect(opts).toContain("card-large");
    expect(opts).toContain("icon");
    expect(opts).toContain("sub-menu");
    expect(opts).toContain("stat");
    expect(opts).toContain("insight");
    expect(opts).toContain("action");
    expect(opts).toContain("menu");
    expect(opts).toContain("card");
  });

  it("rejette un kind inconnu", () => {
    expect(DisplayUnitKindSchema.safeParse("nope").success).toBe(false);
  });
});

describe("Display Engine — Slot type/kind/level", () => {
  it("SlotTypeSchema accepte tile|task|room", () => {
    expect(SlotTypeSchema.parse("tile")).toBe("tile");
    expect(SlotTypeSchema.parse("task")).toBe("task");
    expect(SlotTypeSchema.parse("room")).toBe("room");
    expect(SlotTypeSchema.safeParse("widget").success).toBe(false);
  });

  it("SlotKindSchema accepte les 10 kinds canon (Jalon E2)", () => {
    expect(SlotKindSchema.options).toEqual([
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
  });

  it("SlotKindSchema rejette un kind inconnu", () => {
    expect(SlotKindSchema.safeParse("widget").success).toBe(false);
  });

  it("AclLevelSchema accepte L0..L3", () => {
    for (const lvl of ["L0", "L1", "L2", "L3"] as const) {
      expect(AclLevelSchema.parse(lvl)).toBe(lvl);
    }
    expect(AclLevelSchema.safeParse("L9").success).toBe(false);
  });
});

describe("Display Engine — SlotDescriptor", () => {
  it("valide un descriptor complet", () => {
    const ok = SlotDescriptorSchema.parse({
      raw: "tile:tile:summary-rh",
      type: "tile",
      kind: "tile",
      target: "summary-rh",
      level: "L1",
    });
    expect(ok.target).toBe("summary-rh");
  });

  it("accepte cacheTtlSec optionnel", () => {
    const ok = SlotDescriptorSchema.parse({
      raw: "tile:tile:summary",
      type: "tile",
      kind: "tile",
      target: "summary",
      level: "L1",
      cacheTtlSec: 60,
    });
    expect(ok.cacheTtlSec).toBe(60);
  });

  it("rejette raw > 44 chars", () => {
    const r = SlotDescriptorSchema.safeParse({
      raw: "X".repeat(45),
      type: "tile",
      kind: "tile",
      target: "foo",
      level: "L1",
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine — DisplayUnitSpec", () => {
  it("valide une spec minimale", () => {
    const ok = DisplayUnitSpecSchema.parse({
      slot: "tile:tile:summary",
      kind: "tile",
      source: "tile:tile:summary-rh",
    });
    expect(ok.kind).toBe("tile");
  });

  it("accepte meta libre", () => {
    const ok = DisplayUnitSpecSchema.parse({
      slot: "tile:icon:dashboard",
      kind: "icon",
      source: "tile:icon:dashboard",
      meta: { title: "Dashboard", color: "blue" },
    });
    expect(ok.meta?.color).toBe("blue");
  });

  it("rejette source manquant", () => {
    const r = DisplayUnitSpecSchema.safeParse({
      slot: "tile:tile:summary",
      kind: "tile",
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine — Payloads V1", () => {
  it("DisplayTilePayload valide", () => {
    const ok = DisplayTilePayloadSchema.parse({
      kind: "tile",
      slot: "tile:tile:summary",
      title: "Marketing",
      subtitle: "12 actions",
    });
    expect(ok.kind).toBe("tile");
  });

  it("DisplayTilePayload accepte badge", () => {
    const ok = DisplayTilePayloadSchema.parse({
      kind: "tile",
      slot: "tile:tile:summary",
      title: "OPS",
      badge: { value: "5", tone: "warn" },
    });
    expect(ok.badge?.tone).toBe("warn");
  });

  it("DisplayMiniCardPayload valide", () => {
    const ok = DisplayMiniCardPayloadSchema.parse({
      kind: "mini-card",
      slot: "tile:mini-card:agent-101",
      title: "Agent #101",
    });
    expect(ok.kind).toBe("mini-card");
  });

  it("DisplayCardLargePayload valide avec rows", () => {
    const ok = DisplayCardLargePayloadSchema.parse({
      kind: "card-large",
      slot: "task:card-large:101",
      title: "Task #101",
      rows: [
        { label: "Owner", value: "Alice" },
        { label: "Due", value: "2026-06-15" },
      ],
    });
    expect(ok.rows).toHaveLength(2);
  });

  it("DisplayCardLargePayload rejette > 20 rows", () => {
    const r = DisplayCardLargePayloadSchema.safeParse({
      kind: "card-large",
      slot: "task:card-large:101",
      title: "Task",
      rows: Array.from({ length: 21 }, (_, i) => ({
        label: `r${i}`,
        value: "v",
      })),
    });
    expect(r.success).toBe(false);
  });

  it("DisplayPayloadSchema union discriminée par kind", () => {
    const tile = DisplayPayloadSchema.parse({
      kind: "tile",
      slot: "x",
      title: "t",
    });
    expect(tile.kind).toBe("tile");

    // kind inconnu → refusé.
    const r = DisplayPayloadSchema.safeParse({
      kind: "nope",
      slot: "x",
      title: "t",
    });
    expect(r.success).toBe(false);
  });

  it("DisplayPayloadSchema accepte un payload icon mal formé refuse OK", () => {
    // un payload icon SANS les champs requis doit être rejeté par la union.
    const r = DisplayPayloadSchema.safeParse({
      kind: "icon",
      slot: "x",
      title: "t",
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine — DisplayResolved", () => {
  it("valide une résolution complète", () => {
    const ok = DisplayResolvedSchema.parse({
      spec: {
        slot: "tile:tile:summary",
        kind: "tile",
        source: "tile:tile:summary-rh",
      },
      payload: { kind: "tile", slot: "tile:tile:summary", title: "RH" },
      cacheTtlMs: 30000,
      fromCache: false,
    });
    expect(ok.cacheTtlMs).toBe(30000);
  });

  it("rejette cacheTtlMs négatif", () => {
    const r = DisplayResolvedSchema.safeParse({
      spec: {
        slot: "tile:tile:s",
        kind: "tile",
        source: "tile:tile:s",
      },
      payload: { kind: "tile", slot: "tile:tile:s", title: "x" },
      cacheTtlMs: -1,
      fromCache: false,
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine — Catalog", () => {
  it("valide un tableau d'entries", () => {
    const ok = DisplayCatalogSchema.parse([
      {
        slot: "tile:tile:summary",
        type: "tile",
        kind: "tile",
        target: "summary",
        label: "Summary",
      },
    ]);
    expect(ok).toHaveLength(1);
  });

  it("accepte un catalogue vide", () => {
    expect(DisplayCatalogSchema.parse([])).toEqual([]);
  });
});

describe("Display Engine — ACL multi-héritage", () => {
  it("ACLCascade accepte une liste de niveaux", () => {
    const ok = ACLCascadeSchema.parse([
      { level: "L0", immutable_by_lower_levels: true },
      { level: "L1" },
      { level: "L2", forbidden: true, reason: "pack disabled" },
      { level: "L3" },
    ]);
    expect(ok).toHaveLength(4);
    expect(ok[2]?.forbidden).toBe(true);
  });

  it("ACLDecision allowed + blocking_level null", () => {
    const ok = ACLDecisionSchema.parse({
      allowed: true,
      reason: null,
      blocking_level: null,
    });
    expect(ok.allowed).toBe(true);
  });

  it("ACLDecision denied + blocking_level L2", () => {
    const ok = ACLDecisionSchema.parse({
      allowed: false,
      reason: "pack disabled at L2",
      blocking_level: "L2",
    });
    expect(ok.blocking_level).toBe("L2");
  });
});

describe("Display Engine — tRPC inputs/outputs", () => {
  it("SLOT_MAX_LENGTH = 44", () => {
    expect(SLOT_MAX_LENGTH).toBe(44);
  });

  it("DisplayGetInput valide", () => {
    const ok = DisplayGetInputSchema.parse({ slot: "tile:tile:s" });
    expect(ok.slot).toBe("tile:tile:s");
  });

  it("DisplayGetInput rejette slot trop long", () => {
    expect(DisplayGetInputSchema.safeParse({ slot: "x".repeat(45) }).success).toBe(
      false,
    );
  });

  it("DisplayStreamInput identique à GetInput", () => {
    expect(DisplayStreamInputSchema.parse({ slot: "tile:tile:s" }).slot).toBe(
      "tile:tile:s",
    );
  });

  it("DisplayStreamOutput valide avec pollAfterMs > 0", () => {
    const ok = DisplayStreamOutputSchema.parse({
      payload: { kind: "tile", slot: "x", title: "y" },
      pollAfterMs: 5000,
    });
    expect(ok.pollAfterMs).toBe(5000);
  });

  it("DisplayListInput accepte filtres optionnels", () => {
    expect(DisplayListInputSchema.parse({}).limit).toBeUndefined();
    expect(
      DisplayListInputSchema.parse({ tenant: "000000", kind: "tile", limit: 10 })
        .kind,
    ).toBe("tile");
  });

  it("DisplayListInput rejette limit > 200", () => {
    expect(DisplayListInputSchema.safeParse({ limit: 201 }).success).toBe(false);
  });

  it("DisplayListOutput = tableau d'entries", () => {
    expect(DisplayListOutputSchema.parse([])).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  Jalon E2 — 7 nouveaux payloads V2                                  */
/* ------------------------------------------------------------------ */

describe("Display Engine V2 — payload icon", () => {
  it("valide un payload icon minimal", () => {
    const ok = DisplayPayloadIconSchema.parse({
      kind: "icon",
      slot: "tile:icon:bell",
      icon: "bell",
      label: "Notifications",
      tone: "neutral",
    });
    expect(ok.kind).toBe("icon");
    expect(ok.tone).toBe("neutral");
  });

  it("accepte un badge count + dot", () => {
    const ok = DisplayPayloadIconSchema.parse({
      kind: "icon",
      slot: "tile:icon:inbox",
      icon: "inbox",
      label: "Inbox",
      tone: "info",
      badge: { count: 5, dot: true },
    });
    expect(ok.badge?.count).toBe(5);
    expect(ok.badge?.dot).toBe(true);
  });

  it("rejette label > 24 chars", () => {
    const r = DisplayPayloadIconSchema.safeParse({
      kind: "icon",
      slot: "x",
      icon: "bell",
      label: "X".repeat(25),
      tone: "neutral",
    });
    expect(r.success).toBe(false);
  });

  it("rejette tone inconnu", () => {
    const r = DisplayPayloadIconSchema.safeParse({
      kind: "icon",
      slot: "x",
      icon: "bell",
      label: "OK",
      tone: "rainbow",
    });
    expect(r.success).toBe(false);
  });

  it("rejette badge count négatif", () => {
    const r = DisplayPayloadIconSchema.safeParse({
      kind: "icon",
      slot: "x",
      icon: "bell",
      label: "OK",
      tone: "neutral",
      badge: { count: -1 },
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload sub-menu", () => {
  it("valide un sub-menu minimal", () => {
    const ok = DisplayPayloadSubMenuSchema.parse({
      kind: "sub-menu",
      slot: "tile:sub-menu:rh",
      label: "Ressources humaines",
      href: "/rh",
    });
    expect(ok.label).toBe("Ressources humaines");
  });

  it("accepte children + active", () => {
    const ok = DisplayPayloadSubMenuSchema.parse({
      kind: "sub-menu",
      slot: "tile:sub-menu:rh",
      label: "RH",
      href: "/rh",
      active: true,
      children: [
        { label: "Salariés", href: "/rh/salaries", active: false },
        { label: "Paie", href: "/rh/paie" },
      ],
      badge: { count: 12 },
    });
    expect(ok.children).toHaveLength(2);
    expect(ok.badge?.count).toBe(12);
  });

  it("rejette > 10 children", () => {
    const r = DisplayPayloadSubMenuSchema.safeParse({
      kind: "sub-menu",
      slot: "x",
      label: "X",
      href: "/x",
      children: Array.from({ length: 11 }, (_, i) => ({
        label: `c${i}`,
        href: `/c${i}`,
      })),
    });
    expect(r.success).toBe(false);
  });

  it("rejette href manquant", () => {
    const r = DisplayPayloadSubMenuSchema.safeParse({
      kind: "sub-menu",
      slot: "x",
      label: "X",
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload stat", () => {
  it("valide une stat minimale value:number", () => {
    const ok = DisplayPayloadStatSchema.parse({
      kind: "stat",
      slot: "tile:stat:revenue",
      label: "Chiffre d'affaires",
      value: 1234.56,
      tone: "success",
    });
    expect(ok.value).toBe(1234.56);
  });

  it("accepte une stat string + delta + unit", () => {
    const ok = DisplayPayloadStatSchema.parse({
      kind: "stat",
      slot: "tile:stat:nps",
      label: "NPS",
      value: "62",
      unit: "%",
      delta: { value: 4.2, period: "week", direction: "up" },
      tone: "success",
      icon: "trending-up",
    });
    expect(ok.delta?.direction).toBe("up");
    expect(ok.unit).toBe("%");
  });

  it("rejette tone inconnu (pas d'info pour stat)", () => {
    const r = DisplayPayloadStatSchema.safeParse({
      kind: "stat",
      slot: "x",
      label: "x",
      value: 1,
      tone: "info",
    });
    expect(r.success).toBe(false);
  });

  it("rejette delta.direction inconnu", () => {
    const r = DisplayPayloadStatSchema.safeParse({
      kind: "stat",
      slot: "x",
      label: "x",
      value: 1,
      tone: "neutral",
      delta: { value: 1, period: "day", direction: "wobble" },
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload insight", () => {
  it("valide un insight minimal", () => {
    const ok = DisplayPayloadInsightSchema.parse({
      kind: "insight",
      slot: "tile:insight:cmo-w23",
      title: "Pic d'engagement détecté",
      summary: "Le post LinkedIn a fait +312% d'impressions cette semaine.",
      source: { agent_id: "agent.std-cmo", agent_label: "Iris CMO" },
      generated_at: "2026-06-11T08:30:00.000Z",
    });
    expect(ok.title).toContain("engagement");
  });

  it("accepte confidence + actions (max 3)", () => {
    const ok = DisplayPayloadInsightSchema.parse({
      kind: "insight",
      slot: "x",
      title: "Insight test",
      summary: "Court résumé.",
      source: { agent_id: "agent.std-cmo", agent_label: "Iris" },
      generated_at: "2026-06-11T00:00:00Z",
      confidence: 87,
      actions: [
        { label: "Voir détail", href: "/x" },
        { label: "Lancer action", onClick: "ACT_RUN_42" },
      ],
    });
    expect(ok.actions).toHaveLength(2);
    expect(ok.confidence).toBe(87);
  });

  it("rejette > 3 actions", () => {
    const r = DisplayPayloadInsightSchema.safeParse({
      kind: "insight",
      slot: "x",
      title: "t",
      summary: "s",
      source: { agent_id: "a", agent_label: "A" },
      generated_at: "2026-06-11T00:00:00Z",
      actions: [
        { label: "1", href: "/1" },
        { label: "2", href: "/2" },
        { label: "3", href: "/3" },
        { label: "4", href: "/4" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejette generated_at non-ISO", () => {
    const r = DisplayPayloadInsightSchema.safeParse({
      kind: "insight",
      slot: "x",
      title: "t",
      summary: "s",
      source: { agent_id: "a", agent_label: "A" },
      generated_at: "hier matin",
    });
    expect(r.success).toBe(false);
  });

  it("rejette confidence > 100", () => {
    const r = DisplayPayloadInsightSchema.safeParse({
      kind: "insight",
      slot: "x",
      title: "t",
      summary: "s",
      source: { agent_id: "a", agent_label: "A" },
      generated_at: "2026-06-11T00:00:00Z",
      confidence: 150,
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload action", () => {
  it("valide une action minimale", () => {
    const ok = DisplayPayloadActionSchema.parse({
      kind: "action",
      slot: "tile:action:save",
      label: "Enregistrer",
      variant: "primary",
      destination: { type: "href", value: "/save" },
    });
    expect(ok.variant).toBe("primary");
  });

  it("accepte confirm + shortcut + icon", () => {
    const ok = DisplayPayloadActionSchema.parse({
      kind: "action",
      slot: "tile:action:delete",
      label: "Supprimer",
      variant: "danger",
      icon: "trash",
      confirm: {
        title: "Confirmer la suppression",
        message: "Cette action est irréversible.",
      },
      destination: { type: "action_id", value: "ACT_DELETE_42" },
      shortcut: "Cmd+Shift+D",
    });
    expect(ok.confirm?.title).toContain("suppression");
    expect(ok.shortcut).toBe("Cmd+Shift+D");
  });

  it("rejette variant inconnu", () => {
    const r = DisplayPayloadActionSchema.safeParse({
      kind: "action",
      slot: "x",
      label: "X",
      variant: "explosive",
      destination: { type: "href", value: "/x" },
    });
    expect(r.success).toBe(false);
  });

  it("rejette destination.type inconnu", () => {
    const r = DisplayPayloadActionSchema.safeParse({
      kind: "action",
      slot: "x",
      label: "X",
      variant: "primary",
      destination: { type: "magic", value: "/x" },
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload menu", () => {
  it("valide un menu minimal", () => {
    const ok = DisplayPayloadMenuSchema.parse({
      kind: "menu",
      slot: "tile:menu:user",
      items: [
        { label: "Profil", href: "/me" },
        { label: "Déconnexion", danger: true, onClick: "ACT_LOGOUT" },
      ],
    });
    expect(ok.items).toHaveLength(2);
  });

  it("accepte title + align + separator", () => {
    const ok = DisplayPayloadMenuSchema.parse({
      kind: "menu",
      slot: "x",
      title: "Compte",
      align: "end",
      items: [
        { label: "Profil", href: "/me" },
        { label: "—", separator: true },
        { label: "Quitter", danger: true, shortcut: "Cmd+Q" },
      ],
    });
    expect(ok.title).toBe("Compte");
    expect(ok.align).toBe("end");
  });

  it("rejette items vide", () => {
    const r = DisplayPayloadMenuSchema.safeParse({
      kind: "menu",
      slot: "x",
      items: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejette > 12 items", () => {
    const r = DisplayPayloadMenuSchema.safeParse({
      kind: "menu",
      slot: "x",
      items: Array.from({ length: 13 }, (_, i) => ({
        label: `i${i}`,
        href: `/i${i}`,
      })),
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — payload card", () => {
  it("valide une card minimale", () => {
    const ok = DisplayPayloadCardSchema.parse({
      kind: "card",
      slot: "tile:card:hero",
      title: "Bienvenue",
      body: "Découvrez Stakly v3.",
    });
    expect(ok.title).toBe("Bienvenue");
  });

  it("accepte image + footer + meta (≤ 4)", () => {
    const ok = DisplayPayloadCardSchema.parse({
      kind: "card",
      slot: "x",
      title: "Carte riche",
      body: "Contenu **markdown**.",
      image: { url: "https://cdn/img.png", alt: "Hero" },
      footer: { label: "En savoir plus", href: "/docs" },
      tone: "info",
      meta: [
        { label: "Auteur", value: "Iris" },
        { label: "Date", value: "2026-06-11" },
      ],
    });
    expect(ok.meta).toHaveLength(2);
    expect(ok.tone).toBe("info");
  });

  it("rejette > 4 meta", () => {
    const r = DisplayPayloadCardSchema.safeParse({
      kind: "card",
      slot: "x",
      title: "x",
      body: "x",
      meta: Array.from({ length: 5 }, (_, i) => ({
        label: `m${i}`,
        value: `v${i}`,
      })),
    });
    expect(r.success).toBe(false);
  });

  it("rejette body > 280 chars", () => {
    const r = DisplayPayloadCardSchema.safeParse({
      kind: "card",
      slot: "x",
      title: "x",
      body: "X".repeat(281),
    });
    expect(r.success).toBe(false);
  });
});

describe("Display Engine V2 — union DisplayPayloadSchema (10 kinds)", () => {
  it("accepte un payload icon valide via la union", () => {
    const ok = DisplayPayloadSchema.parse({
      kind: "icon",
      slot: "tile:icon:bell",
      icon: "bell",
      label: "Notifications",
      tone: "neutral",
    });
    expect(ok.kind).toBe("icon");
  });

  it("accepte les 10 kinds canon", () => {
    const samples: Array<{ kind: string; payload: unknown }> = [
      {
        kind: "tile",
        payload: { kind: "tile", slot: "x", title: "T" },
      },
      {
        kind: "mini-card",
        payload: { kind: "mini-card", slot: "x", title: "M" },
      },
      {
        kind: "card-large",
        payload: { kind: "card-large", slot: "x", title: "C", rows: [] },
      },
      {
        kind: "icon",
        payload: {
          kind: "icon",
          slot: "x",
          icon: "bell",
          label: "Bell",
          tone: "neutral",
        },
      },
      {
        kind: "sub-menu",
        payload: { kind: "sub-menu", slot: "x", label: "L", href: "/l" },
      },
      {
        kind: "stat",
        payload: { kind: "stat", slot: "x", label: "L", value: 1, tone: "neutral" },
      },
      {
        kind: "insight",
        payload: {
          kind: "insight",
          slot: "x",
          title: "t",
          summary: "s",
          source: { agent_id: "a", agent_label: "A" },
          generated_at: "2026-06-11T00:00:00Z",
        },
      },
      {
        kind: "action",
        payload: {
          kind: "action",
          slot: "x",
          label: "L",
          variant: "primary",
          destination: { type: "href", value: "/x" },
        },
      },
      {
        kind: "menu",
        payload: {
          kind: "menu",
          slot: "x",
          items: [{ label: "I", href: "/i" }],
        },
      },
      {
        kind: "card",
        payload: { kind: "card", slot: "x", title: "T", body: "B" },
      },
    ];
    for (const { kind, payload } of samples) {
      const r = DisplayPayloadSchema.safeParse(payload);
      expect(r.success, `kind=${kind}`).toBe(true);
    }
  });
});
