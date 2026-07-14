import {
  APPLICATION_EXCLUSION_LIMITS,
  decodeApplicationExclusions,
} from "./application-exclusions";

export const APPLICATION_FOCUS_CENTERING_LIMITS = APPLICATION_EXCLUSION_LIMITS;

export interface ApplicationFocusCentering {
  readonly canonicalEntries: readonly string[];
  centersOnFocus(desktopFileName: string): boolean;
}

export const EMPTY_APPLICATION_FOCUS_CENTERING =
  decodeApplicationFocusCentering("") as ApplicationFocusCentering;

export function decodeApplicationFocusCentering(
  value: unknown,
): ApplicationFocusCentering | null {
  const applications = decodeApplicationExclusions(value);

  if (!applications) {
    return null;
  }

  return Object.freeze({
    canonicalEntries: applications.canonicalEntries,
    centersOnFocus: (desktopFileName: string): boolean =>
      applications.excludes(desktopFileName),
  });
}

export function sameApplicationFocusCentering(
  left: ApplicationFocusCentering,
  right: ApplicationFocusCentering,
): boolean {
  if (left === right) {
    return true;
  }

  const leftEntries = left.canonicalEntries;
  const rightEntries = right.canonicalEntries;

  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every((entry, index) => entry === rightEntries[index])
  );
}
