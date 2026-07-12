import { describe, expect, it } from "vitest";
import {
  parseScriptLoadedReply,
  runInstallLifecycle,
} from "../../tools/install.mjs";

interface CommandEvent {
  readonly arguments: readonly string[];
  readonly capture: boolean;
  readonly command: string;
  readonly type: "command";
}

interface NamedEvent {
  readonly type: "build-package" | "build-shortcuts" | "log" | "sleep";
  readonly value?: number | string;
}

type Event = CommandEvent | NamedEvent;

const packageDirectory = "/test/dist/kwin-script";
const shortcutTool = "/test/dist/bin/driftile-shortcuts.mjs";
const pluginId = "io.github.kontonkara.driftile";

describe("development package lifecycle", () => {
  it("rejects unknown actions before building or touching the session", async () => {
    const harness = createHarness([false]);

    await expect(
      runInstallLifecycle("unknown", harness.dependencies),
    ).rejects.toThrow("Expected one of: install, upgrade, remove");
    expect(harness.events).toEqual([]);
  });

  it("releases shortcuts and confirms unload before upgrading", async () => {
    const harness = createHarness([true, false]);

    await runInstallLifecycle("upgrade", harness.dependencies);

    expect(harness.events).toEqual([
      { type: "build-package" },
      command(process.execPath, [shortcutTool, "release"]),
      disableCommand(),
      startCommand(),
      stateCommand(),
      { type: "sleep", value: 50 },
      stateCommand(),
      command("kpackagetool6", [
        "--type=KWin/Script",
        "--upgrade",
        packageDirectory,
      ]),
      {
        type: "log",
        value: expectedInstructions(),
      },
    ]);
  });

  it("installs the package disabled and prints exact activation steps", async () => {
    const harness = createHarness([false]);

    await runInstallLifecycle("install", harness.dependencies);

    expect(harness.events).toContainEqual(
      command("kpackagetool6", [
        "--type=KWin/Script",
        "--install",
        packageDirectory,
      ]),
    );
    expect(harness.events[harness.events.length - 1]).toEqual({
      type: "log",
      value: expectedInstructions(),
    });
  });

  it("unloads before removing without rebuilding the package", async () => {
    const harness = createHarness([false]);

    await runInstallLifecycle("remove", harness.dependencies);

    expect(harness.events).toEqual([
      { type: "build-shortcuts" },
      command(process.execPath, [shortcutTool, "release"]),
      disableCommand(),
      startCommand(),
      stateCommand(),
      command("kpackagetool6", ["--type=KWin/Script", "--remove", pluginId]),
    ]);
  });

  it("does not mutate the package when unload cannot be confirmed", async () => {
    const harness = createHarness([true, true], 2);

    await expect(
      runInstallLifecycle("upgrade", harness.dependencies),
    ).rejects.toThrow(
      "KWin did not unload Driftile; the installed package was not changed",
    );

    expect(harness.events[0]).toEqual({ type: "build-package" });
    expect(
      harness.events.some(
        (event) =>
          event.type === "command" && event.command === "kpackagetool6",
      ),
    ).toBe(false);
    expect(harness.events[harness.events.length - 1]).toEqual(stateCommand());
  });

  it("does not touch the session when the package build fails", async () => {
    const harness = createHarness([false]);
    harness.failPackageBuild();

    await expect(
      runInstallLifecycle("upgrade", harness.dependencies),
    ).rejects.toThrow("injected package build failure");

    expect(harness.events).toEqual([{ type: "build-package" }]);
  });

  it("does not disable or mutate the package when shortcut release fails", async () => {
    const harness = createHarness([false]);
    harness.failShortcutRelease();

    await expect(
      runInstallLifecycle("remove", harness.dependencies),
    ).rejects.toThrow("injected shortcut release failure");

    expect(harness.events).toEqual([
      { type: "build-shortcuts" },
      command(process.execPath, [shortcutTool, "release"]),
    ]);
  });

  it("rejects malformed KWin script state replies", () => {
    expect(() =>
      parseScriptLoadedReply('{"data":["false"],"type":"b"}'),
    ).toThrow("KWin returned an invalid script state");
  });
});

function createHarness(scriptStates: readonly boolean[], pollAttempts = 100) {
  const events: Event[] = [];
  let failBuild = false;
  let failRelease = false;
  let stateIndex = 0;

  return {
    dependencies: {
      buildProject: () => {
        events.push({ type: "build-package" });

        if (failBuild) {
          return Promise.reject(new Error("injected package build failure"));
        }

        return Promise.resolve();
      },
      buildShortcutTool: () => {
        events.push({ type: "build-shortcuts" });
        return Promise.resolve();
      },
      log: (message: string) => {
        events.push({ type: "log", value: message });
      },
      paths: { packageDirectory, shortcutTool },
      runCommand: (
        executable: string,
        arguments_: readonly string[],
        options: { readonly capture?: boolean } = {},
      ) => {
        events.push(command(executable, arguments_, options.capture === true));

        if (executable === process.execPath && failRelease) {
          throw new Error("injected shortcut release failure");
        }

        if (arguments_.includes("isScriptLoaded")) {
          const state =
            scriptStates[stateIndex] ?? scriptStates[scriptStates.length - 1];
          stateIndex += 1;
          return JSON.stringify({ data: [state], type: "b" });
        }

        return "";
      },
      sleep: (milliseconds: number) => {
        events.push({ type: "sleep", value: milliseconds });
        return Promise.resolve();
      },
      unloadPollAttempts: pollAttempts,
    },
    events,
    failPackageBuild() {
      failBuild = true;
    },
    failShortcutRelease() {
      failRelease = true;
    },
  };
}

function command(
  executable: string,
  arguments_: readonly string[],
  capture = false,
): CommandEvent {
  return {
    arguments: arguments_,
    capture,
    command: executable,
    type: "command",
  };
}

function disableCommand(): CommandEvent {
  return command("kwriteconfig6", [
    "--file",
    "kwinrc",
    "--group",
    "Plugins",
    "--key",
    `${pluginId}Enabled`,
    "--type",
    "bool",
    "false",
  ]);
}

function startCommand(): CommandEvent {
  return command("busctl", [
    "--user",
    "call",
    "org.kde.KWin",
    "/Scripting",
    "org.kde.kwin.Scripting",
    "start",
  ]);
}

function stateCommand(): CommandEvent {
  return command(
    "busctl",
    [
      "--user",
      "--json=short",
      "call",
      "org.kde.KWin",
      "/Scripting",
      "org.kde.kwin.Scripting",
      "isScriptLoaded",
      "s",
      pluginId,
    ],
    true,
  );
}

function expectedInstructions(): string {
  return [
    "Driftile is installed and disabled.",
    "Enable it and claim its shortcut profile with:",
    `  kwriteconfig6 --file kwinrc --group Plugins --key ${pluginId}Enabled --type bool true`,
    "  busctl --user call org.kde.KWin /Scripting org.kde.kwin.Scripting start",
    "  npm run shortcuts:claim",
  ].join("\n");
}
