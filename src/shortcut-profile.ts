import { shortcutActions } from "./shortcut-actions";

export interface ShortcutBinding {
  readonly key: number;
  readonly name: string;
  readonly sequence: string;
  readonly text: string;
}

const QT_ALT_MODIFIER = 0x08000000;
const QT_CONTROL_MODIFIER = 0x04000000;
const QT_META_MODIFIER = 0x10000000;
const QT_SHIFT_MODIFIER = 0x02000000;

const modifierCodes = new Map<string, number>([
  ["Alt", QT_ALT_MODIFIER],
  ["Ctrl", QT_CONTROL_MODIFIER],
  ["Meta", QT_META_MODIFIER],
  ["Shift", QT_SHIFT_MODIFIER],
]);

const namedKeyCodes = new Map<string, number>([
  ["Down", 0x01000015],
  ["End", 0x01000011],
  ["Home", 0x01000010],
  ["Left", 0x01000012],
  ["PgDown", 0x01000017],
  ["PgUp", 0x01000016],
  ["Right", 0x01000014],
  ["Up", 0x01000013],
]);

export const shortcutBindings: readonly ShortcutBinding[] =
  createShortcutBindings();

export const shortcutProfileId = shortcutBindings
  .map((binding) => `${binding.name}:${String(binding.key)}`)
  .join("|");

function createShortcutBindings(): readonly ShortcutBinding[] {
  const bindings: ShortcutBinding[] = [];

  for (const action of shortcutActions) {
    const sequence = action.defaultSequence;

    if (sequence === undefined) {
      continue;
    }

    bindings.push({
      key: encodeShortcut(sequence),
      name: action.name,
      sequence,
      text: action.text,
    });
  }

  return bindings;
}

export function encodeShortcut(sequence: string): number {
  let keyName = sequence;
  let modifiers = 0;
  const seenModifiers = new Set<string>();

  let separator = keyName.indexOf("+");

  while (separator > 0) {
    const candidate = keyName.slice(0, separator);
    const modifier = modifierCodes.get(candidate);

    if (modifier === undefined) {
      break;
    }

    if (seenModifiers.has(candidate)) {
      throw new Error(`Duplicate shortcut modifier: ${candidate}`);
    }

    seenModifiers.add(candidate);
    modifiers |= modifier;
    keyName = keyName.slice(separator + 1);
    separator = keyName.indexOf("+");
  }

  const namedKey = namedKeyCodes.get(keyName);

  if (namedKey !== undefined) {
    return modifiers | namedKey;
  }

  if (keyName.length !== 1) {
    throw new Error(`Unsupported shortcut key: ${keyName}`);
  }

  const character = /[a-z]/i.test(keyName) ? keyName.toUpperCase() : keyName;
  const keyCode = character.codePointAt(0);

  if (keyCode === undefined) {
    throw new Error(`Unsupported shortcut key: ${keyName}`);
  }

  return modifiers | keyCode;
}
