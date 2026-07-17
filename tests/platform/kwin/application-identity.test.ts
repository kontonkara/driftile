import { describe, expect, it, vi } from "vitest";

import {
  applicationRoleRuleIdentity,
  applicationRuleIdentity,
} from "../../../src/platform/kwin/application-identity";
import type { KWinWindow } from "../../../src/platform/kwin/api";

type IdentitySource = Pick<KWinWindow, "desktopFileName" | "resourceClass">;
type RoleIdentitySource = Pick<KWinWindow, "windowRole">;

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

describe("applicationRoleRuleIdentity", () => {
  it("rejects the empty role exposed by Wayland windows", () => {
    expect(
      applicationRoleRuleIdentity({ windowRole: "" }, "org.example.Editor"),
    ).toBeNull();
  });

  it("combines an X11 application identity with its exact window role", () => {
    expect(
      applicationRoleRuleIdentity(
        { windowRole: "editor-main" },
        "example-editor",
      ),
    ).toBe("example-editor|editor-main");
  });

  it("preserves case in both identity components", () => {
    expect(
      applicationRoleRuleIdentity(
        { windowRole: "MainWindow" },
        "Example-Editor",
      ),
    ).toBe("Example-Editor|MainWindow");
    expect(
      applicationRoleRuleIdentity(
        { windowRole: "mainwindow" },
        "example-editor",
      ),
    ).toBe("example-editor|mainwindow");
  });

  it("fails closed when the window role getter throws", () => {
    expect(
      applicationRoleRuleIdentity(
        {
          get windowRole(): string {
            throw new Error("unreadable window role");
          },
        },
        "example-editor",
      ),
    ).toBeNull();
  });

  it("rejects missing, non-string, and malformed components", () => {
    expect(applicationRoleRuleIdentity({}, "example-editor")).toBeNull();
    expect(
      applicationRoleRuleIdentity(
        { windowRole: 1 } as unknown as RoleIdentitySource,
        "example-editor",
      ),
    ).toBeNull();
    expect(applicationRoleRuleIdentity({ windowRole: "main" }, "")).toBeNull();
    expect(
      applicationRoleRuleIdentity(
        { windowRole: "main" },
        1 as unknown as string,
      ),
    ).toBeNull();
  });

  it("rejects pipe characters in either identity component", () => {
    expect(
      applicationRoleRuleIdentity({ windowRole: "main" }, "example|editor"),
    ).toBeNull();
    expect(
      applicationRoleRuleIdentity(
        { windowRole: "main|dialog" },
        "example-editor",
      ),
    ).toBeNull();
  });
});
