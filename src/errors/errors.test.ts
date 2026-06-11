import { describe, expect, it } from "vitest";
import {
  AclDeniedErrorSchema,
  ActorInvalidErrorSchema,
  BadRequestErrorSchema,
  ConflictErrorSchema,
  ForbiddenErrorSchema,
  InternalErrorSchema,
  NotFoundErrorSchema,
  RateLimitErrorSchema,
  StaklyErrorCodeSchema,
  StaklyErrorSchema,
  TenantMissingErrorSchema,
  UnauthorizedErrorSchema,
  httpStatusForStaklyError,
  isStaklyError,
  makeStaklyError,
} from "./index.js";

describe("Errors — StaklyErrorCode", () => {
  it("expose 10 codes canon", () => {
    expect(StaklyErrorCodeSchema.options).toHaveLength(10);
    expect(StaklyErrorCodeSchema.options).toContain("UNAUTHORIZED");
    expect(StaklyErrorCodeSchema.options).toContain("ACL_DENIED");
    expect(StaklyErrorCodeSchema.options).toContain("TENANT_MISSING");
    expect(StaklyErrorCodeSchema.options).toContain("ACTOR_INVALID");
  });
});

describe("Errors — variantes individuelles", () => {
  it("UnauthorizedError valide", () => {
    const ok = UnauthorizedErrorSchema.parse({
      code: "UNAUTHORIZED",
      message: "Auth required.",
    });
    expect(ok.code).toBe("UNAUTHORIZED");
  });

  it("ForbiddenError valide", () => {
    const ok = ForbiddenErrorSchema.parse({
      code: "FORBIDDEN",
      message: "Access denied.",
    });
    expect(ok.code).toBe("FORBIDDEN");
  });

  it("NotFoundError accepte resource", () => {
    const ok = NotFoundErrorSchema.parse({
      code: "NOT_FOUND",
      message: "Agent not found.",
      resource: "agent.std-rh-onboarding",
    });
    expect(ok.resource).toBe("agent.std-rh-onboarding");
  });

  it("BadRequestError accepte field", () => {
    const ok = BadRequestErrorSchema.parse({
      code: "BAD_REQUEST",
      message: "Slot invalide.",
      field: "slot",
    });
    expect(ok.field).toBe("slot");
  });

  it("ConflictError valide", () => {
    expect(
      ConflictErrorSchema.parse({ code: "CONFLICT", message: "Race." }).code,
    ).toBe("CONFLICT");
  });

  it("AclDeniedError exige blocking_level", () => {
    const ok = AclDeniedErrorSchema.parse({
      code: "ACL_DENIED",
      message: "Denied.",
      blocking_level: "L2",
    });
    expect(ok.blocking_level).toBe("L2");

    expect(
      AclDeniedErrorSchema.safeParse({
        code: "ACL_DENIED",
        message: "x",
      }).success,
    ).toBe(false);
  });

  it("TenantMissingError valide", () => {
    expect(
      TenantMissingErrorSchema.parse({
        code: "TENANT_MISSING",
        message: "No tenant in session.",
      }).code,
    ).toBe("TENANT_MISSING");
  });

  it("ActorInvalidError accepte actor", () => {
    const ok = ActorInvalidErrorSchema.parse({
      code: "ACTOR_INVALID",
      message: "Actor not found.",
      actor: "ACTR_L1_xxx",
    });
    expect(ok.actor).toBe("ACTR_L1_xxx");
  });

  it("RateLimitError exige retry_after_ms", () => {
    const ok = RateLimitErrorSchema.parse({
      code: "RATE_LIMIT",
      message: "Too many requests.",
      retry_after_ms: 5000,
    });
    expect(ok.retry_after_ms).toBe(5000);
  });

  it("InternalError valide", () => {
    expect(
      InternalErrorSchema.parse({ code: "INTERNAL", message: "Boom." }).code,
    ).toBe("INTERNAL");
  });
});

describe("Errors — Union discriminée", () => {
  it("discrimine par code", () => {
    const e = StaklyErrorSchema.parse({
      code: "ACL_DENIED",
      message: "x",
      blocking_level: "L0",
    });
    if (e.code === "ACL_DENIED") {
      expect(e.blocking_level).toBe("L0");
    }
  });

  it("rejette code inconnu", () => {
    expect(
      StaklyErrorSchema.safeParse({ code: "NOPE", message: "x" }).success,
    ).toBe(false);
  });
});

describe("Errors — isStaklyError type-guard", () => {
  it("true sur erreur valide", () => {
    expect(isStaklyError({ code: "FORBIDDEN", message: "x" })).toBe(true);
  });

  it("false sur objet random", () => {
    expect(isStaklyError({ foo: "bar" })).toBe(false);
    expect(isStaklyError(null)).toBe(false);
  });
});

describe("Errors — makeStaklyError", () => {
  it("retourne l'erreur après validation", () => {
    const e = makeStaklyError({
      code: "BAD_REQUEST",
      message: "Invalid slot",
      field: "slot",
    });
    expect(e.code).toBe("BAD_REQUEST");
  });

  it("lève sur erreur invalide", () => {
    expect(() =>
      makeStaklyError({ code: "BAD_REQUEST" } as unknown as Parameters<
        typeof makeStaklyError
      >[0]),
    ).toThrow();
  });
});

describe("Errors — httpStatusForStaklyError", () => {
  it("UNAUTHORIZED → 401", () => {
    expect(httpStatusForStaklyError("UNAUTHORIZED")).toBe(401);
  });

  it("FORBIDDEN → 403", () => {
    expect(httpStatusForStaklyError("FORBIDDEN")).toBe(403);
  });

  it("ACL_DENIED → 403", () => {
    expect(httpStatusForStaklyError("ACL_DENIED")).toBe(403);
  });

  it("TENANT_MISSING → 403", () => {
    expect(httpStatusForStaklyError("TENANT_MISSING")).toBe(403);
  });

  it("NOT_FOUND → 404", () => {
    expect(httpStatusForStaklyError("NOT_FOUND")).toBe(404);
  });

  it("BAD_REQUEST → 400", () => {
    expect(httpStatusForStaklyError("BAD_REQUEST")).toBe(400);
  });

  it("ACTOR_INVALID → 400", () => {
    expect(httpStatusForStaklyError("ACTOR_INVALID")).toBe(400);
  });

  it("CONFLICT → 409", () => {
    expect(httpStatusForStaklyError("CONFLICT")).toBe(409);
  });

  it("RATE_LIMIT → 429", () => {
    expect(httpStatusForStaklyError("RATE_LIMIT")).toBe(429);
  });

  it("INTERNAL → 500", () => {
    expect(httpStatusForStaklyError("INTERNAL")).toBe(500);
  });
});
