export type ShortcutCommand = "check" | "claim" | "release";

export interface ShortcutCommandOptions {
  readonly command: ShortcutCommand;
  readonly force: boolean;
  readonly profilePath?: string;
}

const commands = new Set<ShortcutCommand>(["check", "claim", "release"]);

export function parseShortcutCommandOptions(
  arguments_: readonly string[],
): ShortcutCommandOptions {
  const command = arguments_[0];

  if (!isCommand(command)) {
    throw new Error("Expected one of: check, claim, release");
  }

  let force = false;
  let profilePath: string | undefined;

  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    switch (argument) {
      case "--force":
        if (force) {
          throw new Error("--force can be specified only once");
        }

        force = true;
        break;
      case "--profile": {
        if (profilePath !== undefined) {
          throw new Error("--profile can be specified only once");
        }

        const path = arguments_[index + 1];

        if (!path || path.startsWith("--")) {
          throw new Error("--profile requires a file path");
        }

        profilePath = path;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown shortcut option: ${String(argument)}`);
    }
  }

  if (command === "check" && force) {
    throw new Error("--force is not valid with check");
  }

  if (command === "release" && profilePath !== undefined) {
    throw new Error("--profile is not valid with release");
  }

  return {
    command,
    force,
    ...(profilePath === undefined ? {} : { profilePath }),
  };
}

function isCommand(value: string | undefined): value is ShortcutCommand {
  return value !== undefined && commands.has(value as ShortcutCommand);
}
