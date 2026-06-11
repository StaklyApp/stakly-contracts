/**
 * Tests Vitest — schemas agents-instances.
 */

import { describe, it, expect } from "vitest";
import {
  AgentInstanceSchema,
  AgentScopeSchema,
  AgentRoomSchema,
  AgentInstructionSchema,
  KillswitchStateSchema,
  ResolvedInstructionCascadeSchema,
  GroupSlotSchema,
  FORBIDDEN_INSTANCE_FIELDS,
  type AgentInstance,
  type AgentInstruction,
} from "./index.js";

const T44C_OK = "A".repeat(44);
const ROOM_OK = "ROOM_" + "X".repeat(39);
const ACTR_OK = "ACTR_" + "Y".repeat(39);

describe("GroupSlotSchema", () => {
  it("accepte GRPMGR-XYZ", () => {
    expect(() => GroupSlotSchema.parse("GRPMGR-XYZ")).not.toThrow();
  });

  it("accepte ENT-ROOT", () => {
    expect(() => GroupSlotSchema.parse("ENT-ROOT")).not.toThrow();
  });

  it("rejette minuscules", () => {
    expect(() => GroupSlotSchema.parse("grpmgr-xyz")).toThrow();
  });

  it("rejette sans tiret", () => {
    expect(() => GroupSlotSchema.parse("GRPMGRXYZ")).toThrow();
  });
});

describe("KillswitchStateSchema", () => {
  it("accepte status active avec ok timestamps", () => {
    const k = KillswitchStateSchema.parse({
      status: "active",
      last_check_at: "2026-06-11T10:00:00Z",
      last_ok_at: "2026-06-11T10:00:00Z",
      last_http_code: 200,
      reason: null,
    });
    expect(k.status).toBe("active");
  });

  it("accepte idle_forced avec 403", () => {
    const k = KillswitchStateSchema.parse({
      status: "idle_forced",
      last_check_at: "2026-06-11T10:00:00Z",
      last_ok_at: null,
      last_http_code: 403,
      reason: "killswitch active",
    });
    expect(k.last_http_code).toBe(403);
  });

  it("rejette status invalide", () => {
    expect(() =>
      KillswitchStateSchema.parse({
        status: "purple",
        last_check_at: null,
        last_ok_at: null,
        last_http_code: null,
        reason: null,
      }),
    ).toThrow();
  });
});

describe("AgentInstanceSchema", () => {
  const base: AgentInstance = {
    id: 1,
    slug: "agent.std-comptable",
    tenant_id: "client-acme",
    model: "llama3.1:70b",
    runtime: "ollama",
    instructions_scope_id: 42,
    killswitch: {
      status: "active",
      last_check_at: "2026-06-11T10:00:00Z",
      last_ok_at: "2026-06-11T10:00:00Z",
      last_http_code: 200,
      reason: null,
    },
    signature: "ed25519:abc",
    created_at: "2026-06-11T09:00:00Z",
    updated_at: "2026-06-11T10:00:00Z",
    archived: false,
  };

  it("parse base ok", () => {
    expect(() => AgentInstanceSchema.parse(base)).not.toThrow();
  });

  it("rejette runtime inconnu", () => {
    expect(() =>
      AgentInstanceSchema.parse({ ...base, runtime: "azure" }),
    ).toThrow();
  });

  it("accepte runtime stub", () => {
    const ok = AgentInstanceSchema.parse({ ...base, runtime: "stub" });
    expect(ok.runtime).toBe("stub");
  });

  it("rejette slug agent invalide", () => {
    expect(() =>
      AgentInstanceSchema.parse({ ...base, slug: "INVALID" }),
    ).toThrow();
  });
});

describe("AgentScopeSchema", () => {
  it("parse base avec acl_levels L0-L3", () => {
    const scope = AgentScopeSchema.parse({
      id: 1,
      scope_44c: T44C_OK,
      slot: "GRPMGR-MARKETING",
      name: "Marketing Group",
      tenant_id: "client-acme",
      group_ids: [1, 2, 3],
      parent_id: null,
      acl_levels: ["L0", "L1", "L2", "L3"],
      matrix_room_44c: ROOM_OK,
      created_at: "2026-06-11T09:00:00Z",
      archived: false,
    });
    expect(scope.acl_levels).toHaveLength(4);
  });

  it("rejette >64 group_ids", () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => i + 1);
    expect(() =>
      AgentScopeSchema.parse({
        id: 1,
        scope_44c: T44C_OK,
        slot: "GRPMGR-MARKETING",
        name: "Marketing",
        tenant_id: "client-acme",
        group_ids: tooMany,
        parent_id: null,
        acl_levels: ["L1"],
        matrix_room_44c: null,
        created_at: "2026-06-11T09:00:00Z",
        archived: false,
      }),
    ).toThrow();
  });
});

describe("AgentRoomSchema", () => {
  it("parse base matrix room ok", () => {
    const room = AgentRoomSchema.parse({
      id: 1,
      scope_id: 1,
      room_44c: ROOM_OK,
      matrix_room_id: "!abc:matrix.example.com",
      name: "#marketing-internal",
      kind: "matrix",
      external_address: null,
      tenant_id: "client-acme",
      created_at: "2026-06-11T09:00:00Z",
      archived: false,
    });
    expect(room.kind).toBe("matrix");
  });

  it("accepte canal externe whatsapp", () => {
    const room = AgentRoomSchema.parse({
      id: 1,
      scope_id: 1,
      room_44c: ROOM_OK,
      matrix_room_id: "!stub:matrix",
      name: "WhatsApp Marketing",
      kind: "whatsapp",
      external_address: "+33612345678",
      tenant_id: "client-acme",
      created_at: "2026-06-11T09:00:00Z",
      archived: false,
    });
    expect(room.kind).toBe("whatsapp");
    expect(room.external_address).toContain("+33");
  });

  it("rejette matrix_room_id invalide", () => {
    expect(() =>
      AgentRoomSchema.parse({
        id: 1,
        scope_id: 1,
        room_44c: ROOM_OK,
        matrix_room_id: "no-bang-id",
        name: "Test",
        kind: "matrix",
        external_address: null,
        tenant_id: "client-acme",
        created_at: "2026-06-11T09:00:00Z",
        archived: false,
      }),
    ).toThrow();
  });
});

describe("AgentInstructionSchema", () => {
  const baseInstr: AgentInstruction = {
    id: 1,
    scope_id: 1,
    layer: "L0",
    content: "Tu es un agent Stakly.",
    immutable_by_lower_levels: true,
    signature: "ed25519:xyz",
    author: "L0_STAKLY",
    created_at: "2026-06-11T09:00:00Z",
    updated_at: "2026-06-11T09:00:00Z",
    version: "1.0.0",
    archived: false,
  };

  it("parse L0 immutable", () => {
    const i = AgentInstructionSchema.parse(baseInstr);
    expect(i.immutable_by_lower_levels).toBe(true);
  });

  it("parse L3 user mutable", () => {
    const i = AgentInstructionSchema.parse({
      ...baseInstr,
      layer: "L3",
      immutable_by_lower_levels: false,
      author: ACTR_OK,
    });
    expect(i.layer).toBe("L3");
  });

  it("rejette layer inconnu", () => {
    expect(() =>
      AgentInstructionSchema.parse({ ...baseInstr, layer: "L9" }),
    ).toThrow();
  });

  it("rejette SemVer invalide", () => {
    expect(() =>
      AgentInstructionSchema.parse({ ...baseInstr, version: "v1" }),
    ).toThrow();
  });

  it("rejette content >16k", () => {
    expect(() =>
      AgentInstructionSchema.parse({
        ...baseInstr,
        content: "x".repeat(16_385),
      }),
    ).toThrow();
  });
});

describe("ResolvedInstructionCascadeSchema", () => {
  it("parse cascade complète L0-L3", () => {
    const cascade = ResolvedInstructionCascadeSchema.parse({
      scope_id: 1,
      layers: [
        {
          layer: "L0",
          instruction: null,
          inherited_from: null,
          locked: false,
        },
        {
          layer: "L1",
          instruction: null,
          inherited_from: "L0",
          locked: true,
        },
        {
          layer: "L2",
          instruction: null,
          inherited_from: "L0",
          locked: true,
        },
        {
          layer: "L3",
          instruction: null,
          inherited_from: "L0",
          locked: true,
        },
      ],
    });
    expect(cascade.layers).toHaveLength(4);
    expect(cascade.layers[1]!.inherited_from).toBe("L0");
  });

  it("rejette >4 layers", () => {
    expect(() =>
      ResolvedInstructionCascadeSchema.parse({
        scope_id: 1,
        layers: [
          { layer: "L0", instruction: null, inherited_from: null, locked: false },
          { layer: "L1", instruction: null, inherited_from: null, locked: false },
          { layer: "L2", instruction: null, inherited_from: null, locked: false },
          { layer: "L3", instruction: null, inherited_from: null, locked: false },
          { layer: "L3", instruction: null, inherited_from: null, locked: false },
        ],
      }),
    ).toThrow();
  });
});

describe("FORBIDDEN_INSTANCE_FIELDS", () => {
  it("contient les champs fabrication-secret", () => {
    expect(FORBIDDEN_INSTANCE_FIELDS).toContain("prompt");
    expect(FORBIDDEN_INSTANCE_FIELDS).toContain("system_prompt");
    expect(FORBIDDEN_INSTANCE_FIELDS).toContain("chain_of_thought");
    expect(FORBIDDEN_INSTANCE_FIELDS).toContain("vault_secret");
  });

  it("aucun champ AgentInstance ne fuit ces noms", () => {
    const sample: AgentInstance = {
      id: 1,
      slug: "agent.test",
      tenant_id: "t",
      model: "stub",
      runtime: "stub",
      instructions_scope_id: null,
      killswitch: {
        status: "unknown",
        last_check_at: null,
        last_ok_at: null,
        last_http_code: null,
        reason: null,
      },
      signature: null,
      created_at: "2026-06-11T09:00:00Z",
      updated_at: "2026-06-11T09:00:00Z",
      archived: false,
    };
    const keys = Object.keys(sample);
    for (const fb of FORBIDDEN_INSTANCE_FIELDS) {
      expect(keys).not.toContain(fb);
    }
  });
});
