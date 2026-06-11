import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOOLS_CANON,
  ToolBackendSchema,
  ToolDescriptorSchema,
  ToolFamilySchema,
  ToolIdSchema,
  ToolKindSchema,
  ToolTierSchema,
  ToolsInvokeInputSchema,
  ToolsInvokeOutputSchema,
  ToolsListInputSchema,
  ToolsListOutputSchema,
  ToolsListSchema,
} from "./index.js";

describe("Tools — ToolId", () => {
  it("expose 5 outils Z3 canon", () => {
    expect(ToolIdSchema.options).toEqual([
      "diagrams",
      "illustrations",
      "imageAi",
      "templates",
      "documents",
    ]);
  });

  it("rejette un id inconnu", () => {
    expect(ToolIdSchema.safeParse("powerbi").success).toBe(false);
  });
});

describe("Tools — Tier/Backend/Kind/Family enums", () => {
  it("ToolTier = free|pro|premium", () => {
    expect(ToolTierSchema.options).toEqual(["free", "pro", "premium"]);
  });

  it("ToolBackend = client_only|hub_proxy", () => {
    expect(ToolBackendSchema.options).toEqual(["client_only", "hub_proxy"]);
  });

  it("ToolKind = standalone|insert", () => {
    expect(ToolKindSchema.options).toEqual(["standalone", "insert"]);
  });

  it("ToolFamily expose 5 familles", () => {
    expect(ToolFamilySchema.options).toHaveLength(5);
    expect(ToolFamilySchema.options).toContain("creative");
  });
});

describe("Tools — ToolDescriptor", () => {
  it("valide un descriptor minimal", () => {
    const ok = ToolDescriptorSchema.parse({
      id: "diagrams",
      label: "Diagrammes",
      icon: "git-branch",
      shortcut: "cmd+shift+d",
      tier: "free",
      backend: "client_only",
    });
    expect(ok.id).toBe("diagrams");
  });

  it("accepte family/kind optionnels", () => {
    const ok = ToolDescriptorSchema.parse({
      id: "imageAi",
      label: "Image AI",
      icon: "image-plus",
      shortcut: "cmd+shift+g",
      tier: "pro",
      backend: "hub_proxy",
      family: "creative",
      kind: "insert",
    });
    expect(ok.family).toBe("creative");
    expect(ok.kind).toBe("insert");
  });

  it("rejette tier hors enum", () => {
    expect(
      ToolDescriptorSchema.safeParse({
        id: "diagrams",
        label: "X",
        icon: "X",
        shortcut: "X",
        tier: "ultra" as "free",
        backend: "client_only",
      }).success,
    ).toBe(false);
  });
});

describe("Tools — ToolsList", () => {
  it("valide DEFAULT_TOOLS_CANON contre ToolsListSchema", () => {
    expect(ToolsListSchema.parse([...DEFAULT_TOOLS_CANON])).toHaveLength(5);
  });
});

describe("Tools — ToolsListInput", () => {
  it("accepte objet vide (strict)", () => {
    expect(ToolsListInputSchema.parse({})).toEqual({});
  });

  it("rejette extras", () => {
    expect(
      ToolsListInputSchema.safeParse({ extra: 1 } as Record<string, unknown>)
        .success,
    ).toBe(false);
  });
});

describe("Tools — ToolsInvokeInput", () => {
  it("valide avec params", () => {
    const ok = ToolsInvokeInputSchema.parse({
      tool: "diagrams",
      params: { foo: 1 },
    });
    expect(ok.tool).toBe("diagrams");
  });

  it("accepte params absent", () => {
    expect(ToolsInvokeInputSchema.parse({ tool: "imageAi" }).params).toBeUndefined();
  });

  it("rejette tool inconnu", () => {
    expect(
      ToolsInvokeInputSchema.safeParse({ tool: "powerbi" as "diagrams" }).success,
    ).toBe(false);
  });
});

describe("Tools — ToolsInvokeOutput", () => {
  it("valide stubbed output", () => {
    const ok = ToolsInvokeOutputSchema.parse({
      status: "stubbed",
      tool: "diagrams",
      echo: { foo: 1 },
    });
    expect(ok.status).toBe("stubbed");
  });

  it("accepte echo null", () => {
    const ok = ToolsInvokeOutputSchema.parse({
      status: "stubbed",
      tool: "imageAi",
      echo: null,
    });
    expect(ok.echo).toBeNull();
  });

  it("rejette status != stubbed", () => {
    expect(
      ToolsInvokeOutputSchema.safeParse({
        status: "ok",
        tool: "diagrams",
        echo: null,
      }).success,
    ).toBe(false);
  });
});

describe("Tools — DEFAULT_TOOLS_CANON", () => {
  it("a 5 outils", () => {
    expect(DEFAULT_TOOLS_CANON).toHaveLength(5);
  });

  it("ids distincts", () => {
    const ids = DEFAULT_TOOLS_CANON.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("est figé via Object.freeze", () => {
    expect(Object.isFrozen(DEFAULT_TOOLS_CANON)).toBe(true);
  });
});

describe("Tools — ToolsListOutput", () => {
  it("alias = ToolsListSchema", () => {
    expect(ToolsListOutputSchema.parse([...DEFAULT_TOOLS_CANON])).toHaveLength(5);
  });
});
