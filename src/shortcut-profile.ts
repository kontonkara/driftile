export interface ShortcutBinding {
  readonly key: number;
  readonly name: string;
  readonly sequence: string;
  readonly text: string;
}

interface ShortcutDefinition {
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

const definitions: readonly ShortcutDefinition[] = [
  {
    name: "driftile_focus_column_left",
    text: "Driftile: Focus left",
    sequence: "Meta+H",
  },
  {
    name: "driftile_focus_column_left_arrow",
    text: "Driftile: Focus left (arrow)",
    sequence: "Meta+Left",
  },
  {
    name: "driftile_focus_column_right",
    text: "Driftile: Focus right",
    sequence: "Meta+L",
  },
  {
    name: "driftile_focus_column_right_arrow",
    text: "Driftile: Focus right (arrow)",
    sequence: "Meta+Right",
  },
  {
    name: "driftile_focus_column_first",
    text: "Driftile: Focus first column",
    sequence: "Meta+Home",
  },
  {
    name: "driftile_focus_column_last",
    text: "Driftile: Focus last column",
    sequence: "Meta+End",
  },
  {
    name: "driftile_focus_window_up",
    text: "Driftile: Focus up",
    sequence: "Meta+K",
  },
  {
    name: "driftile_focus_window_up_arrow",
    text: "Driftile: Focus up (arrow)",
    sequence: "Meta+Up",
  },
  {
    name: "driftile_focus_window_down",
    text: "Driftile: Focus down",
    sequence: "Meta+J",
  },
  {
    name: "driftile_focus_window_down_arrow",
    text: "Driftile: Focus down (arrow)",
    sequence: "Meta+Down",
  },
  {
    name: "driftile_move_column_left",
    text: "Driftile: Move column left",
    sequence: "Meta+Ctrl+H",
  },
  {
    name: "driftile_move_column_left_arrow",
    text: "Driftile: Move column left (arrow)",
    sequence: "Meta+Ctrl+Left",
  },
  {
    name: "driftile_move_column_right",
    text: "Driftile: Move column right",
    sequence: "Meta+Ctrl+L",
  },
  {
    name: "driftile_move_column_right_arrow",
    text: "Driftile: Move column right (arrow)",
    sequence: "Meta+Ctrl+Right",
  },
  {
    name: "driftile_move_column_to_first",
    text: "Driftile: Move column to first",
    sequence: "Meta+Ctrl+Home",
  },
  {
    name: "driftile_move_column_to_last",
    text: "Driftile: Move column to last",
    sequence: "Meta+Ctrl+End",
  },
  {
    name: "driftile_move_window_left",
    text: "Driftile: Consume or expel window left",
    sequence: "Meta+[",
  },
  {
    name: "driftile_move_window_right",
    text: "Driftile: Consume or expel window right",
    sequence: "Meta+]",
  },
  {
    name: "driftile_consume_window_into_column",
    text: "Driftile: Consume window into column",
    sequence: "Meta+,",
  },
  {
    name: "driftile_expel_window_from_column",
    text: "Driftile: Expel window from column",
    sequence: "Meta+.",
  },
  {
    name: "driftile_move_window_up",
    text: "Driftile: Move window up",
    sequence: "Meta+Ctrl+K",
  },
  {
    name: "driftile_move_window_up_arrow",
    text: "Driftile: Move window up (arrow)",
    sequence: "Meta+Ctrl+Up",
  },
  {
    name: "driftile_move_window_down",
    text: "Driftile: Move window down",
    sequence: "Meta+Ctrl+J",
  },
  {
    name: "driftile_move_window_down_arrow",
    text: "Driftile: Move window down (arrow)",
    sequence: "Meta+Ctrl+Down",
  },
  {
    name: "driftile_toggle_floating",
    text: "Driftile: Toggle floating",
    sequence: "Meta+V",
  },
  {
    name: "driftile_switch_focus_between_floating_and_tiling",
    text: "Driftile: Switch focus between floating and tiling",
    sequence: "Meta+Shift+V",
  },
  {
    name: "driftile_toggle_fullscreen",
    text: "Driftile: Toggle fullscreen",
    sequence: "Meta+Shift+F",
  },
  {
    name: "driftile_maximize_window_to_edges",
    text: "Driftile: Maximize window to edges",
    sequence: "Meta+M",
  },
  {
    name: "driftile_focus_previous_desktop",
    text: "Driftile: Focus previous desktop",
    sequence: "Meta+I",
  },
  {
    name: "driftile_focus_previous_desktop_page_up",
    text: "Driftile: Focus previous desktop (Page Up)",
    sequence: "Meta+PgUp",
  },
  {
    name: "driftile_focus_next_desktop",
    text: "Driftile: Focus next desktop",
    sequence: "Meta+U",
  },
  {
    name: "driftile_focus_next_desktop_page_down",
    text: "Driftile: Focus next desktop (Page Down)",
    sequence: "Meta+PgDown",
  },
  {
    name: "driftile_move_column_to_previous_desktop",
    text: "Driftile: Move column to previous desktop",
    sequence: "Meta+Ctrl+I",
  },
  {
    name: "driftile_move_column_to_previous_desktop_page_up",
    text: "Driftile: Move column to previous desktop (Page Up)",
    sequence: "Meta+Ctrl+PgUp",
  },
  {
    name: "driftile_move_column_to_next_desktop",
    text: "Driftile: Move column to next desktop",
    sequence: "Meta+Ctrl+U",
  },
  {
    name: "driftile_move_column_to_next_desktop_page_down",
    text: "Driftile: Move column to next desktop (Page Down)",
    sequence: "Meta+Ctrl+PgDown",
  },
  {
    name: "driftile_focus_output_left",
    text: "Driftile: Focus output left",
    sequence: "Meta+Shift+H",
  },
  {
    name: "driftile_focus_output_left_arrow",
    text: "Driftile: Focus output left (arrow)",
    sequence: "Meta+Shift+Left",
  },
  {
    name: "driftile_focus_output_right",
    text: "Driftile: Focus output right",
    sequence: "Meta+Shift+L",
  },
  {
    name: "driftile_focus_output_right_arrow",
    text: "Driftile: Focus output right (arrow)",
    sequence: "Meta+Shift+Right",
  },
  {
    name: "driftile_focus_output_up",
    text: "Driftile: Focus output up",
    sequence: "Meta+Shift+K",
  },
  {
    name: "driftile_focus_output_up_arrow",
    text: "Driftile: Focus output up (arrow)",
    sequence: "Meta+Shift+Up",
  },
  {
    name: "driftile_focus_output_down",
    text: "Driftile: Focus output down",
    sequence: "Meta+Shift+J",
  },
  {
    name: "driftile_focus_output_down_arrow",
    text: "Driftile: Focus output down (arrow)",
    sequence: "Meta+Shift+Down",
  },
  {
    name: "driftile_move_column_to_output_left",
    text: "Driftile: Move column to output left",
    sequence: "Meta+Ctrl+Shift+H",
  },
  {
    name: "driftile_move_column_to_output_left_arrow",
    text: "Driftile: Move column to output left (arrow)",
    sequence: "Meta+Ctrl+Shift+Left",
  },
  {
    name: "driftile_move_column_to_output_right",
    text: "Driftile: Move column to output right",
    sequence: "Meta+Ctrl+Shift+L",
  },
  {
    name: "driftile_move_column_to_output_right_arrow",
    text: "Driftile: Move column to output right (arrow)",
    sequence: "Meta+Ctrl+Shift+Right",
  },
  {
    name: "driftile_move_column_to_output_up",
    text: "Driftile: Move column to output up",
    sequence: "Meta+Ctrl+Shift+K",
  },
  {
    name: "driftile_move_column_to_output_up_arrow",
    text: "Driftile: Move column to output up (arrow)",
    sequence: "Meta+Ctrl+Shift+Up",
  },
  {
    name: "driftile_move_column_to_output_down",
    text: "Driftile: Move column to output down",
    sequence: "Meta+Ctrl+Shift+J",
  },
  {
    name: "driftile_move_column_to_output_down_arrow",
    text: "Driftile: Move column to output down (arrow)",
    sequence: "Meta+Ctrl+Shift+Down",
  },
  {
    name: "driftile_switch_preset_column_width",
    text: "Driftile: Switch preset column width",
    sequence: "Meta+R",
  },
  {
    name: "driftile_switch_preset_column_width_back",
    text: "Driftile: Switch preset column width back",
    sequence: "Meta+Shift+R",
  },
  {
    name: "driftile_maximize_column",
    text: "Driftile: Maximize column",
    sequence: "Meta+F",
  },
  {
    name: "driftile_expand_column_to_available_width",
    text: "Driftile: Expand column to available width",
    sequence: "Meta+Ctrl+F",
  },
  {
    name: "driftile_center_column",
    text: "Driftile: Center column",
    sequence: "Meta+C",
  },
  {
    name: "driftile_center_visible_columns",
    text: "Driftile: Center visible columns",
    sequence: "Meta+Ctrl+C",
  },
  {
    name: "driftile_decrease_column_width",
    text: "Driftile: Decrease column width",
    sequence: "Meta+-",
  },
  {
    name: "driftile_increase_column_width",
    text: "Driftile: Increase column width",
    sequence: "Meta+=",
  },
  // KGlobalAccel matches shifted punctuation by its produced symbol.
  {
    name: "driftile_decrease_window_height",
    text: "Driftile: Decrease window height",
    sequence: "Meta+_",
  },
  {
    name: "driftile_increase_window_height",
    text: "Driftile: Increase window height",
    sequence: "Meta++",
  },
  {
    name: "driftile_switch_preset_window_height",
    text: "Driftile: Switch preset window height",
    sequence: "Meta+Ctrl+Shift+R",
  },
  {
    name: "driftile_reset_window_height",
    text: "Driftile: Reset window height",
    sequence: "Meta+Ctrl+R",
  },
];

export const shortcutBindings: readonly ShortcutBinding[] = definitions.map(
  (definition) => ({
    ...definition,
    key: encodeShortcut(definition.sequence),
  }),
);

export const shortcutProfileId = shortcutBindings
  .map((binding) => `${binding.name}:${String(binding.key)}`)
  .join("|");

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
