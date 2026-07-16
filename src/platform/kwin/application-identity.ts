import type { KWinWindow } from "./api";

type KWinApplicationIdentitySource = Pick<
  KWinWindow,
  "desktopFileName" | "resourceClass"
>;

export function applicationRuleIdentity(
  source: KWinApplicationIdentitySource,
): string | null {
  let desktopFileName: unknown;

  try {
    desktopFileName = source.desktopFileName;
  } catch {
    desktopFileName = undefined;
  }

  if (typeof desktopFileName === "string" && desktopFileName.length > 0) {
    return desktopFileName;
  }

  let resourceClass: unknown;

  try {
    resourceClass = source.resourceClass;
  } catch {
    return null;
  }

  return typeof resourceClass === "string" && resourceClass.length > 0
    ? resourceClass
    : null;
}
