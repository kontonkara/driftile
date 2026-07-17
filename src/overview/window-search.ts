const MAX_QUERY_CODE_POINTS = 128;
const MAX_QUERY_SCAN_CODE_POINTS = MAX_QUERY_CODE_POINTS * 4;
const MAX_QUERY_CLAUSES = 8;
const MAX_QUERY_GROUPS = 4;
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

export interface OverviewWindowSearchQueryGroup {
  readonly clauses: readonly OverviewWindowSearchQueryClause[];
  readonly requiredFields: readonly OverviewWindowSearchFieldName[];
  readonly requiresAllFields: boolean;
}

export interface OverviewWindowSearchQueryPlan {
  readonly clauses: readonly OverviewWindowSearchQueryClause[];
  readonly groups: readonly OverviewWindowSearchQueryGroup[];
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
const EMPTY_QUERY_PLAN = createQueryPlan([]);

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
    const groups: OverviewWindowSearchQueryClause[][] = [];
    let retainedClauseCount = 0;
    let parsedGroupCount = 1;
    let currentGroupHasClause = false;
    let offset = skipWhiteSpace(normalizedQuery, 0);

    while (offset < normalizedQuery.length) {
      if (isAlternativeSeparatorAt(normalizedQuery, offset)) {
        if (!currentGroupHasClause || parsedGroupCount >= MAX_QUERY_GROUPS) {
          return null;
        }

        parsedGroupCount += 1;
        currentGroupHasClause = false;
        offset = skipWhiteSpace(normalizedQuery, offset + 1);
        continue;
      }

      const parsed = parseSearchClause(normalizedQuery, offset);

      if (parsed === null) {
        return null;
      }

      currentGroupHasClause = true;

      if (retainedClauseCount < MAX_QUERY_CLAUSES) {
        const clause = Object.freeze({
          bare: parsed.bare,
          excluded: parsed.excluded,
          fields: parsed.fields,
          value: normalizeClauseValue(parsed.value),
        });

        while (groups.length < parsedGroupCount) {
          groups.push([]);
        }

        (
          groups[parsedGroupCount - 1] as OverviewWindowSearchQueryClause[]
        ).push(clause);
        retainedClauseCount += 1;
      }

      offset = skipWhiteSpace(normalizedQuery, parsed.nextOffset);
    }

    if (!currentGroupHasClause && parsedGroupCount > 1) {
      return null;
    }

    return retainedClauseCount === 0
      ? EMPTY_QUERY_PLAN
      : createQueryPlan(groups);
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

    if (searchPlan.groups.length === 0) {
      return true;
    }

    if (!isRecord(fields)) {
      return false;
    }

    const normalizedFields = new Array<string | undefined>(
      SEARCH_FIELD_NAMES.length,
    );
    const fieldReadStates = new Array<number>(SEARCH_FIELD_NAMES.length).fill(
      0,
    );
    let hasAvailableField = false;

    for (const group of searchPlan.groups) {
      if (group.requiresAllFields) {
        for (const name of group.requiredFields) {
          const index = fieldIndex(name);

          if (fieldReadStates[index] !== 0) {
            continue;
          }

          const value = fields[name];
          fieldReadStates[index] = 1;

          if (value !== undefined) {
            if (typeof value !== "string") {
              return false;
            }

            normalizedFields[index] = codePointPrefix(
              value,
              fieldCodePointLimit(name),
            ).toLowerCase();
            hasAvailableField = true;
          }
        }
      }

      let groupMatches = true;

      for (const clause of group.clauses) {
        let clauseMatches = false;

        for (const name of clause.fields) {
          const index = fieldIndex(name);

          if (fieldReadStates[index] === 0) {
            const value = fields[name];
            fieldReadStates[index] = 1;

            if (value !== undefined) {
              if (typeof value !== "string") {
                return false;
              }

              normalizedFields[index] = codePointPrefix(
                value,
                fieldCodePointLimit(name),
              ).toLowerCase();
              hasAvailableField = true;
            }
          }

          const field = normalizedFields[index];

          if (field !== undefined && field.includes(clause.value)) {
            clauseMatches = true;
            break;
          }
        }

        if (clause.excluded ? clauseMatches : !clauseMatches) {
          groupMatches = false;
          break;
        }
      }

      if (groupMatches && (!group.requiresAllFields || hasAvailableField)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function createQueryPlan(
  clauseGroups: readonly (readonly OverviewWindowSearchQueryClause[])[],
): OverviewWindowSearchQueryPlan {
  const groups: OverviewWindowSearchQueryGroup[] = [];
  const clauses: OverviewWindowSearchQueryClause[] = [];
  let requiredFieldMask = 0;
  let requiresAllFields = false;

  for (const clauseGroup of clauseGroups) {
    let groupRequiredFieldMask = 0;
    let groupRequiresAllFields = false;

    for (const clause of clauseGroup) {
      clauses.push(clause);
      groupRequiredFieldMask |= fieldMask(clause.fields);
      groupRequiresAllFields ||= clause.bare;
    }

    const group = Object.freeze({
      clauses: Object.freeze([...clauseGroup]),
      requiredFields: requiredFieldsForMask(groupRequiredFieldMask),
      requiresAllFields: groupRequiresAllFields,
    });

    groups.push(group);
    requiredFieldMask |= groupRequiredFieldMask;
    requiresAllFields ||= groupRequiresAllFields;
  }

  const requiredFields = Object.freeze(
    requiredFieldsForMask(requiredFieldMask),
  );
  const plan = Object.freeze({
    clauses: Object.freeze([...clauses]),
    groups: Object.freeze(groups),
    requiredFields,
    requiresAllFields,
  });

  trustedQueryPlans.add(plan);
  return plan;
}

function requiredFieldsForMask(
  requiredFieldMask: number,
): readonly OverviewWindowSearchFieldName[] {
  return Object.freeze(
    SEARCH_FIELD_NAMES.filter(
      (name) => (requiredFieldMask & (1 << fieldIndex(name))) !== 0,
    ),
  );
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

function isAlternativeSeparatorAt(query: string, offset: number): boolean {
  return (
    query[offset] === "|" &&
    (offset + 1 === query.length || isWhiteSpaceAt(query, offset + 1))
  );
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
  const groups = value["groups"];
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

  const decodedFlatClauses = decodeExternalQueryClauses(clauses);

  if (decodedFlatClauses === null) {
    return null;
  }

  if (groups === undefined) {
    return decodeLegacyExternalQueryPlan(
      decodedFlatClauses,
      requiredFields,
      requiresAllFields,
    );
  }

  if (!Array.isArray(groups) || groups.length > MAX_QUERY_GROUPS) {
    return null;
  }

  const decodedGroups: OverviewWindowSearchQueryClause[][] = [];
  const flattenedGroupClauses: OverviewWindowSearchQueryClause[] = [];

  for (let index = 0; index < groups.length; index += 1) {
    const group = decodeExternalQueryGroup(groups[index] as unknown);

    if (group === null) {
      return null;
    }

    if (flattenedGroupClauses.length + group.length > MAX_QUERY_CLAUSES) {
      return null;
    }

    decodedGroups.push(group);
    flattenedGroupClauses.push(...group);
  }

  if (
    flattenedGroupClauses.length !== decodedFlatClauses.length ||
    !sameClauses(flattenedGroupClauses, decodedFlatClauses)
  ) {
    return null;
  }

  const plan = createQueryPlan(decodedGroups);

  return samePlanMetadata(plan, requiredFields, requiresAllFields)
    ? plan
    : null;
}

function decodeLegacyExternalQueryPlan(
  clauses: readonly OverviewWindowSearchQueryClause[],
  requiredFields: readonly unknown[],
  requiresAllFields: boolean,
): OverviewWindowSearchQueryPlan | null {
  const plan = createQueryPlan(clauses.length === 0 ? [] : [clauses]);

  return samePlanMetadata(plan, requiredFields, requiresAllFields)
    ? plan
    : null;
}

function decodeExternalQueryGroup(
  value: unknown,
): OverviewWindowSearchQueryClause[] | null {
  if (!isRecord(value)) {
    return null;
  }

  const clauses = value["clauses"];
  const requiredFields = value["requiredFields"];
  const requiresAllFields = value["requiresAllFields"];

  if (
    !Array.isArray(clauses) ||
    clauses.length === 0 ||
    clauses.length > MAX_QUERY_CLAUSES ||
    !Array.isArray(requiredFields) ||
    requiredFields.length > SEARCH_FIELD_NAMES.length ||
    typeof requiresAllFields !== "boolean"
  ) {
    return null;
  }

  const decodedClauses = decodeExternalQueryClauses(clauses);

  if (decodedClauses === null) {
    return null;
  }

  const canonicalGroupPlan = createQueryPlan([decodedClauses]);
  const canonicalGroup = canonicalGroupPlan.groups[0];

  return canonicalGroup !== undefined &&
    sameGroupMetadata(canonicalGroup, requiredFields, requiresAllFields)
    ? decodedClauses
    : null;
}

function decodeExternalQueryClauses(
  clauses: readonly unknown[],
): OverviewWindowSearchQueryClause[] | null {
  const decodedClauses: OverviewWindowSearchQueryClause[] = [];

  for (let index = 0; index < clauses.length; index += 1) {
    const clause = decodeExternalQueryClause(clauses[index]);

    if (clause === null) {
      return null;
    }

    decodedClauses.push(clause);
  }

  return decodedClauses;
}

function samePlanMetadata(
  plan: OverviewWindowSearchQueryPlan,
  requiredFields: readonly unknown[],
  requiresAllFields: boolean,
): boolean {
  return (
    plan.requiresAllFields === requiresAllFields &&
    sameFields(requiredFields, plan.requiredFields)
  );
}

function sameGroupMetadata(
  group: OverviewWindowSearchQueryGroup,
  requiredFields: readonly unknown[],
  requiresAllFields: boolean,
): boolean {
  return (
    group.requiresAllFields === requiresAllFields &&
    sameFields(requiredFields, group.requiredFields)
  );
}

function sameClauses(
  left: readonly OverviewWindowSearchQueryClause[],
  right: readonly OverviewWindowSearchQueryClause[],
): boolean {
  for (let index = 0; index < left.length; index += 1) {
    const leftClause = left[index] as OverviewWindowSearchQueryClause;
    const rightClause = right[index] as OverviewWindowSearchQueryClause;

    if (
      leftClause.bare !== rightClause.bare ||
      leftClause.excluded !== rightClause.excluded ||
      leftClause.value !== rightClause.value ||
      !sameFields(leftClause.fields, rightClause.fields)
    ) {
      return false;
    }
  }

  return true;
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
