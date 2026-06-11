import { describe, expect, it } from "vitest";
import {
  AclCascadeSchema,
  AclDecisionSchema,
  AclPolicySchema,
  EventKindSchema,
  RuntimeEventSchema,
  InsightKindSchema,
  InsightSchema,
  MsgContentSchema,
  MsgEventSchema,
  RoomDescriptorSchema,
  RoomKindSchema,
  RspSchema,
  RspStatusSchema,
  RuntimeAclLevelSchema,
  RuntimeMessageSchema,
  T44CSchema,
} from "./index.js";

// 44 chars exacts — voir tests 44c pour la convention pad.
const pad = (s: string): string => s.padEnd(44, "_");
const sampleT44C = pad("PACK_L1_000000_PCKDOC_001_26061001");
const sampleT44C2 = pad("ROOM_L1_000000_OPSALR_001_26060901");
const sampleT44C3 = pad("ACTR_L2_STKMTH_AGIRH1_V01_26061010");
const sampleT44C4 = pad("MSG__L3_STKMTH_USR123_001_26061010");

/* ------------------------------------------------------------------ */
/*  T44CSchema                                                          */
/* ------------------------------------------------------------------ */

describe("Runtime — T44CSchema", () => {
  it("accepte 44 chars [A-Z0-9_]", () => {
    expect(T44CSchema.parse(sampleT44C)).toBe(sampleT44C);
  });

  it("rejette 43 chars", () => {
    expect(T44CSchema.safeParse("A".repeat(43)).success).toBe(false);
  });

  it("rejette minuscules", () => {
    expect(T44CSchema.safeParse("a".repeat(44)).success).toBe(false);
  });

  it("rejette caractères spéciaux", () => {
    expect(T44CSchema.safeParse("A".repeat(43) + ":").success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  MSG_ event                                                          */
/* ------------------------------------------------------------------ */

describe("Runtime — MsgContent", () => {
  it("valide un contenu minimal", () => {
    const ok = MsgContentSchema.parse({ text: "Hello" });
    expect(ok.format).toBe("markdown");
  });

  it("accepte mentions @ACTR", () => {
    const ok = MsgContentSchema.parse({
      text: "@user1 ping",
      mentions: [sampleT44C3],
    });
    expect(ok.mentions).toHaveLength(1);
  });

  it("rejette text > 10000", () => {
    expect(MsgContentSchema.safeParse({ text: "x".repeat(10_001) }).success).toBe(
      false,
    );
  });
});

describe("Runtime — MsgEvent", () => {
  it("valide un MSG_ minimal", () => {
    const ok = MsgEventSchema.parse({
      id: sampleT44C4,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "MSG_",
      content: { text: "Hi" },
    });
    expect(ok.type).toBe("MSG_");
  });

  it("accepte parent_id (thread)", () => {
    const ok = MsgEventSchema.parse({
      id: sampleT44C4,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "MSG_",
      content: { text: "Reply" },
      parent_id: sampleT44C,
    });
    expect(ok.parent_id).toBe(sampleT44C);
  });
});

/* ------------------------------------------------------------------ */
/*  INS_                                                                */
/* ------------------------------------------------------------------ */

describe("Runtime — InsightKind", () => {
  it("8 kinds canon", () => {
    expect(InsightKindSchema.options).toHaveLength(8);
    expect(InsightKindSchema.options).toContain("answer");
    expect(InsightKindSchema.options).toContain("classification");
  });
});

describe("Runtime — Insight", () => {
  it("valide un insight answer", () => {
    const ok = InsightSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "INS_",
      kind: "answer",
      payload: { result: "42" },
      confidence: 0.95,
    });
    expect(ok.confidence).toBe(0.95);
  });

  it("accepte confidence null", () => {
    const ok = InsightSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "INS_",
      kind: "summary",
      payload: { text: "ok" },
      confidence: null,
    });
    expect(ok.confidence).toBeNull();
  });

  it("rejette confidence > 1", () => {
    expect(
      InsightSchema.safeParse({
        id: sampleT44C,
        room_id: sampleT44C2,
        actor_id: sampleT44C3,
        at: "2026-06-10T15:30:00.000Z",
        tenant_id: "000000",
        type: "INS_",
        kind: "score",
        payload: {},
        confidence: 1.5,
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  EVT_                                                                */
/* ------------------------------------------------------------------ */

describe("Runtime — EventKind", () => {
  it("12 kinds canon", () => {
    expect(EventKindSchema.options).toHaveLength(12);
    expect(EventKindSchema.options).toContain("killswitch.triggered");
  });
});

describe("Runtime — RuntimeEvent", () => {
  it("valide un event minimal", () => {
    const ok = RuntimeEventSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "EVT_",
      kind: "agent.started",
    });
    expect(ok.severity).toBe("info");
  });

  it("rejette kind inconnu", () => {
    expect(
      RuntimeEventSchema.safeParse({
        id: sampleT44C,
        room_id: sampleT44C2,
        actor_id: sampleT44C3,
        at: "2026-06-10T15:30:00.000Z",
        tenant_id: "000000",
        type: "EVT_",
        kind: "agent.fart",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  RSP_                                                                */
/* ------------------------------------------------------------------ */

describe("Runtime — RspStatus", () => {
  it("4 statuts", () => {
    expect(RspStatusSchema.options).toEqual([
      "ok",
      "error",
      "timeout",
      "rejected",
    ]);
  });
});

describe("Runtime — Rsp", () => {
  it("valide une réponse ok", () => {
    const ok = RspSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "RSP_",
      request_id: sampleT44C4,
      status: "ok",
      body: { result: 42 },
    });
    expect(ok.status).toBe("ok");
  });

  it("valide une réponse error", () => {
    const ok = RspSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "RSP_",
      request_id: sampleT44C4,
      status: "error",
      body: null,
      error_code: "FORBIDDEN",
      error_message: "Access denied at L2.",
    });
    expect(ok.error_code).toBe("FORBIDDEN");
  });
});

/* ------------------------------------------------------------------ */
/*  RuntimeMessage union                                                */
/* ------------------------------------------------------------------ */

describe("Runtime — RuntimeMessage union", () => {
  it("discrimine par type", () => {
    const msg = RuntimeMessageSchema.parse({
      id: sampleT44C,
      room_id: sampleT44C2,
      actor_id: sampleT44C3,
      at: "2026-06-10T15:30:00.000Z",
      tenant_id: "000000",
      type: "MSG_",
      content: { text: "hi" },
    });
    expect(msg.type).toBe("MSG_");
  });

  it("rejette type inconnu", () => {
    expect(
      RuntimeMessageSchema.safeParse({
        id: sampleT44C,
        room_id: sampleT44C2,
        actor_id: sampleT44C3,
        at: "2026-06-10T15:30:00.000Z",
        tenant_id: "000000",
        type: "WTF_",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  ROOM_                                                               */
/* ------------------------------------------------------------------ */

describe("Runtime — RoomKind", () => {
  it("7 kinds canon", () => {
    expect(RoomKindSchema.options).toHaveLength(7);
    expect(RoomKindSchema.options).toContain("team");
    expect(RoomKindSchema.options).toContain("alert");
  });
});

describe("Runtime — RoomDescriptor", () => {
  it("valide un canal team", () => {
    const ok = RoomDescriptorSchema.parse({
      id: sampleT44C2,
      matrix_room_id: "!abc:matrix.000000.stakly.app",
      name: "OPS Alerts",
      topic: "Alertes infra.",
      kind: "alert",
      member_count: 5,
      tenant_id: "000000",
    });
    expect(ok.kind).toBe("alert");
  });

  it("rejette matrix_room_id mal formé", () => {
    expect(
      RoomDescriptorSchema.safeParse({
        id: sampleT44C2,
        matrix_room_id: "not-a-matrix-id",
        name: "X",
        topic: null,
        kind: "team",
        member_count: 0,
        tenant_id: "000000",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  ACL cascade                                                         */
/* ------------------------------------------------------------------ */

describe("Runtime — RuntimeAclLevel", () => {
  it("L0..L3", () => {
    expect(RuntimeAclLevelSchema.options).toEqual(["L0", "L1", "L2", "L3"]);
  });
});

describe("Runtime — AclPolicy", () => {
  it("valide une policy L0 immutable", () => {
    const ok = AclPolicySchema.parse({
      level: "L0",
      immutable_by_lower_levels: true,
      default_deny: true,
    });
    expect(ok.ttl_sec).toBe(300);
  });

  it("rejette ttl_sec < 30", () => {
    expect(
      AclPolicySchema.safeParse({ level: "L1", ttl_sec: 10 }).success,
    ).toBe(false);
  });
});

describe("Runtime — AclCascade", () => {
  it("accepte 1..4 entrées", () => {
    expect(AclCascadeSchema.parse([{ level: "L1" }])).toHaveLength(1);
    expect(
      AclCascadeSchema.parse([
        { level: "L0", immutable_by_lower_levels: true },
        { level: "L1" },
        { level: "L2" },
        { level: "L3" },
      ]),
    ).toHaveLength(4);
  });

  it("rejette > 4", () => {
    expect(
      AclCascadeSchema.safeParse([
        { level: "L0" },
        { level: "L1" },
        { level: "L2" },
        { level: "L3" },
        { level: "L1" },
      ]).success,
    ).toBe(false);
  });

  it("rejette vide", () => {
    expect(AclCascadeSchema.safeParse([]).success).toBe(false);
  });
});

describe("Runtime — AclDecision", () => {
  it("allowed true", () => {
    const ok = AclDecisionSchema.parse({
      allowed: true,
      reason: null,
      blocking_level: null,
    });
    expect(ok.allowed).toBe(true);
  });

  it("denied par L2", () => {
    const ok = AclDecisionSchema.parse({
      allowed: false,
      reason: "pack disabled at L2",
      blocking_level: "L2",
    });
    expect(ok.blocking_level).toBe("L2");
  });
});
