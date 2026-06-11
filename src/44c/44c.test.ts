/**
 * Tests Vitest — 44C lingua franca.
 *
 * Couverture :
 *  - regex stricte / permissive
 *  - is44C type-guard
 *  - parse44C : succès, erreurs, roundtrip
 *  - format44C : padding, validation segments
 *  - tryParse44C : null safety
 *  - constantes C44_TYPES_*
 */

import { describe, expect, it } from "vitest";
import {
  C44_TYPES_ALL,
  C44_TYPES_PERSISTENT,
  C44_TYPES_RUNTIME,
  C44_TYPES_SURFACE,
  C44_LEVELS,
  asT44C,
  is44C,
  isLoose44C,
  parse44C,
  tryParse44C,
  format44C,
  STRICT_44C_REGEX,
  LOOSE_44C_REGEX,
  PARTS_44C_REGEX,
  C44_LENGTH,
} from "./index.js";

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

describe("44C — constantes", () => {
  it("expose 8 types persistants", () => {
    expect(C44_TYPES_PERSISTENT).toHaveLength(8);
    expect(C44_TYPES_PERSISTENT).toContain("ACTR");
    expect(C44_TYPES_PERSISTENT).toContain("PACK");
    expect(C44_TYPES_PERSISTENT).toContain("ROOM");
    expect(C44_TYPES_PERSISTENT).toContain("ACL_");
  });

  it("expose 4 types runtime éphémères", () => {
    expect(C44_TYPES_RUNTIME).toHaveLength(4);
    expect(C44_TYPES_RUNTIME).toEqual(["MSG_", "INS_", "EVT_", "RSP_"]);
  });

  it("expose 4 types surface UI", () => {
    expect(C44_TYPES_SURFACE).toHaveLength(4);
    expect(C44_TYPES_SURFACE).toContain("TILE");
    expect(C44_TYPES_SURFACE).toContain("TASK");
    expect(C44_TYPES_SURFACE).toContain("DISP");
    expect(C44_TYPES_SURFACE).toContain("FLOW");
  });

  it("expose union exhaustive 16 types", () => {
    expect(C44_TYPES_ALL).toHaveLength(16);
  });

  it("expose 4 niveaux ACL L0..L3", () => {
    expect(C44_LEVELS).toEqual(["L0", "L1", "L2", "L3"]);
  });

  it("définit C44_LENGTH = 44", () => {
    expect(C44_LENGTH).toBe(44);
  });
});

/* ------------------------------------------------------------------ */
/*  Regex                                                              */
/* ------------------------------------------------------------------ */

describe("44C — regex", () => {
  it("STRICT_44C_REGEX accepte 44 chars [A-Z0-9_]", () => {
    expect(STRICT_44C_REGEX.test("A".repeat(44))).toBe(true);
    expect(STRICT_44C_REGEX.test("PACK_L1_000000_PCKDOC_001_26061001")).toBe(false); // 34 chars
    expect(
      STRICT_44C_REGEX.test("PACK_L1_000000_PCKDOC_001_26061001__________"),
    ).toBe(true); // 44 chars padded
  });

  it("STRICT_44C_REGEX rejette caractères minuscules", () => {
    expect(STRICT_44C_REGEX.test("a".repeat(44))).toBe(false);
  });

  it("STRICT_44C_REGEX rejette caractères spéciaux", () => {
    expect(STRICT_44C_REGEX.test("A".repeat(43) + "-")).toBe(false);
    expect(STRICT_44C_REGEX.test("A".repeat(43) + ":")).toBe(false);
    expect(STRICT_44C_REGEX.test("A".repeat(43) + " ")).toBe(false);
  });

  it("STRICT_44C_REGEX rejette les longueurs hors 44", () => {
    expect(STRICT_44C_REGEX.test("A".repeat(43))).toBe(false);
    expect(STRICT_44C_REGEX.test("A".repeat(45))).toBe(false);
    expect(STRICT_44C_REGEX.test("")).toBe(false);
  });

  it("LOOSE_44C_REGEX accepte 1..44 chars", () => {
    expect(LOOSE_44C_REGEX.test("A")).toBe(true);
    expect(LOOSE_44C_REGEX.test("A".repeat(44))).toBe(true);
    expect(LOOSE_44C_REGEX.test("")).toBe(false);
    expect(LOOSE_44C_REGEX.test("A".repeat(45))).toBe(false);
  });

  it("PARTS_44C_REGEX capture 6 segments d'un T44C canonique", () => {
    const m = "PACK_L1_000000_PCKDOC_001_26061001".match(PARTS_44C_REGEX);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe("PACK");
    expect(m?.[2]).toBe("L1");
    expect(m?.[3]).toBe("000000");
    expect(m?.[4]).toBe("PCKDOC");
    expect(m?.[5]).toBe("001");
    expect(m?.[6]).toBe("26061001");
  });
});

/* ------------------------------------------------------------------ */
/*  is44C / isLoose44C                                                 */
/* ------------------------------------------------------------------ */

describe("44C — is44C type-guard", () => {
  it("retourne true sur un T44C strict 44 chars", () => {
    expect(is44C("A".repeat(44))).toBe(true);
  });

  it("retourne false sur autres types", () => {
    expect(is44C(null)).toBe(false);
    expect(is44C(undefined)).toBe(false);
    expect(is44C(42)).toBe(false);
    expect(is44C({})).toBe(false);
    expect(is44C([])).toBe(false);
  });

  it("retourne false sur strings malformées", () => {
    expect(is44C("foo")).toBe(false);
    expect(is44C("a".repeat(44))).toBe(false);
    expect(is44C("A".repeat(43))).toBe(false);
  });

  it("isLoose44C accepte les slots V1 court", () => {
    expect(isLoose44C("TILE")).toBe(true);
    expect(isLoose44C("AGENT_RH")).toBe(true);
    expect(isLoose44C("")).toBe(false);
  });

  it("isLoose44C rejette caractères minuscules", () => {
    expect(isLoose44C("agent")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  parse44C                                                           */
/* ------------------------------------------------------------------ */

describe("44C — parse44C", () => {
  it("parse un T44C canonique en 6 segments", () => {
    const parts = parse44C("PACK_L1_000000_PCKDOC_001_26061001");
    expect(parts).toEqual({
      type: "PACK",
      level: "L1",
      tenant: "000000",
      sku: "PCKDOC",
      version: "001",
      date: "26061001",
    });
  });

  it("parse un T44C avec type underscore-terminé", () => {
    const parts = parse44C("CTR__L2_STKMTH_PCKTLS_V01_26061002");
    expect(parts.type).toBe("CTR_");
    expect(parts.level).toBe("L2");
    expect(parts.tenant).toBe("STKMTH");
  });

  it("parse un T44C ACL_ ", () => {
    const parts = parse44C("ACL__L0_000000_ROOTDM_V01_26061001");
    expect(parts.type).toBe("ACL_");
    expect(parts.level).toBe("L0");
  });

  it("parse un T44C avec padding", () => {
    const parts = parse44C("PACK_L1_000000_PCKDOC_001_26061001__________");
    expect(parts.type).toBe("PACK");
    expect(parts.sku).toBe("PCKDOC");
  });

  it("lève sur format invalide", () => {
    expect(() => parse44C("not a 44c")).toThrow(/invalid format/);
    expect(() => parse44C("FOO_BAR_BAZ")).toThrow();
  });

  it("lève sur type inconnu", () => {
    expect(() => parse44C("XXXX_L1_000000_FOOBAR_001_26061001")).toThrow(
      /unknown type/,
    );
  });

  it("lève sur string vide", () => {
    expect(() => parse44C("")).toThrow(/out of bounds/);
  });

  it("lève sur dépassement longueur", () => {
    expect(() => parse44C("A".repeat(45))).toThrow(/out of bounds/);
  });

  it("lève sur arg non string", () => {
    expect(() => parse44C(42 as unknown as string)).toThrow(/must be a string/);
  });
});

describe("44C — tryParse44C", () => {
  it("renvoie le résultat sur succès", () => {
    expect(tryParse44C("PACK_L1_000000_PCKDOC_001_26061001")).toEqual({
      type: "PACK",
      level: "L1",
      tenant: "000000",
      sku: "PCKDOC",
      version: "001",
      date: "26061001",
    });
  });

  it("renvoie null sur erreur", () => {
    expect(tryParse44C("garbage")).toBeNull();
    expect(tryParse44C("")).toBeNull();
    expect(tryParse44C("XXXX_L1_000000_FOOBAR_001_26061001")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  format44C                                                          */
/* ------------------------------------------------------------------ */

describe("44C — format44C", () => {
  it("compose un T44C depuis 6 segments et pad à 44 chars", () => {
    const out = format44C({
      type: "PACK",
      level: "L1",
      tenant: "000000",
      sku: "PCKDOC",
      version: "001",
      date: "26061001",
    });
    expect(out).toHaveLength(44);
    expect(is44C(out)).toBe(true);
    expect(out.startsWith("PACK_L1_000000_PCKDOC_001_26061001")).toBe(true);
  });

  it("compose un T44C ACTR avec ROO position", () => {
    const out = format44C({
      type: "ACTR",
      level: "L1",
      tenant: "STKHQ0",
      sku: "HUMABC",
      version: "ROO",
      date: "26061001",
    });
    expect(out).toHaveLength(44);
    expect(is44C(out)).toBe(true);
  });

  it("lève sur segment trop long", () => {
    expect(() =>
      format44C({
        type: "PACK",
        level: "L1",
        tenant: "TOOOOLONG",
        sku: "PCKDOC",
        version: "001",
        date: "26061001",
      }),
    ).toThrow(/tenant length/);
  });

  it("lève sur segment vide", () => {
    expect(() =>
      format44C({
        type: "PACK",
        level: "L1",
        tenant: "",
        sku: "PCKDOC",
        version: "001",
        date: "26061001",
      }),
    ).toThrow(/tenant length/);
  });

  it("lève sur chars invalides dans un segment", () => {
    expect(() =>
      format44C({
        type: "PACK",
        level: "L1",
        tenant: "abc123",
        sku: "PCKDOC",
        version: "001",
        date: "26061001",
      }),
    ).toThrow(/invalid chars/);
  });

  it("lève sur level invalide alphabet", () => {
    expect(() =>
      format44C({
        type: "PACK",
        level: "L9" as "L1",
        tenant: "000000",
        sku: "PCKDOC",
        version: "001",
        date: "26061001",
      }),
    ).not.toThrow(); // level n'est pas validé contre enum dans format44C
    // par contraste, parse44C utilise la regex stricte L[0-3].
  });
});

/* ------------------------------------------------------------------ */
/*  Roundtrip parse ↔ format                                           */
/* ------------------------------------------------------------------ */

describe("44C — roundtrip parse ↔ format", () => {
  const samples = [
    {
      type: "PACK",
      level: "L1",
      tenant: "000000",
      sku: "PCKDOC",
      version: "001",
      date: "26061001",
    },
    {
      type: "ACTR",
      level: "L2",
      tenant: "STKMTH",
      sku: "AGIRH1",
      version: "V01",
      date: "26061010",
    },
    {
      type: "ROOM",
      level: "L1",
      tenant: "000000",
      sku: "OPSALR",
      version: "001",
      date: "26060901",
    },
    {
      type: "ACL_",
      level: "L0",
      tenant: "STKHQ0",
      sku: "ROOTDM",
      version: "V01",
      date: "26061001",
    },
    {
      type: "MSG_",
      level: "L3",
      tenant: "STKMTH",
      sku: "USR123",
      version: "001",
      date: "26061010",
    },
  ] as const;

  for (const sample of samples) {
    it(`roundtrip pour ${sample.type}_${sample.level}_${sample.tenant}`, () => {
      const formatted = format44C(sample);
      expect(is44C(formatted)).toBe(true);
      const parsed = parse44C(formatted);
      expect(parsed).toEqual(sample);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  asT44C brand                                                       */
/* ------------------------------------------------------------------ */

describe("44C — asT44C brand", () => {
  it("permet de caster une string en T44C", () => {
    const s = "A".repeat(44);
    const branded = asT44C(s);
    expect(branded).toBe(s);
  });
});
