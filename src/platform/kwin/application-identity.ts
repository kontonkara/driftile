import type { KWinWindow } from "./api";

type KWinApplicationIdentitySource = Pick<
  KWinWindow,
  "desktopFileName" | "resourceClass"
>;

type KWinApplicationRoleIdentitySource = Pick<KWinWindow, "windowRole">;

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

export function applicationRoleRuleIdentity(
  source: KWinApplicationRoleIdentitySource,
  applicationId: string,
): string | null {
  if (
    typeof applicationId !== "string" ||
    applicationId.length === 0 ||
    applicationId.includes("|")
  ) {
    return null;
  }

  let windowRole: unknown;

  try {
    windowRole = source.windowRole;
  } catch {
    return null;
  }

  if (
    typeof windowRole !== "string" ||
    windowRole.length === 0 ||
    windowRole.includes("|")
  ) {
    return null;
  }

  return `${applicationId}|${windowRole}`;
}
