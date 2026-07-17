export interface OverviewDesktopLabelPlan {
  readonly label: string;
}

// Desktop cards elide this text; the bound keeps every QML snapshot compact.
const MAXIMUM_LABEL_CODE_POINTS = 64;
const MAXIMUM_SCANNED_CODE_POINTS = MAXIMUM_LABEL_CODE_POINTS * 4;
const WHITE_SPACE_PATTERN = /\s/u;

export function planOverviewDesktopLabel(
  desktop: unknown,
): OverviewDesktopLabelPlan | null {
  try {
    if (!isRecord(desktop)) {
      return null;
    }

    const name = desktop["name"];

    if (typeof name !== "string") {
      return null;
    }

    const label = normalizeName(name);
    return label.length > 0 ? Object.freeze({ label }) : null;
  } catch {
    return null;
  }
}

function normalizeName(value: string): string {
  const characters: string[] = [];
  let offset = 0;
  let scanned = 0;
  let separatorPending = false;

  while (
    offset < value.length &&
    scanned < MAXIMUM_SCANNED_CODE_POINTS &&
    characters.length < MAXIMUM_LABEL_CODE_POINTS
  ) {
    const codePoint = value.codePointAt(offset);

    if (codePoint === undefined) {
      break;
    }

    const character = String.fromCodePoint(codePoint);
    offset += codePoint > 0xffff ? 2 : 1;
    scanned += 1;

    if (
      isControlCodePoint(codePoint) ||
      isLineSeparatorCodePoint(codePoint) ||
      WHITE_SPACE_PATTERN.test(character)
    ) {
      separatorPending = characters.length > 0;
      continue;
    }

    if (separatorPending) {
      if (characters.length + 2 > MAXIMUM_LABEL_CODE_POINTS) {
        break;
      }

      characters.push(" ");
      separatorPending = false;
    }

    characters.push(character);
  }

  return characters.join("");
}

function isControlCodePoint(codePoint: number): boolean {
  return (
    codePoint <= 0x1f ||
    codePoint === 0x7f ||
    (codePoint >= 0x80 && codePoint <= 0x9f)
  );
}

function isLineSeparatorCodePoint(codePoint: number): boolean {
  return codePoint === 0x2028 || codePoint === 0x2029;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
