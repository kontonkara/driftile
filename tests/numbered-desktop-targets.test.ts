import { describe, expect, it } from "vitest";

import {
  EMPTY_NUMBERED_DESKTOP_TARGETS,
  NUMBERED_DESKTOP_TARGET_LIMITS,
  decodeNumberedDesktopTargets,
  sameNumberedDesktopTargets,
} from "../src/numbered-desktop-targets";

function decoded(value: unknown) {
  const result = decodeNumberedDesktopTargets(value);

  if (!result) {
    throw new Error("numbered desktop target fixture is invalid");
  }

  return result;
}

describe("numbered desktop targets", () => {
  it("maps blank input to the immutable empty value", () => {
    expect(decodeNumberedDesktopTargets("")).toBe(
      EMPTY_NUMBERED_DESKTOP_TARGETS,
    );
    expect(decodeNumberedDesktopTargets(" \t\n ")).toBe(
      EMPTY_NUMBERED_DESKTOP_TARGETS,
    );
    expect(EMPTY_NUMBERED_DESKTOP_TARGETS.canonicalEntries).toEqual([]);
    expect(EMPTY_NUMBERED_DESKTOP_TARGETS.desktopNameFor(1)).toBeUndefined();
    expect(Object.isFrozen(EMPTY_NUMBERED_DESKTOP_TARGETS)).toBe(true);
    expect(
      Object.isFrozen(EMPTY_NUMBERED_DESKTOP_TARGETS.canonicalEntries),
    ).toBe(true);
  });

  it("canonicalizes slot order and surrounding whitespace", () => {
    const targets = decoded(
      " 9 = Archive \n\n 1=Web Browsing\n 4 = Development ",
    );

    expect(targets.canonicalEntries).toEqual([
      "1=Web Browsing",
      "4=Development",
      "9=Archive",
    ]);
    expect(targets.desktopNameFor(1)).toBe("Web Browsing");
    expect(targets.desktopNameFor(4)).toBe("Development");
    expect(targets.desktopNameFor(9)).toBe("Archive");
    expect(targets.desktopNameFor(2)).toBeUndefined();
    expect(targets.desktopNameFor(0)).toBeUndefined();
    expect(targets.desktopNameFor(10)).toBeUndefined();
    expect(Object.isFrozen(targets)).toBe(true);
    expect(Object.isFrozen(targets.canonicalEntries)).toBe(true);
  });

  it("keeps configured desktop names exact and case-sensitive", () => {
    const targets = decoded("1=Work\n2=work\n3=Work Review");

    expect(targets.desktopNameFor(1)).toBe("Work");
    expect(targets.desktopNameFor(2)).toBe("work");
    expect(targets.desktopNameFor(3)).toBe("Work Review");
  });

  it("accepts every slot exactly once", () => {
    const document = Array.from(
      { length: NUMBERED_DESKTOP_TARGET_LIMITS.entries },
      (_, index) => `${String(index + 1)}=Desktop ${String(index + 1)}`,
    ).join("\n");

    expect(decoded(document).canonicalEntries).toHaveLength(9);
  });

  it.each([
    null,
    undefined,
    1,
    {},
    [],
    "missing-separator",
    "=Work",
    "1=",
    "0=Work",
    "10=Work",
    "01=Work",
    "+1=Work",
    "1.0=Work",
    "1=Work=Review",
    "1==Work",
  ])("rejects malformed input %j", (value) => {
    expect(decodeNumberedDesktopTargets(value)).toBeNull();
  });

  it("rejects duplicate slots and exact configured names", () => {
    expect(decodeNumberedDesktopTargets("1=Work\n 1 = Review")).toBeNull();
    expect(decodeNumberedDesktopTargets("1=Work\n2= Work ")).toBeNull();
    expect(decodeNumberedDesktopTargets("1=Work\n2=work")).not.toBeNull();
  });

  it.each([
    "1=bad\u0000name",
    "1=bad\u0009name",
    "1=bad\u007fname",
    "1=bad\u0085name",
    "1=bad\ud800name",
    "1=bad\udc00name",
  ])("rejects controls and malformed Unicode: %j", (entry) => {
    expect(decodeNumberedDesktopTargets(entry)).toBeNull();
  });

  it("enforces desktop-name UTF-8, raw-line, and document bounds", () => {
    const maximumAsciiName = "a".repeat(
      NUMBERED_DESKTOP_TARGET_LIMITS.desktopNameBytes,
    );
    const maximumUtf8Name = "é".repeat(127);
    const maximumRaw = `1=${maximumAsciiName}${" ".repeat(
      NUMBERED_DESKTOP_TARGET_LIMITS.rawEntryCharacters -
        maximumAsciiName.length -
        2,
    )}`;

    expect(maximumRaw).toHaveLength(
      NUMBERED_DESKTOP_TARGET_LIMITS.rawEntryCharacters,
    );
    expect(decodeNumberedDesktopTargets(maximumRaw)).not.toBeNull();
    expect(decodeNumberedDesktopTargets(`${maximumRaw} `)).toBeNull();
    expect(decodeNumberedDesktopTargets(`1=${maximumAsciiName}a`)).toBeNull();
    expect(decodeNumberedDesktopTargets(`1=${maximumUtf8Name}`)).not.toBeNull();
    expect(decodeNumberedDesktopTargets(`1=${maximumUtf8Name}é`)).toBeNull();
    expect(
      decodeNumberedDesktopTargets(
        " ".repeat(NUMBERED_DESKTOP_TARGET_LIMITS.documentCharacters + 1),
      ),
    ).toBeNull();
  });

  it("compares canonical mappings", () => {
    const first = decoded("9=Archive\n1=Work");
    const equivalent = decoded(" 1 = Work \n 9 = Archive ");
    const changedName = decoded("1=Review\n9=Archive");
    const changedSlot = decoded("1=Work\n8=Archive");

    expect(sameNumberedDesktopTargets(first, first)).toBe(true);
    expect(sameNumberedDesktopTargets(first, equivalent)).toBe(true);
    expect(sameNumberedDesktopTargets(first, changedName)).toBe(false);
    expect(sameNumberedDesktopTargets(first, changedSlot)).toBe(false);
  });
});
