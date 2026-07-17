export interface OverviewWindowLabelPlan {
  readonly primary: string;
  readonly secondary: string | null;
}

interface OverviewWindowLabelFields {
  readonly caption: string | undefined;
  readonly desktopFileName: string | undefined;
  readonly resourceClass: string | undefined;
  readonly resourceName: string | undefined;
}

// QML elides footer text; this bound keeps every label snapshot compact.
const MAXIMUM_LABEL_CODE_POINTS = 96;
const DESKTOP_FILE_SUFFIX = ".desktop";
const MAXIMUM_NORMALIZED_DESKTOP_FILE_CODE_POINTS =
  MAXIMUM_LABEL_CODE_POINTS + DESKTOP_FILE_SUFFIX.length;
const MAXIMUM_SCANNED_CODE_POINTS =
  MAXIMUM_NORMALIZED_DESKTOP_FILE_CODE_POINTS * 4;
const WHITE_SPACE_PATTERN = /\s/u;

export function planOverviewWindowLabel(
  fields: unknown,
  showApplicationIdentity: unknown = true,
): OverviewWindowLabelPlan | null {
  try {
    if (typeof showApplicationIdentity !== "boolean") {
      return null;
    }

    const snapshot = snapshotFields(fields, showApplicationIdentity);

    if (snapshot === null) {
      return null;
    }

    const caption = normalizeText(snapshot.caption, MAXIMUM_LABEL_CODE_POINTS);

    if (!showApplicationIdentity) {
      return caption.length > 0 ? { primary: caption, secondary: null } : null;
    }

    const applicationIdentity = firstApplicationIdentity(snapshot);
    const primary = caption.length > 0 ? caption : applicationIdentity;

    if (primary.length === 0) {
      return null;
    }

    return {
      primary,
      secondary:
        caption.length > 0 &&
        applicationIdentity.length > 0 &&
        caption.toLowerCase() !== applicationIdentity.toLowerCase()
          ? applicationIdentity
          : null,
    };
  } catch {
    return null;
  }
}

function snapshotFields(
  value: unknown,
  includeApplicationIdentity: boolean,
): OverviewWindowLabelFields | null {
  if (!isRecord(value)) {
    return null;
  }

  const caption = value["caption"];

  if (!isOptionalString(caption)) {
    return null;
  }

  if (!includeApplicationIdentity) {
    return {
      caption,
      desktopFileName: undefined,
      resourceClass: undefined,
      resourceName: undefined,
    };
  }

  const desktopFileName = value["desktopFileName"];
  const resourceClass = value["resourceClass"];
  const resourceName = value["resourceName"];

  if (
    !isOptionalString(desktopFileName) ||
    !isOptionalString(resourceClass) ||
    !isOptionalString(resourceName)
  ) {
    return null;
  }

  return { caption, desktopFileName, resourceClass, resourceName };
}

function firstApplicationIdentity(fields: OverviewWindowLabelFields): string {
  const desktopFileName = normalizeText(
    fields.desktopFileName,
    MAXIMUM_NORMALIZED_DESKTOP_FILE_CODE_POINTS,
  );
  const displayedDesktopFileName = truncateCodePoints(
    stripDesktopFileSuffix(desktopFileName),
    MAXIMUM_LABEL_CODE_POINTS,
  );

  if (displayedDesktopFileName.length > 0) {
    return displayedDesktopFileName;
  }

  for (const value of [fields.resourceClass, fields.resourceName]) {
    const identity = normalizeText(value, MAXIMUM_LABEL_CODE_POINTS);

    if (identity.length > 0) {
      return identity;
    }
  }

  return "";
}

function normalizeText(value: string | undefined, maximum: number): string {
  if (value === undefined) {
    return "";
  }

  const characters: string[] = [];
  let offset = 0;
  let scanned = 0;
  let separatorPending = false;

  while (
    offset < value.length &&
    scanned < MAXIMUM_SCANNED_CODE_POINTS &&
    characters.length < maximum
  ) {
    const codePoint = value.codePointAt(offset);

    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    offset += codePoint > 0xffff ? 2 : 1;
    scanned += 1;

    if (isControlCodePoint(codePoint) || WHITE_SPACE_PATTERN.test(character)) {
      separatorPending = characters.length > 0;
      continue;
    }

    if (separatorPending) {
      if (characters.length + 2 > maximum) {
        break;
      }

      characters.push(" ");
      separatorPending = false;
    }

    characters.push(character);
  }

  return characters.join("");
}

function stripDesktopFileSuffix(value: string): string {
  return value.toLowerCase().endsWith(DESKTOP_FILE_SUFFIX)
    ? value.slice(0, -DESKTOP_FILE_SUFFIX.length).trimEnd()
    : value;
}

function truncateCodePoints(value: string, maximum: number): string {
  let codePoints = 0;
  let offset = 0;

  while (offset < value.length && codePoints < maximum) {
    const codePoint = value.codePointAt(offset);

    if (codePoint === undefined) {
      break;
    }

    offset += codePoint > 0xffff ? 2 : 1;
    codePoints += 1;
  }

  return value.slice(0, offset);
}

function isControlCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    codePoint === 0x7f ||
    (codePoint >= 0x80 && codePoint <= 0x9f)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
