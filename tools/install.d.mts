export interface InstallLifecycleDependencies {
  readonly buildProject?: () => Promise<void>;
  readonly buildShortcutTool?: () => Promise<void>;
  readonly log?: (message: string) => void;
  readonly paths?: {
    readonly packageDirectory: string;
    readonly shortcutTool: string;
  };
  readonly runCommand?: (
    command: string,
    arguments_: readonly string[],
    options?: { readonly capture?: boolean },
  ) => string;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly unloadPollAttempts?: number;
}

export function parseScriptLoadedReply(output: string): boolean;

export function runInstallLifecycle(
  action: string | undefined,
  dependencies?: InstallLifecycleDependencies,
): Promise<void>;
