const MAX_QUERY_CODE_POINTS = 128;
const MAX_QUERY_SCAN_CODE_POINTS = MAX_QUERY_CODE_POINTS * 4;
const MAX_QUERY_CLAUSES = 8;
const MAX_SEARCH_FIELD_CODE_POINTS = 512;
const MAX_DESKTOP_NAME_SEARCH_FIELD_CODE_POINTS = 64;
const MAX_OUTPUT_NAME_SEARCH_FIELD_CODE_POINTS = 64;
const WHITE_SPACE_PATTERN = /\s/u;

const SEARCH_FIELD_NAMES = Object.freeze([
  "caption",
  "resourceClass",
  "resourceName",
  "desktopFileName",
  "state",
  "desktopName",
  "outputName",
] as const);

export type OverviewWindowSearchFieldName = (typeof SEARCH_FIELD_NAMES)[number];

const TITLE_SEARCH_FIELDS = Object.freeze(["caption"] as const);
const APPLICATION_SEARCH_FIELDS = Object.freeze([
  "resourceClass",
  "resourceName",
  "desktopFileName",
] as const);
const DESKTOP_SEARCH_FIELDS = Object.freeze(["desktopName"] as const);
const OUTPUT_SEARCH_FIELDS = Object.freeze(["outputName"] as const);
const STATE_SEARCH_FIELDS = Object.freeze(["state"] as const);

export interface OverviewWindowSearchQueryClause {
  readonly bare: boolean;
  readonly excluded: boolean;
  readonly fields: readonly OverviewWindowSearchFieldName[];
  readonly value: string;
}

export interface OverviewWindowSearchQueryPlan {
  readonly clauses: readonly OverviewWindowSearchQueryClause[];
  readonly requiredFields: readonly OverviewWindowSearchFieldName[];
  readonly requiresAllFields: boolean;
}

interface ParsedSearchClause {
  readonly bare: boolean;
  readonly excluded: boolean;
  readonly fields: readonly OverviewWindowSearchFieldName[];
  readonly nextOffset: number;
  readonly value: string;
}

interface ParsedQuotedValue {
  readonly nextOffset: number;
  readonly value: string;
}

const trustedQueryPlans = new WeakSet<OverviewWindowSearchQueryPlan>();
const EMPTY_QUERY_PLAN = createQueryPlan([], 0, false);

export function appendOverviewSearchText(
  current: unknown,
  input: unknown,
): string {
  return readQueryCharacters(current, input).join("");
}

export function removeLastOverviewSearchCharacter(current: unknown): string {
  const characters = readQueryCharacters(current);
  characters.pop();
  return characters.join("");
}

export function removeLastOverviewSearchClause(current: unknown): string {
  const characters = readQueryCharacters(current);

  while (
    characters.length > 0 &&
    WHITE_SPACE_PATTERN.test(characters[characters.length - 1] as string)
  ) {
    characters.pop();
  }

  if (characters.length === 0) {
    return "";
  }

  let clauseStart = 0;
  let inClause = false;
  let inQuotedValue = false;
  let sawEarlierClause = false;
  let sawClause = false;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] as string;

    if (!inQuotedValue && WHITE_SPACE_PATTERN.test(character)) {
      inClause = false;
      continue;
    }

    if (!inClause) {
      clauseStart = index;
      inClause = true;
      sawEarlierClause = sawClause;
      sawClause = true;
    }

    if (character === '"') {
      inQuotedValue = !inQuotedValue;
    }
  }

  return sawEarlierClause ? characters.slice(0, clauseStart).join("") : "";
}

export function planOverviewWindowSearchQuery(
  query: unknown,
): OverviewWindowSearchQueryPlan | null {
  try {
    const normalizedQuery = readQueryCharacters(query).join("");
    const clauses: OverviewWindowSearchQueryClause[] = [];
    let requiredFieldMask = 0;
    let requiresAllFields = false;
    let offset = skipWhiteSpace(normalizedQuery, 0);

    while (offset < normalizedQuery.length) {
      const parsed = parseSearchClause(normalizedQuery, offset);

      if (parsed === null) {
        return null;
      }

      if (clauses.length < MAX_QUERY_CLAUSES) {
        const clause = Object.freeze({
          bare: parsed.bare,
          excluded: parsed.excluded,
          fields: parsed.fields,
          value: normalizeClauseValue(parsed.value),
        });

        clauses.push(clause);
        requiredFieldMask |= fieldMask(parsed.fields);
        requiresAllFields ||= parsed.bare;
      }

      offset = skipWhiteSpace(normalizedQuery, parsed.nextOffset);
    }

    return clauses.length === 0
      ? EMPTY_QUERY_PLAN
      : createQueryPlan(clauses, requiredFieldMask, requiresAllFields);
  } catch {
    return null;
  }
}

export function matchesOverviewWindowSearch(
  query: unknown,
  fields: unknown,
): boolean {
  const plan = planOverviewWindowSearchQuery(query);
  return plan !== null && matchesOverviewWindowSearchPlan(plan, fields);
}

export function matchesOverviewWindowSearchPlan(
  plan: unknown,
  fields: unknown,
): boolean {
  try {
    const searchPlan = readQueryPlan(plan);

    if (searchPlan === null) {
      return false;
    }

    if (searchPlan.clauses.length === 0) {
      return true;
    }

    if (!isRecord(fields)) {
      return false;
    }

    const normalizedFields = new Array<string | undefined>(
      SEARCH_FIELD_NAMES.length,
    );
    let availableFields = 0;

    for (const name of searchPlan.requiredFields) {
      const value = fields[name];

      if (value === undefined) {
        continue;
      }

      if (typeof value !== "string") {
        return false;
      }

      normalizedFields[fieldIndex(name)] = codePointPrefix(
        value,
        fieldCodePointLimit(name),
      ).toLowerCase();
      availableFields += 1;
    }

    if (searchPlan.requiresAllFields && availableFields === 0) {
      return false;
    }

    for (const clause of searchPlan.clauses) {
      let clauseMatches = false;

      for (const name of clause.fields) {
        const field = normalizedFields[fieldIndex(name)];

        if (field !== undefined && field.includes(clause.value)) {
          clauseMatches = true;
          break;
        }
      }

      if (clause.excluded ? clauseMatches : !clauseMatches) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function createQueryPlan(
  clauses: readonly OverviewWindowSearchQueryClause[],
  requiredFieldMask: number,
  requiresAllFields: boolean,
): OverviewWindowSearchQueryPlan {
  const requiredFields = Object.freeze(
    SEARCH_FIELD_NAMES.filter(
      (name) => (requiredFieldMask & (1 << fieldIndex(name))) !== 0,
    ),
  );
  const plan = Object.freeze({
    clauses: Object.freeze([...clauses]),
    requiredFields,
    requiresAllFields,
  });

  trustedQueryPlans.add(plan);
  return plan;
}

function parseSearchClause(
  query: string,
  clauseOffset: number,
): ParsedSearchClause | null {
  let offset = clauseOffset;
  let excluded = false;

  if (
    query[offset] === "-" &&
    offset + 1 < query.length &&
    !isWhiteSpaceAt(query, offset + 1)
  ) {
    excluded = true;
    offset += 1;
  }

  if (query[offset] === '"') {
    const quoted = parseQuotedValue(query, offset);

    return quoted === null
      ? null
      : {
          bare: true,
          excluded,
          fields: SEARCH_FIELD_NAMES,
          nextOffset: quoted.nextOffset,
          value: quoted.value,
        };
  }

  const colonOffset = findScopeColon(query, offset);

  if (colonOffset >= 0) {
    const scope = query.slice(offset, colonOffset).toLowerCase();
    const scopedFields = fieldsForScope(scope);

    if (scopedFields !== null) {
      const valueOffset = colonOffset + 1;

      if (valueOffset >= query.length || isWhiteSpaceAt(query, valueOffset)) {
        return null;
      }

      if (query[valueOffset] === '"') {
        const quoted = parseQuotedValue(query, valueOffset);

        return quoted === null
          ? null
          : {
              bare: false,
              excluded,
              fields: scopedFields,
              nextOffset: quoted.nextOffset,
              value: quoted.value,
            };
      }

      const nextOffset = findTokenEnd(query, valueOffset);
      const value = query.slice(valueOffset, nextOffset);

      return value.includes('"')
        ? null
        : {
            bare: false,
            excluded,
            fields: scopedFields,
            nextOffset,
            value,
          };
    }

    if (query[colonOffset + 1] === '"') {
      const quoted = parseQuotedValue(query, colonOffset + 1);

      return quoted === null
        ? null
        : {
            bare: true,
            excluded,
            fields: SEARCH_FIELD_NAMES,
            nextOffset: quoted.nextOffset,
            value: `${query.slice(offset, colonOffset + 1)}${quoted.value}`,
          };
    }
  }

  const nextOffset = findTokenEnd(query, offset);
  const value = query.slice(offset, nextOffset);

  return value.includes('"')
    ? null
    : {
        bare: true,
        excluded,
        fields: SEARCH_FIELD_NAMES,
        nextOffset,
        value,
      };
}

function parseQuotedValue(
  query: string,
  quoteOffset: number,
): ParsedQuotedValue | null {
  const closingQuoteOffset = query.indexOf('"', quoteOffset + 1);

  if (closingQuoteOffset < 0) {
    return null;
  }

  const nextOffset = closingQuoteOffset + 1;
  const value = query.slice(quoteOffset + 1, closingQuoteOffset);

  return value.trim().length === 0 ||
    (nextOffset < query.length && !isWhiteSpaceAt(query, nextOffset))
    ? null
    : { nextOffset, value };
}

function findScopeColon(query: string, offset: number): number {
  while (offset < query.length && !isWhiteSpaceAt(query, offset)) {
    const character = query[offset];

    if (character === ":") {
      return offset;
    }

    if (character === '"') {
      return -1;
    }

    offset += 1;
  }

  return -1;
}

function findTokenEnd(query: string, offset: number): number {
  while (offset < query.length && !isWhiteSpaceAt(query, offset)) {
    offset += 1;
  }

  return offset;
}

function skipWhiteSpace(query: string, offset: number): number {
  while (offset < query.length && isWhiteSpaceAt(query, offset)) {
    offset += 1;
  }

  return offset;
}

function isWhiteSpaceAt(query: string, offset: number): boolean {
  const character = query[offset];
  return character !== undefined && WHITE_SPACE_PATTERN.test(character);
}

function fieldsForScope(
  scope: string,
): readonly OverviewWindowSearchFieldName[] | null {
  switch (scope) {
    case "app":
      return APPLICATION_SEARCH_FIELDS;
    case "desktop":
      return DESKTOP_SEARCH_FIELDS;
    case "output":
      return OUTPUT_SEARCH_FIELDS;
    case "state":
      return STATE_SEARCH_FIELDS;
    case "title":
      return TITLE_SEARCH_FIELDS;
    default:
      return null;
  }
}

function normalizeClauseValue(value: string): string {
  return codePointPrefix(value.toLowerCase(), MAX_QUERY_CODE_POINTS);
}

function fieldCodePointLimit(name: OverviewWindowSearchFieldName): number {
  switch (name) {
    case "desktopName":
      return MAX_DESKTOP_NAME_SEARCH_FIELD_CODE_POINTS;
    case "outputName":
      return MAX_OUTPUT_NAME_SEARCH_FIELD_CODE_POINTS;
    default:
      return MAX_SEARCH_FIELD_CODE_POINTS;
  }
}

function fieldIndex(name: OverviewWindowSearchFieldName): number {
  switch (name) {
    case "caption":
      return 0;
    case "resourceClass":
      return 1;
    case "resourceName":
      return 2;
    case "desktopFileName":
      return 3;
    case "state":
      return 4;
    case "desktopName":
      return 5;
    case "outputName":
      return 6;
  }
}

function fieldMask(fields: readonly OverviewWindowSearchFieldName[]): number {
  let mask = 0;

  for (const name of fields) {
    mask |= 1 << fieldIndex(name);
  }

  return mask;
}

function readQueryPlan(value: unknown): OverviewWindowSearchQueryPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as unknown as OverviewWindowSearchQueryPlan;

  if (trustedQueryPlans.has(candidate)) {
    return candidate;
  }

  return decodeExternalQueryPlan(value);
}

function decodeExternalQueryPlan(
  value: Record<string, unknown>,
): OverviewWindowSearchQueryPlan | null {
  const clauses = value["clauses"];
  const requiredFields = value["requiredFields"];
  const requiresAllFields = value["requiresAllFields"];

  if (
    !Array.isArray(clauses) ||
    clauses.length > MAX_QUERY_CLAUSES ||
    !Array.isArray(requiredFields) ||
    requiredFields.length > SEARCH_FIELD_NAMES.length ||
    typeof requiresAllFields !== "boolean"
  ) {
    return null;
  }

  const decodedClauses: OverviewWindowSearchQueryClause[] = [];
  let expectedRequiredFieldMask = 0;
  let expectedRequiresAllFields = false;

  for (let index = 0; index < clauses.length; index += 1) {
    const clause = decodeExternalQueryClause(clauses[index] as unknown);

    if (clause === null) {
      return null;
    }

    decodedClauses.push(clause);
    expectedRequiredFieldMask |= fieldMask(clause.fields);
    expectedRequiresAllFields ||= clause.bare;
  }

  if (requiresAllFields !== expectedRequiresAllFields) {
    return null;
  }

  let requiredFieldOffset = 0;

  for (const name of SEARCH_FIELD_NAMES) {
    if ((expectedRequiredFieldMask & (1 << fieldIndex(name))) === 0) {
      continue;
    }

    if (requiredFields[requiredFieldOffset] !== name) {
      return null;
    }

    requiredFieldOffset += 1;
  }

  return requiredFieldOffset === requiredFields.length
    ? createQueryPlan(
        decodedClauses,
        expectedRequiredFieldMask,
        expectedRequiresAllFields,
      )
    : null;
}

function decodeExternalQueryClause(
  value: unknown,
): OverviewWindowSearchQueryClause | null {
  if (!isRecord(value)) {
    return null;
  }

  const bare = value["bare"];
  const excluded = value["excluded"];
  const fields = value["fields"];
  const clauseValue = value["value"];

  if (
    typeof bare !== "boolean" ||
    typeof excluded !== "boolean" ||
    !Array.isArray(fields) ||
    typeof clauseValue !== "string" ||
    !isValidClauseValue(clauseValue)
  ) {
    return null;
  }

  const canonicalFields = bare
    ? sameFields(fields, SEARCH_FIELD_NAMES)
      ? SEARCH_FIELD_NAMES
      : null
    : canonicalScopedFields(fields);

  return canonicalFields === null
    ? null
    : Object.freeze({
        bare,
        excluded,
        fields: canonicalFields,
        value: clauseValue,
      });
}

function canonicalScopedFields(
  value: readonly unknown[],
): readonly OverviewWindowSearchFieldName[] | null {
  for (const fields of [
    TITLE_SEARCH_FIELDS,
    APPLICATION_SEARCH_FIELDS,
    DESKTOP_SEARCH_FIELDS,
    OUTPUT_SEARCH_FIELDS,
    STATE_SEARCH_FIELDS,
  ]) {
    if (sameFields(value, fields)) {
      return fields;
    }
  }

  return null;
}

function isValidClauseValue(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > MAX_QUERY_CODE_POINTS * 2 ||
    value.trim().length === 0 ||
    value.includes('"') ||
    value !== value.toLowerCase()
  ) {
    return false;
  }

  let codePoints = 0;
  let offset = 0;

  while (offset < value.length && codePoints <= MAX_QUERY_CODE_POINTS) {
    const codePoint = value.codePointAt(offset);

    if (codePoint === undefined || isControlCodePoint(codePoint)) {
      return false;
    }

    offset += codePoint > 0xffff ? 2 : 1;
    codePoints += 1;
  }

  return codePoints <= MAX_QUERY_CODE_POINTS;
}

function sameFields(
  value: readonly unknown[],
  expected: readonly OverviewWindowSearchFieldName[],
): boolean {
  if (value.length !== expected.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (value[index] !== expected[index]) {
      return false;
    }
  }

  return true;
}

function readQueryCharacters(...values: readonly unknown[]): string[] {
  const characters: string[] = [];
  let scannedCodePoints = 0;

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    let offset = 0;
    while (
      offset < value.length &&
      scannedCodePoints < MAX_QUERY_SCAN_CODE_POINTS &&
      characters.length < MAX_QUERY_CODE_POINTS
    ) {
      const codePoint = value.codePointAt(offset);
      if (codePoint === undefined) {
        break;
      }

      const nextOffset = offset + (codePoint > 0xffff ? 2 : 1);
      scannedCodePoints += 1;

      if (!isControlCodePoint(codePoint)) {
        characters.push(value.slice(offset, nextOffset));
      }

      offset = nextOffset;
    }
  }

  return characters;
}

function codePointPrefix(value: string, maximum: number): string {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
