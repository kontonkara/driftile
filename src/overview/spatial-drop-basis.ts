import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";
import type { OverviewLayoutModel } from "./layout-view";
import type {
  SpatialDropSource,
  SpatialDropTarget,
} from "./spatial-drop-command";

export interface OverviewSpatialDropContextKey {
  readonly activityId: string;
  readonly desktopId: string;
  readonly outputId: string;
}

export interface OverviewSpatialDropContextGeometry {
  readonly activityId: string;
  readonly desktopId: string;
  readonly fingerprint: string;
  readonly outputId: string;
}

export interface OverviewSpatialDropBasisInput {
  readonly alwaysCenterSingleColumn: boolean;
  readonly contextGeometries: readonly OverviewSpatialDropContextGeometry[];
  readonly gap: number;
  readonly model: OverviewLayoutModel;
  readonly source: SpatialDropSource;
  readonly target: SpatialDropTarget;
}

type CanonicalWidth = readonly [kind: "fixed" | "proportion", value: number];
type CanonicalHeight =
  | readonly [kind: "auto", weight: number]
  | readonly [kind: "fixed", clientHeight: number]
  | readonly [kind: "preset", index: number];
type CanonicalHeightBounds = readonly [
  decorationHeight: number,
  minimumClientHeight: number,
  maximumClientHeight: number | "positive-infinity",
];
type CanonicalMember = readonly [
  windowId: string,
  height: CanonicalHeight | null,
  heightBounds: CanonicalHeightBounds | null,
];
type CanonicalColumn = readonly [
  presentation: "stacked" | "tabbed",
  selectedMemberIndex: number,
  width: CanonicalWidth,
  fullWidthRestore: CanonicalWidth | null,
  members: readonly CanonicalMember[],
];
type CanonicalContext = readonly [
  activityId: string,
  outputId: string,
  desktopId: string,
  activeColumnIndex: number | null,
  viewportOffset: number,
  columns: readonly CanonicalColumn[],
];
type CanonicalGeometry = readonly [
  activityId: string,
  outputId: string,
  desktopId: string,
  fingerprint: string,
];
type CanonicalSource = readonly [
  activityId: string,
  outputId: string,
  desktopId: string,
  scope: "column" | "window",
  windowId: string,
];
type CanonicalTarget =
  | readonly [
      kind: "empty-row",
      activityId: string,
      outputId: string,
      desktopId: string,
    ]
  | readonly [
      kind: "column-boundary" | "stack-insertion",
      activityId: string,
      outputId: string,
      desktopId: string,
      position: "after" | "before",
      targetWindowId: string,
    ]
  | readonly [
      kind: "workspace-gap",
      activityId: string,
      outputId: string,
      position: "after" | "before",
      anchorDesktopId: string,
      adjacentDesktopId: string,
    ];

export function fingerprintOverviewSpatialDropBasis(
  value: unknown,
): string | null {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const alwaysCenterSingleColumn = value["alwaysCenterSingleColumn"];
    const gap = value["gap"];
    const source = canonicalSource(value["source"]);
    const target = canonicalTarget(value["target"]);
    const contextKeys =
      source === null ||
      target === null ||
      (source[3] === "column" && target[0] === "stack-insertion")
        ? null
        : contextKeysForCanonicalCommand(source, target);
    const model =
      contextKeys === null
        ? null
        : canonicalModel(
            value["model"],
            contextKeys,
            target as CanonicalTarget,
          );
    const contextGeometries = canonicalContextGeometries(
      value["contextGeometries"],
      contextKeys,
    );

    if (
      typeof alwaysCenterSingleColumn !== "boolean" ||
      !validNumber(gap, true) ||
      gap > 64 ||
      source === null ||
      target === null ||
      model === null ||
      contextGeometries === null
    ) {
      return null;
    }

    const canonical = JSON.stringify([
      1,
      alwaysCenterSingleColumn,
      normalizeZero(gap),
      source,
      target,
      model.desktopIds,
      model.contexts,
      contextGeometries,
    ]);
    return sha256(canonical);
  } catch {
    return null;
  }
}

export function overviewSpatialDropBasisContextKeys(
  source: unknown,
  target: unknown,
): readonly OverviewSpatialDropContextKey[] | null {
  try {
    const canonicalSourceValue = canonicalSource(source);
    const canonicalTargetValue = canonicalTarget(target);
    return canonicalSourceValue === null || canonicalTargetValue === null
      ? null
      : contextKeysForCanonicalCommand(
          canonicalSourceValue,
          canonicalTargetValue,
        );
  } catch {
    return null;
  }
}

function canonicalModel(
  value: unknown,
  contextKeys: readonly OverviewSpatialDropContextKey[],
  target: CanonicalTarget,
): {
  readonly contexts: readonly (
    CanonicalContext | readonly [string, string, string, null]
  )[];
  readonly desktopIds: readonly string[] | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const currentActivityId = value["currentActivityId"];
  const rawContexts = value["contexts"];
  const desktopIds = canonicalOrderedIdentifiers(value["desktopIds"]);
  if (
    !validIdentifier(currentActivityId) ||
    !Array.isArray(rawContexts) ||
    rawContexts.length > LAYOUT_PERSISTENCE_LIMITS.contexts ||
    desktopIds === null ||
    contextKeys.some(
      (key) =>
        key.activityId !== currentActivityId ||
        !desktopIds.includes(key.desktopId),
    )
  ) {
    return null;
  }

  const contextsByIdentity = new Map<string, CanonicalContext>();
  for (const rawContext of rawContexts) {
    const context = canonicalContext(rawContext, currentActivityId);
    if (context === null) {
      return null;
    }

    const identity = `${context[0]}\u0000${context[1]}\u0000${context[2]}`;
    if (contextsByIdentity.has(identity)) {
      return null;
    }
    contextsByIdentity.set(identity, context);
  }

  const contexts = contextKeys.map((key) => {
    const context = contextsByIdentity.get(contextKeyIdentity(key));
    return (
      context ?? ([key.activityId, key.outputId, key.desktopId, null] as const)
    );
  });

  return {
    contexts,
    desktopIds: target[0] === "workspace-gap" ? desktopIds : null,
  };
}

function canonicalSource(value: unknown): CanonicalSource | null {
  if (!isRecord(value)) {
    return null;
  }

  const activityId = value["activityId"];
  const desktopId = value["desktopId"];
  const outputId = value["outputId"];
  const scope = value["scope"];
  const windowId = value["windowId"];
  return validIdentifier(activityId) &&
    validIdentifier(desktopId) &&
    validIdentifier(outputId) &&
    (scope === "column" || scope === "window") &&
    validIdentifier(windowId)
    ? [activityId, outputId, desktopId, scope, windowId]
    : null;
}

function canonicalTarget(value: unknown): CanonicalTarget | null {
  if (!isRecord(value)) {
    return null;
  }

  const activityId = value["activityId"];
  const kind = value["kind"];
  const outputId = value["outputId"];
  if (!validIdentifier(activityId) || !validIdentifier(outputId)) {
    return null;
  }

  if (kind === "empty-row") {
    const desktopId = value["desktopId"];
    return validIdentifier(desktopId)
      ? [kind, activityId, outputId, desktopId]
      : null;
  }

  if (kind === "column-boundary" || kind === "stack-insertion") {
    const desktopId = value["desktopId"];
    const position = value["position"];
    const targetWindowId = value["targetWindowId"];
    return validIdentifier(desktopId) &&
      (position === "after" || position === "before") &&
      validIdentifier(targetWindowId)
      ? [kind, activityId, outputId, desktopId, position, targetWindowId]
      : null;
  }

  if (kind === "workspace-gap") {
    const adjacentDesktopId = value["adjacentDesktopId"];
    const anchorDesktopId = value["anchorDesktopId"];
    const position = value["position"];
    return validIdentifier(adjacentDesktopId) &&
      validIdentifier(anchorDesktopId) &&
      adjacentDesktopId !== anchorDesktopId &&
      (position === "after" || position === "before")
      ? [
          kind,
          activityId,
          outputId,
          position,
          anchorDesktopId,
          adjacentDesktopId,
        ]
      : null;
  }

  return null;
}

function contextKeysForCanonicalCommand(
  source: CanonicalSource,
  target: CanonicalTarget,
): readonly OverviewSpatialDropContextKey[] | null {
  if (target[1] !== source[0]) {
    return null;
  }

  const keys: OverviewSpatialDropContextKey[] = [
    {
      activityId: source[0],
      desktopId: source[2],
      outputId: source[1],
    },
  ];
  if (target[0] === "workspace-gap") {
    keys.push(
      {
        activityId: target[1],
        desktopId: target[4],
        outputId: target[2],
      },
      {
        activityId: target[1],
        desktopId: target[5],
        outputId: target[2],
      },
    );
  } else {
    keys.push({
      activityId: target[1],
      desktopId: target[3],
      outputId: target[2],
    });
  }

  const unique = new Map<string, OverviewSpatialDropContextKey>();
  for (const key of keys) {
    unique.set(contextKeyIdentity(key), key);
  }
  return Object.freeze([...unique.values()].sort(compareContextKeys));
}

function canonicalOrderedIdentifiers(value: unknown): readonly string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.contexts
  ) {
    return null;
  }

  const seen = new Set<string>();
  const identifiers: string[] = [];
  for (const identifier of value) {
    if (!validIdentifier(identifier) || seen.has(identifier)) {
      return null;
    }
    seen.add(identifier);
    identifiers.push(identifier);
  }
  return identifiers;
}

function contextKeyIdentity(key: OverviewSpatialDropContextKey): string {
  return `${key.activityId}\u0000${key.outputId}\u0000${key.desktopId}`;
}

function canonicalContext(
  value: unknown,
  currentActivityId: string,
): CanonicalContext | null {
  if (!isRecord(value)) {
    return null;
  }

  const activeColumnIndex = value["activeColumnIndex"];
  const activityId = value["activityId"];
  const columnsValue = value["columns"];
  const desktopId = value["desktopId"];
  const outputId = value["outputId"];
  const viewportOffset = value["viewportOffset"];

  if (
    activityId !== currentActivityId ||
    !validIdentifier(activityId) ||
    !validIdentifier(desktopId) ||
    !validIdentifier(outputId) ||
    !validSignedNumber(viewportOffset) ||
    !Array.isArray(columnsValue) ||
    columnsValue.length > LAYOUT_PERSISTENCE_LIMITS.columnsPerContext ||
    (activeColumnIndex !== null &&
      (!Number.isInteger(activeColumnIndex) ||
        (activeColumnIndex as number) < 0 ||
        (activeColumnIndex as number) >= columnsValue.length))
  ) {
    return null;
  }

  const columns: CanonicalColumn[] = [];
  const windowIds = new Set<string>();
  for (const rawColumn of columnsValue) {
    const column = canonicalColumn(rawColumn, windowIds);
    if (column === null) {
      return null;
    }
    columns.push(column);
  }

  if ((columns.length === 0) !== (activeColumnIndex === null)) {
    return null;
  }

  return [
    activityId,
    outputId,
    desktopId,
    activeColumnIndex as number | null,
    normalizeZero(viewportOffset),
    columns,
  ];
}

function canonicalColumn(
  value: unknown,
  contextWindowIds: Set<string>,
): CanonicalColumn | null {
  if (!isRecord(value)) {
    return null;
  }

  const fullWidthRestore = value["fullWidthRestore"];
  const membersValue = value["members"];
  const presentation = value["presentation"];
  const selectedMemberIndex = value["selectedMemberIndex"];
  const width = canonicalWidth(value["width"]);
  const restoreWidth =
    fullWidthRestore === undefined ? null : canonicalWidth(fullWidthRestore);

  if (
    (presentation !== "stacked" && presentation !== "tabbed") ||
    !Array.isArray(membersValue) ||
    membersValue.length === 0 ||
    membersValue.length > LAYOUT_PERSISTENCE_LIMITS.membersPerColumn ||
    !Number.isInteger(selectedMemberIndex) ||
    (selectedMemberIndex as number) < 0 ||
    (selectedMemberIndex as number) >= membersValue.length ||
    width === null ||
    (fullWidthRestore !== undefined && restoreWidth === null)
  ) {
    return null;
  }

  const members: CanonicalMember[] = [];
  for (const rawMember of membersValue) {
    const member = canonicalMember(rawMember);
    if (member === null || contextWindowIds.has(member[0])) {
      return null;
    }
    contextWindowIds.add(member[0]);
    members.push(member);
  }

  return [
    presentation,
    selectedMemberIndex as number,
    width,
    restoreWidth,
    members,
  ];
}

function canonicalMember(value: unknown): CanonicalMember | null {
  if (!isRecord(value)) {
    return null;
  }

  const windowId = value["windowId"];
  const heightValue = value["height"];
  const heightBoundsValue = value["heightBounds"];
  const height =
    heightValue === undefined ? null : canonicalHeight(heightValue);
  const heightBounds =
    heightBoundsValue === undefined
      ? null
      : canonicalHeightBounds(heightBoundsValue);

  return validIdentifier(windowId) &&
    (heightValue === undefined || height !== null) &&
    (heightBoundsValue === undefined || heightBounds !== null)
    ? [windowId, height, heightBounds]
    : null;
}

function canonicalWidth(value: unknown): CanonicalWidth | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value["kind"];
  const width = value["value"];
  return (kind === "fixed" || kind === "proportion") &&
    validNumber(width, false)
    ? [kind, normalizeZero(width)]
    : null;
}

function canonicalHeight(value: unknown): CanonicalHeight | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = value["kind"];
  if (kind === "auto") {
    const weight = value["weight"];
    return validNumber(weight, false) ? [kind, normalizeZero(weight)] : null;
  }
  if (kind === "fixed") {
    const clientHeight = value["clientHeight"];
    return validNumber(clientHeight, false)
      ? [kind, normalizeZero(clientHeight)]
      : null;
  }
  if (kind === "preset") {
    const index = value["index"];
    return Number.isInteger(index) &&
      (index as number) >= 0 &&
      (index as number) <= LAYOUT_PERSISTENCE_LIMITS.presetIndex
      ? [kind, index as number]
      : null;
  }
  return null;
}

function canonicalHeightBounds(value: unknown): CanonicalHeightBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const decorationHeight = value["decorationHeight"];
  const maximumClientHeight = value["maximumClientHeight"];
  const minimumClientHeight = value["minimumClientHeight"];
  if (
    !validNumber(decorationHeight, true) ||
    !validNumber(minimumClientHeight, true) ||
    (maximumClientHeight !== Number.POSITIVE_INFINITY &&
      !validNumber(maximumClientHeight, false)) ||
    (maximumClientHeight !== Number.POSITIVE_INFINITY &&
      maximumClientHeight < minimumClientHeight)
  ) {
    return null;
  }

  return [
    normalizeZero(decorationHeight),
    normalizeZero(minimumClientHeight),
    maximumClientHeight === Number.POSITIVE_INFINITY
      ? "positive-infinity"
      : normalizeZero(maximumClientHeight),
  ];
}

function canonicalContextGeometries(
  value: unknown,
  contextKeys: readonly OverviewSpatialDropContextKey[] | null,
): readonly CanonicalGeometry[] | null {
  if (
    contextKeys === null ||
    !Array.isArray(value) ||
    value.length !== contextKeys.length
  ) {
    return null;
  }

  const expectedIdentities = new Set(contextKeys.map(contextKeyIdentity));
  const identities = new Set<string>();
  const geometries: CanonicalGeometry[] = [];
  for (const rawGeometry of value) {
    if (!isRecord(rawGeometry)) {
      return null;
    }

    const activityId = rawGeometry["activityId"];
    const desktopId = rawGeometry["desktopId"];
    const fingerprint = rawGeometry["fingerprint"];
    const outputId = rawGeometry["outputId"];
    if (
      !validIdentifier(activityId) ||
      !validIdentifier(desktopId) ||
      !validContextGeometryFingerprint(fingerprint) ||
      !validIdentifier(outputId)
    ) {
      return null;
    }

    const identity = contextKeyIdentity({ activityId, desktopId, outputId });
    if (!expectedIdentities.has(identity) || identities.has(identity)) {
      return null;
    }
    identities.add(identity);
    geometries.push([activityId, outputId, desktopId, fingerprint]);
  }

  return identities.size === expectedIdentities.size
    ? geometries.sort(compareGeometries)
    : null;
}

function validContextGeometryFingerprint(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.contextFingerprintCharacters
  ) {
    return false;
  }

  const components = value.split("\u0000");
  if (components.length !== 9) {
    return false;
  }

  return components.every((component, index) => {
    const number = Number(component);
    const positive =
      index === 0 || index === 3 || index === 4 || index === 7 || index === 8;
    return (
      component.length > 0 &&
      Number.isFinite(number) &&
      Math.abs(number) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude &&
      String(number) === component &&
      (!positive || number > 0)
    );
  });
}

function validIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return false;
    }
  }
  return true;
}

function validNumber(value: unknown, allowZero: boolean): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude &&
    (allowZero ? value >= 0 : value > 0)
  );
}

function validSignedNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function compareGeometries(
  left: CanonicalGeometry,
  right: CanonicalGeometry,
): number {
  return (
    compareStrings(left[0], right[0]) ||
    compareStrings(left[1], right[1]) ||
    compareStrings(left[2], right[2])
  );
}

function compareContextKeys(
  left: OverviewSpatialDropContextKey,
  right: OverviewSpatialDropContextKey,
): number {
  return (
    compareStrings(left.activityId, right.activityId) ||
    compareStrings(left.outputId, right.outputId) ||
    compareStrings(left.desktopId, right.desktopId)
  );
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  const words = utf8Words(value);
  const bitLength = words.length * 8;
  words.push(0x80);
  while (words.length % 64 !== 56) {
    words.push(0);
  }

  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) {
    words.push((high >>> shift) & 0xff);
  }
  for (let shift = 24; shift >= 0; shift -= 8) {
    words.push((low >>> shift) & 0xff);
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const schedule = new Array<number>(64).fill(0);

  for (let offset = 0; offset < words.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      schedule[index] =
        (((words[cursor] ?? 0) << 24) |
          ((words[cursor + 1] ?? 0) << 16) |
          ((words[cursor + 2] ?? 0) << 8) |
          (words[cursor + 3] ?? 0)) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const first = schedule[index - 15] ?? 0;
      const second = schedule[index - 2] ?? 0;
      const sigma0 =
        rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
      const sigma1 =
        rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
      schedule[index] =
        ((schedule[index - 16] ?? 0) +
          sigma0 +
          (schedule[index - 7] ?? 0) +
          sigma1) >>>
        0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 =
        (h +
          sum1 +
          choice +
          (SHA256_CONSTANTS[index] ?? 0) +
          (schedule[index] ?? 0)) >>>
        0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function utf8Words(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    if (
      codePoint >= 0xd800 &&
      codePoint <= 0xdbff &&
      index + 1 < value.length
    ) {
      const trailing = value.charCodeAt(index + 1);
      if (trailing >= 0xdc00 && trailing <= 0xdfff) {
        codePoint =
          0x1_0000 + ((codePoint - 0xd800) << 10) + (trailing - 0xdc00);
        index += 1;
      }
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
