/**
 * Tests Vitest — schemas AIE.
 */

import { describe, it, expect } from "vitest";
import {
  MTLSConfigSchema,
  KillswitchPollResultSchema,
  AIEHealthCheckSchema,
  InferenceRequestSchema,
  InferenceResponseSchema,
  resolveAclCascade,
} from "./index.js";
import type { AclCascade } from "../runtime/index.js";

const ACTR_OK = "ACTR_" + "Y".repeat(39);
const ACTR_OTHER = "ACTR_" + "Z".repeat(39);

describe("MTLSConfigSchema", () => {
  const base = {
    ai_hub_url: "https://api.ai-hub.stakly.app",
    client_cert_path: "/secrets/aie/client.crt",
    client_key_path: "/secrets/aie/client.key",
    ca_bundle_path: "/secrets/aie/ca.crt",
    server_fingerprint_sha256: "a".repeat(64),
    tenant_id: "client-acme",
    ed25519_signing_key_vault_path: "secret/stakly/aie/signing",
  };

  it("parse base ok", () => {
    expect(() => MTLSConfigSchema.parse(base)).not.toThrow();
  });

  it("rejette HTTP non-TLS", () => {
    expect(() =>
      MTLSConfigSchema.parse({
        ...base,
        ai_hub_url: "http://api.ai-hub.stakly.app",
      }),
    ).toThrow();
  });

  it("rejette fingerprint trop court", () => {
    expect(() =>
      MTLSConfigSchema.parse({
        ...base,
        server_fingerprint_sha256: "a".repeat(32),
      }),
    ).toThrow();
  });
});

describe("KillswitchPollResultSchema", () => {
  it("parse poll OK", () => {
    const p = KillswitchPollResultSchema.parse({
      state: {
        status: "active",
        last_check_at: "2026-06-11T10:00:00Z",
        last_ok_at: "2026-06-11T10:00:00Z",
        last_http_code: 200,
        reason: null,
      },
      latency_ms: 42,
      trace_id: "trace-abc",
      must_force_idle: false,
    });
    expect(p.must_force_idle).toBe(false);
  });

  it("parse poll killswitch active (must_force_idle=true)", () => {
    const p = KillswitchPollResultSchema.parse({
      state: {
        status: "idle_forced",
        last_check_at: "2026-06-11T10:00:00Z",
        last_ok_at: null,
        last_http_code: 403,
        reason: "killswitch active",
      },
      latency_ms: 80,
      trace_id: "trace-def",
      must_force_idle: true,
    });
    expect(p.must_force_idle).toBe(true);
  });
});

describe("AIEHealthCheckSchema", () => {
  it("parse healthz ok", () => {
    const h = AIEHealthCheckSchema.parse({
      status: "ok",
      version: "1.0.0",
      at: "2026-06-11T10:00:00Z",
      checks: {
        ai_hub_reachable: { ok: true, latency_ms: 30 },
        vault_unsealed: { ok: true },
        l0_cache_fresh: { ok: true, latency_ms: 1 },
      },
      killswitch_status: "active",
      uptime_sec: 3600,
    });
    expect(h.status).toBe("ok");
    expect(Object.keys(h.checks)).toContain("ai_hub_reachable");
  });

  it("parse degraded avec sub-check fail", () => {
    const h = AIEHealthCheckSchema.parse({
      status: "degraded",
      version: "1.0.0",
      at: "2026-06-11T10:00:00Z",
      checks: {
        ai_hub_reachable: { ok: false, message: "connection refused" },
      },
      killswitch_status: "idle_forced",
      uptime_sec: 100,
    });
    expect(h.status).toBe("degraded");
  });
});

describe("InferenceRequestSchema", () => {
  it("parse request ok", () => {
    const req = InferenceRequestSchema.parse({
      agent_slug: "agent.std-comptable",
      tenant_id: "client-acme",
      actor_id: ACTR_OK,
      scope_id: 1,
      acl_cascade: [
        { level: "L0", immutable_by_lower_levels: true, default_deny: false, ttl_sec: 300 },
      ],
      user_message: "Bonjour",
      trace_id: "trace-abc",
    });
    expect(req.agent_slug).toContain("agent.");
  });

  it("rejette user_message vide", () => {
    expect(() =>
      InferenceRequestSchema.parse({
        agent_slug: "agent.test",
        tenant_id: "t",
        actor_id: ACTR_OK,
        scope_id: 1,
        acl_cascade: [
          { level: "L0", immutable_by_lower_levels: false, default_deny: false, ttl_sec: 300 },
        ],
        user_message: "",
        trace_id: "t",
      }),
    ).toThrow();
  });
});

describe("InferenceResponseSchema", () => {
  it("parse response ok", () => {
    const res = InferenceResponseSchema.parse({
      status: "ok",
      acl_decision: { allowed: true, reason: "ok", blocking_level: null },
      output_text: "Bonjour, je peux vous aider.",
      latency_ms: 120,
      tokens_in: 10,
      tokens_out: 20,
      signature: "ed25519:abc",
      trace_id: "trace-abc",
      error_code: null,
      error_message: null,
    });
    expect(res.status).toBe("ok");
  });

  it("parse response killswitch", () => {
    const res = InferenceResponseSchema.parse({
      status: "killswitch",
      acl_decision: { allowed: false, reason: "killswitch", blocking_level: "L0" },
      output_text: null,
      latency_ms: 5,
      tokens_in: 0,
      tokens_out: 0,
      signature: null,
      trace_id: "trace-abc",
      error_code: "AIE_KILLSWITCH",
      error_message: "engine idle forced",
    });
    expect(res.status).toBe("killswitch");
    expect(res.acl_decision.blocking_level).toBe("L0");
  });
});

describe("resolveAclCascade — INTERSECTION", () => {
  it("forbidden d'un seul layer = refus immédiat", () => {
    const cascade: AclCascade = [
      {
        level: "L0",
        immutable_by_lower_levels: true,
        default_deny: false,
        allowed_actors: [ACTR_OK],
        ttl_sec: 300,
      },
      {
        level: "L1",
        immutable_by_lower_levels: false,
        default_deny: false,
        forbidden_actors: [ACTR_OK],
        ttl_sec: 300,
      },
    ];
    const decision = resolveAclCascade(cascade, ACTR_OK);
    expect(decision.allowed).toBe(false);
    expect(decision.blocking_level).toBe("L1");
  });

  it("allowed seul = ok", () => {
    const cascade: AclCascade = [
      {
        level: "L0",
        immutable_by_lower_levels: false,
        default_deny: false,
        allowed_actors: [ACTR_OK],
        ttl_sec: 300,
      },
    ];
    const decision = resolveAclCascade(cascade, ACTR_OK);
    expect(decision.allowed).toBe(true);
  });

  it("default_deny + pas d'allow rule = refus", () => {
    const cascade: AclCascade = [
      {
        level: "L1",
        immutable_by_lower_levels: false,
        default_deny: true,
        allowed_actors: [ACTR_OTHER],
        ttl_sec: 300,
      },
    ];
    const decision = resolveAclCascade(cascade, ACTR_OK);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("default_deny");
  });

  it("immutable_by_lower_levels respecté (L0 allow gagne sur L1 default_deny)", () => {
    const cascade: AclCascade = [
      {
        level: "L0",
        immutable_by_lower_levels: true,
        default_deny: false,
        allowed_actors: [ACTR_OK],
        ttl_sec: 300,
      },
      {
        level: "L1",
        immutable_by_lower_levels: false,
        default_deny: true,
        ttl_sec: 300,
      },
    ];
    const decision = resolveAclCascade(cascade, ACTR_OK);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain("immutable");
  });

  it("aucune règle = open par défaut", () => {
    const cascade: AclCascade = [
      {
        level: "L0",
        immutable_by_lower_levels: false,
        default_deny: false,
        ttl_sec: 300,
      },
    ];
    const decision = resolveAclCascade(cascade, ACTR_OK);
    expect(decision.allowed).toBe(true);
  });
});
