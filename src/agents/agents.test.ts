import { describe, expect, it } from "vitest";
import {
  AgentDeltaSchema,
  AgentSnapshotListSchema,
  AgentSnapshotSchema,
  AgentStatusSchema,
  AgentStreamSchema,
  DEFAULT_POLL_AFTER_MS,
  DELTA_STALE_AFTER_MS,
  DetailAgentStatsInputSchema,
  FORBIDDEN_AGENT_STATS_FIELDS,
  JobEventDeltaSchema,
  JobKindSchema,
  JobStateSchema,
  JobStatusSchema,
  ListAgentStatsInputSchema,
  SlotIdSchema,
  StatusChangeDeltaSchema,
  StreamAgentStatsInputSchema,
  StreamAgentStatsOutputSchema,
  TenantIdSchema,
  TOKEN_WINDOW_MS,
  TokenAppendDeltaSchema,
  TokenConsumptionSchema,
} from "./index.js";

/* ------------------------------------------------------------------ */
/*  Identifiers                                                        */
/* ------------------------------------------------------------------ */

describe("Agents — SlotId", () => {
  it("accepte agent.xxx-yyy", () => {
    expect(SlotIdSchema.parse("agent.rh-onboarding")).toBe("agent.rh-onboarding");
  });

  it("rejette sans préfixe agent.", () => {
    expect(SlotIdSchema.safeParse("rh-onboarding").success).toBe(false);
  });

  it("rejette > 44 chars", () => {
    expect(SlotIdSchema.safeParse("agent." + "x".repeat(40)).success).toBe(false);
  });
});

describe("Agents — TenantId", () => {
  it("accepte slug", () => {
    expect(TenantIdSchema.parse("000000")).toBe("000000");
  });

  it("rejette caractères invalides", () => {
    expect(TenantIdSchema.safeParse("tenant id space").success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  State machine                                                       */
/* ------------------------------------------------------------------ */

describe("Agents — AgentStatus", () => {
  it("5 états canon", () => {
    expect(AgentStatusSchema.options).toEqual([
      "IDLE",
      "RUNNING",
      "ERROR",
      "PAUSED",
      "TERMINATED",
    ]);
  });
});

describe("Agents — JobState / JobKind", () => {
  it("JobState = 5 états", () => {
    expect(JobStateSchema.options).toEqual([
      "PENDING",
      "RUNNING",
      "SUCCESS",
      "FAILED",
      "CANCELLED",
    ]);
  });

  it("JobKind = 4 familles", () => {
    expect(JobKindSchema.options).toEqual([
      "chat",
      "tool_call",
      "batch_inference",
      "eval",
    ]);
  });
});

/* ------------------------------------------------------------------ */
/*  TokenConsumption                                                    */
/* ------------------------------------------------------------------ */

describe("Agents — TokenConsumption", () => {
  it("valide une conso 24h", () => {
    const ok = TokenConsumptionSchema.parse({
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
      cost_eur: 0.012,
      since: "2026-06-10T00:00:00.000Z",
      updated_at: "2026-06-10T15:30:00.000Z",
    });
    expect(ok.total_tokens).toBe(1500);
  });

  it("rejette tokens négatifs", () => {
    expect(
      TokenConsumptionSchema.safeParse({
        prompt_tokens: -1,
        completion_tokens: 0,
        total_tokens: 0,
        cost_eur: 0,
        since: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejette cost négatif", () => {
    expect(
      TokenConsumptionSchema.safeParse({
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_eur: -0.01,
        since: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  JobStatus                                                           */
/* ------------------------------------------------------------------ */

describe("Agents — JobStatus", () => {
  it("valide un job en cours", () => {
    const ok = JobStatusSchema.parse({
      job_id: "01HXYZ",
      kind: "chat",
      state: "RUNNING",
      progress: 50,
      started_at: "2026-06-10T15:30:00.000Z",
      ended_at: null,
      latency_ms: null,
    });
    expect(ok.state).toBe("RUNNING");
  });

  it("rejette progress > 100", () => {
    expect(
      JobStatusSchema.safeParse({
        job_id: "01HXYZ",
        kind: "chat",
        state: "RUNNING",
        progress: 101,
        started_at: "2026-06-10T15:30:00.000Z",
        ended_at: null,
        latency_ms: null,
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  AgentSnapshot                                                       */
/* ------------------------------------------------------------------ */

const SAMPLE_SNAPSHOT = {
  slot: "agent.std-rh-onboarding",
  tenant_id: "000000",
  status: "IDLE" as const,
  last_activity_at: "2026-06-10T15:30:00.000Z",
  current_job: null,
  tokens_24h: {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost_eur: 0,
    since: "2026-06-09T15:30:00.000Z",
    updated_at: "2026-06-10T15:30:00.000Z",
  },
  delegation_depth: 1,
  snapshot_version: 42,
  source: "db_only" as const,
};

describe("Agents — AgentSnapshot", () => {
  it("valide un snapshot complet", () => {
    const ok = AgentSnapshotSchema.parse(SAMPLE_SNAPSHOT);
    expect(ok.status).toBe("IDLE");
  });

  it("rejette delegation_depth > 3", () => {
    expect(
      AgentSnapshotSchema.safeParse({ ...SAMPLE_SNAPSHOT, delegation_depth: 4 })
        .success,
    ).toBe(false);
  });

  it("rejette source inconnue", () => {
    expect(
      AgentSnapshotSchema.safeParse({
        ...SAMPLE_SNAPSHOT,
        source: "leaked" as "db_only",
      }).success,
    ).toBe(false);
  });

  it("rejette tenant_id absent", () => {
    const { tenant_id: _drop, ...withoutTenant } = SAMPLE_SNAPSHOT;
    void _drop;
    expect(AgentSnapshotSchema.safeParse(withoutTenant).success).toBe(false);
  });

  it("AgentSnapshotList = tableau", () => {
    expect(AgentSnapshotListSchema.parse([SAMPLE_SNAPSHOT])).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  AgentDelta union                                                    */
/* ------------------------------------------------------------------ */

describe("Agents — AgentDelta union", () => {
  it("valide StatusChangeDelta", () => {
    const ok = StatusChangeDeltaSchema.parse({
      type: "status_change",
      slot: "agent.std-rh-onboarding",
      tenant_id: "000000",
      at: "2026-06-10T15:30:00.000Z",
      from: "IDLE",
      to: "RUNNING",
    });
    expect(ok.to).toBe("RUNNING");
  });

  it("valide TokenAppendDelta", () => {
    const ok = TokenAppendDeltaSchema.parse({
      type: "token_append",
      slot: "agent.std-rh-onboarding",
      tenant_id: "000000",
      at: "2026-06-10T15:30:00.000Z",
      prompt_tokens: 100,
      completion_tokens: 50,
      cost_eur: 0.001,
    });
    expect(ok.cost_eur).toBeCloseTo(0.001);
  });

  it("valide JobEventDelta", () => {
    const ok = JobEventDeltaSchema.parse({
      type: "job_event",
      slot: "agent.std-rh-onboarding",
      tenant_id: "000000",
      at: "2026-06-10T15:30:00.000Z",
      job: {
        job_id: "01HXYZ",
        kind: "chat",
        state: "SUCCESS",
        progress: 100,
        started_at: "2026-06-10T15:00:00.000Z",
        ended_at: "2026-06-10T15:30:00.000Z",
        latency_ms: 1800000,
      },
    });
    expect(ok.job.state).toBe("SUCCESS");
  });

  it("AgentDeltaSchema discriminated par type", () => {
    const r = AgentDeltaSchema.parse({
      type: "status_change",
      slot: "agent.x",
      tenant_id: "000000",
      at: "2026-06-10T15:30:00.000Z",
      from: "IDLE",
      to: "RUNNING",
    });
    expect(r.type).toBe("status_change");
  });

  it("AgentDeltaSchema rejette type inconnu", () => {
    expect(
      AgentDeltaSchema.safeParse({
        type: "foo",
        slot: "agent.x",
        tenant_id: "000000",
        at: "2026-06-10T15:30:00.000Z",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  AgentStream                                                         */
/* ------------------------------------------------------------------ */

describe("Agents — AgentStream", () => {
  it("valide un stream complet", () => {
    const ok = AgentStreamSchema.parse({
      snapshot: SAMPLE_SNAPSHOT,
      deltas: [],
      nextCursor: null,
      pollAfterMs: 5000,
    });
    expect(ok.pollAfterMs).toBe(5000);
  });

  it("rejette pollAfterMs < 1000", () => {
    expect(
      AgentStreamSchema.safeParse({
        snapshot: SAMPLE_SNAPSHOT,
        deltas: [],
        nextCursor: null,
        pollAfterMs: 500,
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Inputs tRPC                                                         */
/* ------------------------------------------------------------------ */

describe("Agents — tRPC inputs", () => {
  it("ListAgentStatsInput accepte filtres optionnels", () => {
    const ok = ListAgentStatsInputSchema.parse({});
    expect(ok.limit).toBe(50);

    const ok2 = ListAgentStatsInputSchema.parse({
      status: "RUNNING",
      pole: "rh",
      limit: 10,
    });
    expect(ok2.pole).toBe("rh");
  });

  it("ListAgentStatsInput rejette limit > 100", () => {
    expect(ListAgentStatsInputSchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });

  it("DetailAgentStatsInput valide un slot", () => {
    expect(
      DetailAgentStatsInputSchema.parse({ slot: "agent.rh-x" }).slot,
    ).toBe("agent.rh-x");
  });

  it("StreamAgentStatsInput accepte sinceCursor optionnel", () => {
    const ok = StreamAgentStatsInputSchema.parse({ slot: "agent.x" });
    expect(ok.sinceCursor).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Constantes                                                          */
/* ------------------------------------------------------------------ */

describe("Agents — constantes", () => {
  it("TOKEN_WINDOW_MS = 24h", () => {
    expect(TOKEN_WINDOW_MS).toBe(86_400_000);
  });

  it("DEFAULT_POLL_AFTER_MS = 5000", () => {
    expect(DEFAULT_POLL_AFTER_MS).toBe(5_000);
  });

  it("DELTA_STALE_AFTER_MS = 60s", () => {
    expect(DELTA_STALE_AFTER_MS).toBe(60_000);
  });
});

/* ------------------------------------------------------------------ */
/*  Fabrication-secret invariance                                       */
/* ------------------------------------------------------------------ */

describe("Agents — FORBIDDEN_AGENT_STATS_FIELDS invariance", () => {
  it("expose 9 champs interdits", () => {
    expect(FORBIDDEN_AGENT_STATS_FIELDS).toHaveLength(9);
  });

  it("contient `prompt`, `chain_of_thought`, `output_schema`", () => {
    expect(FORBIDDEN_AGENT_STATS_FIELDS).toContain("prompt");
    expect(FORBIDDEN_AGENT_STATS_FIELDS).toContain("chain_of_thought");
    expect(FORBIDDEN_AGENT_STATS_FIELDS).toContain("output_schema");
  });

  it("AgentSnapshot ne contient AUCUN champ interdit", () => {
    const keys = Object.keys(AgentSnapshotSchema.shape);
    for (const forbidden of FORBIDDEN_AGENT_STATS_FIELDS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("StreamAgentStatsOutput == AgentStream", () => {
    expect(StreamAgentStatsOutputSchema).toBe(AgentStreamSchema);
  });
});
