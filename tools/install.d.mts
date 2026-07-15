export interface InstallLifecycleDependencies {
  readonly bootstrapRestartRequired?: (
    packageDirectory: string,
    installedPackageDirectory: string,
  ) => boolean;
  readonly buildProject?: () => Promise<void>;
  readonly buildShortcutTool?: () => Promise<void>;
  readonly log?: (message: string) => void;
  readonly paths?: {
    readonly installedPackageDirectory?: string;
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

export function bootstrapRestartRequired(
  packageDirectory: string,
  installedPackageDirectory: string,
  readFile?: (path: string) => Buffer,
): boolean;

export function parseScriptLoadedReply(output: string): boolean;

export function runInstallLifecycle(
  action: string | undefined,
  dependencies?: InstallLifecycleDependencies,
): Promise<void>;
