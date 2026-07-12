import { describe, expect, it } from "vitest";
import { parseShortcutCommandOptions } from "../src/shortcut-command-options";

describe("shortcut command options", () => {
  it.each(["check", "claim", "release"] as const)(
    "parses the %s command without options",
    (command) => {
      expect(parseShortcutCommandOptions([command])).toEqual({
        command,
        force: false,
      });
    },
  );

  it("parses a custom claim independently of option order", () => {
    expect(
      parseShortcutCommandOptions([
        "claim",
        "--profile",
        "/tmp/shortcuts.json",
        "--force",
      ]),
    ).toEqual({
      command: "claim",
      force: true,
      profilePath: "/tmp/shortcuts.json",
    });
    expect(
      parseShortcutCommandOptions([
        "claim",
        "--force",
        "--profile",
        "/tmp/shortcuts.json",
      ]),
    ).toEqual({
      command: "claim",
      force: true,
      profilePath: "/tmp/shortcuts.json",
    });
  });

  it("parses a custom profile check", () => {
    expect(
      parseShortcutCommandOptions(["check", "--profile", "./shortcuts.json"]),
    ).toEqual({
      command: "check",
      force: false,
      profilePath: "./shortcuts.json",
    });
  });

  it.each([
    [[], "Expected one of"],
    [["unknown"], "Expected one of"],
    [["claim", "profile.json"], "Unknown shortcut option"],
    [["claim", "--unknown"], "Unknown shortcut option"],
    [["claim", "--force", "--force"], "only once"],
    [["claim", "--profile"], "requires a file path"],
    [["claim", "--profile", "--force"], "requires a file path"],
    [["claim", "--profile", "one", "--profile", "two"], "only once"],
    [["check", "--force"], "not valid with check"],
    [["release", "--profile", "shortcuts.json"], "not valid with release"],
  ])("rejects invalid arguments: %j", (arguments_, message) => {
    expect(() => parseShortcutCommandOptions(arguments_)).toThrow(message);
  });
});
