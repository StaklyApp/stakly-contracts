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
  CopilotSuggestRequestSchema,
  CopilotSuggestionSchema,
  CopilotSuggestResponseSchema,
  CopilotSuggestionKindSchema,
  CopilotStreamStartedEventSchema,
  CopilotStreamChunkEventSchema,
  CopilotStreamSuggestionEventSchema,
  CopilotStreamDoneEventSchema,
  CopilotStreamErrorEventSchema,
  CopilotStreamEventSchema,
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

/* ------------------------------------------------------------------ */
/*  CopilotSuggest (Sprint F.5b)                                       */
/* ------------------------------------------------------------------ */

describe("CopilotSuggestionKindSchema", () => {
  it("accepte rewrite/addition/lint_warning", () => {
    expect(CopilotSuggestionKindSchema.parse("rewrite")).toBe("rewrite");
    expect(CopilotSuggestionKindSchema.parse("addition")).toBe("addition");
    expect(CopilotSuggestionKindSchema.parse("lint_warning")).toBe(
      "lint_warning",
    );
  });

  it("rejette kind inconnu", () => {
    expect(() => CopilotSuggestionKindSchema.parse("delete")).toThrow();
  });
});

describe("CopilotSuggestRequestSchema", () => {
  const baseAcl: AclCascade = [
    {
      level: "L0",
      immutable_by_lower_levels: true,
      default_deny: false,
      allowed_actors: [ACTR_OK],
      ttl_sec: 300,
    },
  ];

  const base = {
    groupSlot: "GRPMGR-MARKETING",
    layer: "L2" as const,
    draftText: "Tu es un agent marketing concis.",
    instructionsContext: "L0: respect RGPD.",
    tenant: "client-acme",
    actor_id: ACTR_OK,
    acl_cascade: baseAcl,
    trace_id: "trace-copilot-1",
  };

  it("parse request ok", () => {
    const req = CopilotSuggestRequestSchema.parse(base);
    expect(req.groupSlot).toBe("GRPMGR-MARKETING");
    expect(req.layer).toBe("L2");
  });

  it("draftText vide autorisé (premier brouillon)", () => {
    const req = CopilotSuggestRequestSchema.parse({ ...base, draftText: "" });
    expect(req.draftText).toBe("");
  });

  it("rejette draftText > 8000 chars", () => {
    expect(() =>
      CopilotSuggestRequestSchema.parse({
        ...base,
        draftText: "x".repeat(8_001),
      }),
    ).toThrow();
  });

  it("rejette groupSlot invalide", () => {
    expect(() =>
      CopilotSuggestRequestSchema.parse({
        ...base,
        groupSlot: "invalid slot with spaces",
      }),
    ).toThrow();
  });

  it("rejette layer hors L0-L3", () => {
    expect(() =>
      CopilotSuggestRequestSchema.parse({
        ...base,
        layer: "L4",
      }),
    ).toThrow();
  });

  it("rejette actor_id mauvaise longueur", () => {
    expect(() =>
      CopilotSuggestRequestSchema.parse({
        ...base,
        actor_id: "ACTR_too_short",
      }),
    ).toThrow();
  });
});

describe("CopilotSuggestionSchema", () => {
  it("parse suggestion rewrite ok", () => {
    const s = CopilotSuggestionSchema.parse({
      id: "sug-001",
      kind: "rewrite",
      title: "Renforcer le ton commercial",
      content: "Tu es un agent marketing focalisé conversion B2B.",
      reasoning: "Le draft est trop vague.",
      confidence: 78,
    });
    expect(s.kind).toBe("rewrite");
    expect(s.confidence).toBe(78);
  });

  it("rejette confidence > 100", () => {
    expect(() =>
      CopilotSuggestionSchema.parse({
        id: "x",
        kind: "addition",
        title: "T",
        content: "C",
        confidence: 150,
      }),
    ).toThrow();
  });

  it("rejette title trop long", () => {
    expect(() =>
      CopilotSuggestionSchema.parse({
        id: "x",
        kind: "addition",
        title: "x".repeat(81),
        content: "C",
        confidence: 50,
      }),
    ).toThrow();
  });
});

describe("CopilotSuggestResponseSchema", () => {
  it("parse response idle_forced (Iris en pause)", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [
        {
          id: "idle-1",
          kind: "lint_warning",
          title: "Killswitch actif",
          content: "Le moteur IA est en pause (L0 killswitch).",
          confidence: 100,
        },
      ],
      was_idle_forced: true,
      audit_signature: "stub:sha256:abc",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "trace-1",
      acl_decision: { allowed: true, reason: "killswitch mock", blocking_level: null },
    });
    expect(res.was_idle_forced).toBe(true);
    expect(res.suggestions).toHaveLength(1);
  });

  it("parse response ok avec 3 suggestions", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [
        { id: "s1", kind: "rewrite", title: "T1", content: "C1", confidence: 85 },
        { id: "s2", kind: "addition", title: "T2", content: "C2", confidence: 65 },
        { id: "s3", kind: "lint_warning", title: "T3", content: "C3", confidence: 40 },
      ],
      was_idle_forced: false,
      audit_signature: "stub:sha256:xyz",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "trace-2",
      acl_decision: { allowed: true, reason: "ok", blocking_level: null },
    });
    expect(res.suggestions).toHaveLength(3);
    expect(res.acl_decision.allowed).toBe(true);
  });

  it("rejette > 10 suggestions", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: `s${i}`,
      kind: "rewrite" as const,
      title: `T${i}`,
      content: `C${i}`,
      confidence: 50,
    }));
    expect(() =>
      CopilotSuggestResponseSchema.parse({
        suggestions: many,
        was_idle_forced: false,
        audit_signature: "sig",
        generated_at: "2026-06-11T10:00:00Z",
        trace_id: "t",
        acl_decision: { allowed: true, reason: "ok", blocking_level: null },
      }),
    ).toThrow();
  });

  it("parse response forbidden (ACL deny)", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [],
      was_idle_forced: false,
      audit_signature: "stub:sha256:deny",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "trace-deny",
      acl_decision: {
        allowed: false,
        reason: "forbidden at L1",
        blocking_level: "L1",
      },
    });
    expect(res.acl_decision.allowed).toBe(false);
    expect(res.suggestions).toHaveLength(0);
  });

  // Sprint G.7 — telemetry LLM optional fields
  it("parse response avec llm telemetry Ollama (Sprint G.7)", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [
        { id: "s1", kind: "rewrite", title: "T1", content: "C1", confidence: 85 },
      ],
      was_idle_forced: false,
      audit_signature: "sig",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "t-ollama",
      acl_decision: { allowed: true, reason: "ok", blocking_level: null },
      llm_backend: "ollama",
      llm_model: "phi3:mini",
      llm_latency_ms: 2840,
      was_ollama_fallback: false,
    });
    expect(res.llm_backend).toBe("ollama");
    expect(res.llm_model).toBe("phi3:mini");
    expect(res.llm_latency_ms).toBe(2840);
    expect(res.was_ollama_fallback).toBe(false);
  });

  it("parse response fallback (Ollama timeout → stub)", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [
        { id: "s1", kind: "lint_warning", title: "Cascade complète", content: "OK", confidence: 60 },
      ],
      was_idle_forced: false,
      audit_signature: "sig",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "t-fb",
      acl_decision: { allowed: true, reason: "ok", blocking_level: null },
      llm_backend: "stub",
      llm_model: null,
      llm_latency_ms: null,
      was_ollama_fallback: true,
    });
    expect(res.llm_backend).toBe("stub");
    expect(res.was_ollama_fallback).toBe(true);
  });

  it("parse response sans champs LLM (rétrocompatible)", () => {
    const res = CopilotSuggestResponseSchema.parse({
      suggestions: [],
      was_idle_forced: false,
      audit_signature: "sig",
      generated_at: "2026-06-11T10:00:00Z",
      trace_id: "t-legacy",
      acl_decision: { allowed: true, reason: "ok", blocking_level: null },
    });
    expect(res.llm_backend).toBeUndefined();
    expect(res.llm_model).toBeUndefined();
    expect(res.llm_latency_ms).toBeUndefined();
  });

  it("rejette llm_latency_ms négatif", () => {
    expect(() =>
      CopilotSuggestResponseSchema.parse({
        suggestions: [],
        was_idle_forced: false,
        audit_signature: "sig",
        generated_at: "2026-06-11T10:00:00Z",
        trace_id: "t",
        acl_decision: { allowed: true, reason: "ok", blocking_level: null },
        llm_latency_ms: -1,
      }),
    ).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  CopilotStream events (Sprint G.8 — SSE)                            */
/* ------------------------------------------------------------------ */

describe("CopilotStreamStartedEventSchema", () => {
  it("parse started event ok", () => {
    const ev = CopilotStreamStartedEventSchema.parse({
      type: "started",
      trace_id: "trace-g8-1",
      tenant: "client-acme",
      llm_backend: "ollama",
      llm_model: "phi3:mini",
      started_at: "2026-06-12T10:00:00Z",
    });
    expect(ev.type).toBe("started");
    expect(ev.llm_backend).toBe("ollama");
  });

  it("accepte llm_backend null (killswitch idle)", () => {
    const ev = CopilotStreamStartedEventSchema.parse({
      type: "started",
      trace_id: "trace-g8-idle",
      tenant: "client-acme",
      llm_backend: null,
      llm_model: null,
      started_at: "2026-06-12T10:00:00Z",
    });
    expect(ev.llm_backend).toBeNull();
  });

  it("rejette started_at non-ISO", () => {
    expect(() =>
      CopilotStreamStartedEventSchema.parse({
        type: "started",
        trace_id: "t",
        tenant: "c",
        llm_backend: null,
        llm_model: null,
        started_at: "yesterday",
      }),
    ).toThrow();
  });
});

describe("CopilotStreamChunkEventSchema", () => {
  it("parse chunk ok", () => {
    const ev = CopilotStreamChunkEventSchema.parse({
      type: "chunk",
      text: '{"suggestions":[',
      tokens_so_far: 5,
    });
    expect(ev.type).toBe("chunk");
    expect(ev.tokens_so_far).toBe(5);
  });

  it("rejette tokens_so_far négatif", () => {
    expect(() =>
      CopilotStreamChunkEventSchema.parse({
        type: "chunk",
        text: "x",
        tokens_so_far: -1,
      }),
    ).toThrow();
  });
});

describe("CopilotStreamSuggestionEventSchema", () => {
  it("parse suggestion event ok", () => {
    const ev = CopilotStreamSuggestionEventSchema.parse({
      type: "suggestion",
      index: 0,
      suggestion: {
        id: "ollama-0-renforcer",
        kind: "rewrite",
        title: "Renforcer le ton",
        content: "Tu es un agent marketing focalisé conversion.",
        confidence: 82,
      },
    });
    expect(ev.index).toBe(0);
    expect(ev.suggestion.kind).toBe("rewrite");
  });

  it("rejette index hors 0-9", () => {
    expect(() =>
      CopilotStreamSuggestionEventSchema.parse({
        type: "suggestion",
        index: 10,
        suggestion: {
          id: "s",
          kind: "rewrite",
          title: "t",
          content: "c",
          confidence: 50,
        },
      }),
    ).toThrow();
  });
});

describe("CopilotStreamDoneEventSchema", () => {
  it("parse done event complet ok", () => {
    const ev = CopilotStreamDoneEventSchema.parse({
      type: "done",
      suggestions: [
        {
          id: "s1",
          kind: "rewrite",
          title: "T1",
          content: "C1",
          confidence: 80,
        },
      ],
      was_idle_forced: false,
      was_ollama_fallback: false,
      audit_signature: "stub:sha256:abc",
      llm_backend: "ollama",
      llm_model: "phi3:mini",
      llm_latency_ms: 16800,
      total_tokens: 142,
      generated_at: "2026-06-12T10:00:17Z",
    });
    expect(ev.suggestions).toHaveLength(1);
    expect(ev.total_tokens).toBe(142);
    expect(ev.llm_latency_ms).toBe(16800);
  });

  it("parse done event killswitch idle (llm_backend=null)", () => {
    const ev = CopilotStreamDoneEventSchema.parse({
      type: "done",
      suggestions: [],
      was_idle_forced: true,
      was_ollama_fallback: false,
      audit_signature: "sig",
      llm_backend: null,
      llm_model: null,
      llm_latency_ms: 0,
      total_tokens: 0,
      generated_at: "2026-06-12T10:00:00Z",
    });
    expect(ev.was_idle_forced).toBe(true);
  });

  it("rejette llm_latency_ms > 120000", () => {
    expect(() =>
      CopilotStreamDoneEventSchema.parse({
        type: "done",
        suggestions: [],
        was_idle_forced: false,
        was_ollama_fallback: false,
        audit_signature: "sig",
        llm_backend: "ollama",
        llm_model: "m",
        llm_latency_ms: 200_000,
        total_tokens: 0,
        generated_at: "2026-06-12T10:00:00Z",
      }),
    ).toThrow();
  });
});

describe("CopilotStreamErrorEventSchema", () => {
  it("parse error event killswitch ok", () => {
    const ev = CopilotStreamErrorEventSchema.parse({
      type: "error",
      code: "killswitch_idle",
      message: "engine idle forced",
    });
    expect(ev.code).toBe("killswitch_idle");
  });

  it("parse error event acl_forbidden ok", () => {
    const ev = CopilotStreamErrorEventSchema.parse({
      type: "error",
      code: "acl_forbidden",
      message: "actor forbidden at L1",
    });
    expect(ev.code).toBe("acl_forbidden");
  });

  it("rejette code inconnu", () => {
    expect(() =>
      CopilotStreamErrorEventSchema.parse({
        type: "error",
        code: "panic",
        message: "x",
      }),
    ).toThrow();
  });

  it("rejette message > 500 chars", () => {
    expect(() =>
      CopilotStreamErrorEventSchema.parse({
        type: "error",
        code: "internal",
        message: "x".repeat(501),
      }),
    ).toThrow();
  });
});

describe("CopilotStreamEventSchema (union discriminée)", () => {
  it("dispatch sur started", () => {
    const ev = CopilotStreamEventSchema.parse({
      type: "started",
      trace_id: "t",
      tenant: "c",
      llm_backend: "ollama",
      llm_model: "phi3:mini",
      started_at: "2026-06-12T10:00:00Z",
    });
    expect(ev.type).toBe("started");
  });

  it("dispatch sur chunk", () => {
    const ev = CopilotStreamEventSchema.parse({
      type: "chunk",
      text: "{",
      tokens_so_far: 1,
    });
    expect(ev.type).toBe("chunk");
  });

  it("dispatch sur suggestion", () => {
    const ev = CopilotStreamEventSchema.parse({
      type: "suggestion",
      index: 0,
      suggestion: {
        id: "s",
        kind: "rewrite",
        title: "t",
        content: "c",
        confidence: 50,
      },
    });
    expect(ev.type).toBe("suggestion");
  });

  it("dispatch sur done", () => {
    const ev = CopilotStreamEventSchema.parse({
      type: "done",
      suggestions: [],
      was_idle_forced: false,
      was_ollama_fallback: false,
      audit_signature: "sig",
      llm_backend: null,
      llm_model: null,
      llm_latency_ms: 0,
      total_tokens: 0,
      generated_at: "2026-06-12T10:00:00Z",
    });
    expect(ev.type).toBe("done");
  });

  it("dispatch sur error", () => {
    const ev = CopilotStreamEventSchema.parse({
      type: "error",
      code: "llm_timeout",
      message: "timeout 60s",
    });
    expect(ev.type).toBe("error");
  });

  it("rejette type inconnu", () => {
    expect(() =>
      CopilotStreamEventSchema.parse({ type: "garbage", foo: "bar" }),
    ).toThrow();
  });
});
