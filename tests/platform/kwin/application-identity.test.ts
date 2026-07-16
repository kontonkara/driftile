import { describe, expect, it, vi } from "vitest";

import { applicationRuleIdentity } from "../../../src/platform/kwin/application-identity";
import type { KWinWindow } from "../../../src/platform/kwin/api";

type IdentitySource = Pick<KWinWindow, "desktopFileName" | "resourceClass">;

describe("applicationRuleIdentity", () => {
  it("returns an exact desktop file name without reading the fallback", () => {
    const readResourceClass = vi.fn(() => "fallback-class");
    const source = {
      desktopFileName: " org.example.Editor ",
      get resourceClass(): string {
        return readResourceClass();
      },
    } satisfies IdentitySource;

    expect(applicationRuleIdentity(source)).toBe(" org.example.Editor ");
    expect(readResourceClass).not.toHaveBeenCalled();
  });

  it("falls back when the desktop file name is unavailable", () => {
    expect(applicationRuleIdentity({ resourceClass: "example-editor" })).toBe(
      "example-editor",
    );
    expect(
      applicationRuleIdentity({
        desktopFileName: "",
        resourceClass: "empty-desktop-file-name",
      }),
    ).toBe("empty-desktop-file-name");
    expect(
      applicationRuleIdentity({
        get desktopFileName(): string {
          throw new Error("unreadable desktop file name");
        },
        resourceClass: "unreadable-desktop-file-name",
      }),
    ).toBe("unreadable-desktop-file-name");
  });

  it("rejects empty, non-string, and unreadable identities", () => {
    expect(applicationRuleIdentity({})).toBeNull();
    expect(
      applicationRuleIdentity({
        desktopFileName: 1,
        resourceClass: false,
      } as unknown as IdentitySource),
    ).toBeNull();
    expect(
      applicationRuleIdentity({
        desktopFileName: "",
        get resourceClass(): string {
          throw new Error("unreadable resource class");
        },
      }),
    ).toBeNull();
  });
});
