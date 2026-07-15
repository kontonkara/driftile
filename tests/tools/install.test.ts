import { describe, expect, it } from "vitest";
import {
  bootstrapRestartRequired,
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
        value: expectedInstructions("upgrade", false),
      },
    ]);
  });

  it("requests a restart when upgrading an incompatible bootstrap", async () => {
    const harness = createHarness([false], 100, true);

    await runInstallLifecycle("upgrade", harness.dependencies);

    expect(harness.events[harness.events.length - 1]).toEqual({
      type: "log",
      value: expectedInstructions("upgrade", true),
    });
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
      value: expectedInstructions("install"),
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

  it("compares installed and next bootstrap bytes conservatively", () => {
    const files = new Map([
      ["/next/contents/ui/main.qml", Buffer.from("stable")],
      ["/matching/contents/ui/main.qml", Buffer.from("stable")],
      ["/legacy/contents/ui/main.qml", Buffer.from("legacy")],
    ]);
    const readFile = (path: string) => {
      const value = files.get(path);

      if (!value) {
        throw new Error("missing bootstrap");
      }

      return value;
    };

    expect(bootstrapRestartRequired("/next", "/matching", readFile)).toBe(
      false,
    );
    expect(bootstrapRestartRequired("/next", "/legacy", readFile)).toBe(true);
    expect(bootstrapRestartRequired("/next", "/missing", readFile)).toBe(true);
  });
});

function createHarness(
  scriptStates: readonly boolean[],
  pollAttempts = 100,
  restartRequired = false,
) {
  const events: Event[] = [];
  let failBuild = false;
  let failRelease = false;
  let stateIndex = 0;

  return {
    dependencies: {
      bootstrapRestartRequired: () => restartRequired,
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

function expectedInstructions(
  action: "install" | "upgrade",
  restartRequired = false,
): string {
  const lines = ["Driftile is installed and disabled."];

  if (restartRequired) {
    lines.push("Restart the Plasma session once before enabling this upgrade.");
  }

  lines.push(
    restartRequired
      ? "Then enable it and claim its shortcut profile with:"
      : "Enable it and claim its shortcut profile with:",
    `  kwriteconfig6 --file kwinrc --group Plugins --key ${pluginId}Enabled --type bool true`,
    "  busctl --user call org.kde.KWin /KWin org.kde.KWin reconfigure",
    "  busctl --user call org.kde.KWin /Scripting org.kde.kwin.Scripting start",
    "  npm run shortcuts:claim",
  );

  return lines.join("\n");
}
