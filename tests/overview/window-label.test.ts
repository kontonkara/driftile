import { describe, expect, it } from "vitest";
import { planOverviewWindowLabel } from "../../src/overview/runtime";

describe("planOverviewWindowLabel", () => {
  it("uses the caption and highest-priority application identity", () => {
    expect(
      planOverviewWindowLabel({
        caption: "Settings — Plasma",
        desktopFileName: "org.kde.systemsettings.desktop",
        resourceClass: "systemsettings",
        resourceName: "systemsettings",
      }),
    ).toEqual({
      primary: "Settings — Plasma",
      secondary: "org.kde.systemsettings",
    });
  });

  it("falls back through application identities", () => {
    expect(
      planOverviewWindowLabel({
        caption: "",
        desktopFileName: ".desktop",
        resourceClass: "  Konsole  ",
        resourceName: "konsole",
      }),
    ).toEqual({ primary: "Konsole", secondary: null });
    expect(
      planOverviewWindowLabel({
        desktopFileName: "",
        resourceClass: "\t\n",
        resourceName: "firefox",
      }),
    ).toEqual({ primary: "firefox", secondary: null });
  });

  it("sanitizes controls and collapses whitespace", () => {
    expect(
      planOverviewWindowLabel({
        caption: "  Build\u0000\t status\u007f\u0085 ready  ",
        desktopFileName: " org.kde.\nkonsole.DESKTOP ",
      }),
    ).toEqual({
      primary: "Build status ready",
      secondary: "org.kde. konsole",
    });
  });

  it("caps labels by Unicode code points without splitting surrogates", () => {
    const caption = `${"a".repeat(95)}😀ignored`;
    const identity = `${"😀".repeat(96)}.desktop`;
    const result = planOverviewWindowLabel({
      caption,
      desktopFileName: identity,
    });

    expect(result?.primary).toBe(`${"a".repeat(95)}😀`);
    expect(Array.from(result?.primary ?? "")).toHaveLength(96);
    expect(result?.secondary).toBe("😀".repeat(96));
    expect(Array.from(result?.secondary ?? "")).toHaveLength(96);
  });

  it("omits case-insensitive duplicate application identities", () => {
    expect(
      planOverviewWindowLabel({
        caption: "Konsole",
        desktopFileName: "KONSOLE.desktop",
        resourceClass: "ignored",
      }),
    ).toEqual({ primary: "Konsole", secondary: null });
  });

  it.each([
    null,
    [],
    {},
    { caption: 42, resourceName: "valid" },
    { caption: "valid", desktopFileName: null },
    { caption: "\u0000\u007f\u009f", resourceClass: "\t" },
  ])("fails closed for malformed or empty fields (%o)", (fields) => {
    expect(planOverviewWindowLabel(fields)).toBeNull();
  });

  it("fails closed for hostile field accessors", () => {
    const hostile = Object.defineProperty(
      { caption: "Visible", resourceClass: "Konsole" },
      "desktopFileName",
      {
        get(): never {
          throw new Error("unavailable");
        },
      },
    );

    expect(planOverviewWindowLabel(hostile)).toBeNull();
  });
});
