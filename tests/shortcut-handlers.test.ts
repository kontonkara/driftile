import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortcutBindings } from "../src/shortcut-profile";

interface ShortcutHandler {
  readonly activated: string;
  readonly name: string;
  readonly sequence?: string;
}

const qml = readFileSync(
  new URL("../packaging/kwin-script/contents/ui/main.qml", import.meta.url),
  "utf8",
);
const configuration = readFileSync(
  new URL("../packaging/kwin-script/contents/config/main.xml", import.meta.url),
  "utf8",
);
const configurationUi = readFileSync(
  new URL("../packaging/kwin-script/contents/ui/config.ui", import.meta.url),
  "utf8",
);
const metadata = JSON.parse(
  readFileSync(
    new URL("../packaging/kwin-script/metadata.json", import.meta.url),
    "utf8",
  ),
) as Readonly<Record<string, unknown>>;
const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { readonly scripts?: Readonly<Record<string, string>> };

const expectedHandlers: Readonly<
  Record<string, Omit<ShortcutHandler, "name">>
> = {
  driftile_center_column: {
    activated: "Runtime.DriftileRuntime.centerColumn()",
    sequence: "Meta+C",
  },
  driftile_center_visible_columns: {
    activated: "Runtime.DriftileRuntime.centerVisibleColumns()",
    sequence: "Meta+Ctrl+C",
  },
  driftile_decrease_column_width: {
    activated: "Runtime.DriftileRuntime.decreaseColumnWidth()",
    sequence: "Meta+-",
  },
  driftile_focus_column_left: {
    activated: "Runtime.DriftileRuntime.focusLeft()",
    sequence: "Meta+H",
  },
  driftile_focus_column_left_arrow: {
    activated: "Runtime.DriftileRuntime.focusLeft()",
    sequence: "Meta+Left",
  },
  driftile_focus_column_first: {
    activated: "Runtime.DriftileRuntime.focusFirstColumn()",
    sequence: "Meta+Home",
  },
  driftile_focus_column_last: {
    activated: "Runtime.DriftileRuntime.focusLastColumn()",
    sequence: "Meta+End",
  },
  driftile_focus_column_right: {
    activated: "Runtime.DriftileRuntime.focusRight()",
    sequence: "Meta+L",
  },
  driftile_focus_column_right_arrow: {
    activated: "Runtime.DriftileRuntime.focusRight()",
    sequence: "Meta+Right",
  },
  driftile_focus_floating: {
    activated: "Runtime.DriftileRuntime.focusFloating()",
  },
  driftile_focus_next_desktop: {
    activated: "Runtime.DriftileRuntime.focusNextDesktop()",
    sequence: "Meta+U",
  },
  driftile_focus_next_desktop_page_down: {
    activated: "Runtime.DriftileRuntime.focusNextDesktop()",
    sequence: "Meta+PgDown",
  },
  driftile_focus_output_down: {
    activated: "Workspace.slotSwitchToBelowScreen()",
    sequence: "Meta+Shift+J",
  },
  driftile_focus_output_down_arrow: {
    activated: "Workspace.slotSwitchToBelowScreen()",
    sequence: "Meta+Shift+Down",
  },
  driftile_focus_output_left: {
    activated: "Workspace.slotSwitchToLeftScreen()",
    sequence: "Meta+Shift+H",
  },
  driftile_focus_output_left_arrow: {
    activated: "Workspace.slotSwitchToLeftScreen()",
    sequence: "Meta+Shift+Left",
  },
  driftile_focus_output_right: {
    activated: "Workspace.slotSwitchToRightScreen()",
    sequence: "Meta+Shift+L",
  },
  driftile_focus_output_right_arrow: {
    activated: "Workspace.slotSwitchToRightScreen()",
    sequence: "Meta+Shift+Right",
  },
  driftile_focus_output_up: {
    activated: "Workspace.slotSwitchToAboveScreen()",
    sequence: "Meta+Shift+K",
  },
  driftile_focus_output_up_arrow: {
    activated: "Workspace.slotSwitchToAboveScreen()",
    sequence: "Meta+Shift+Up",
  },
  driftile_focus_previous_desktop: {
    activated: "Runtime.DriftileRuntime.focusPreviousDesktop()",
    sequence: "Meta+I",
  },
  driftile_focus_previous_desktop_page_up: {
    activated: "Runtime.DriftileRuntime.focusPreviousDesktop()",
    sequence: "Meta+PgUp",
  },
  driftile_focus_tiling: {
    activated: "Runtime.DriftileRuntime.focusTiling()",
  },
  driftile_focus_window_down: {
    activated: "Runtime.DriftileRuntime.focusDown()",
    sequence: "Meta+J",
  },
  driftile_focus_window_down_arrow: {
    activated: "Runtime.DriftileRuntime.focusDown()",
    sequence: "Meta+Down",
  },
  driftile_focus_window_up: {
    activated: "Runtime.DriftileRuntime.focusUp()",
    sequence: "Meta+K",
  },
  driftile_focus_window_up_arrow: {
    activated: "Runtime.DriftileRuntime.focusUp()",
    sequence: "Meta+Up",
  },
  driftile_increase_column_width: {
    activated: "Runtime.DriftileRuntime.increaseColumnWidth()",
    sequence: "Meta+=",
  },
  driftile_decrease_window_height: {
    activated: "Runtime.DriftileRuntime.decreaseWindowHeight()",
    sequence: "Meta+_",
  },
  driftile_increase_window_height: {
    activated: "Runtime.DriftileRuntime.increaseWindowHeight()",
    sequence: "Meta++",
  },
  driftile_insert_window_into_stack_left: {
    activated: "Runtime.DriftileRuntime.insertWindowIntoStackLeft()",
  },
  driftile_insert_window_into_stack_right: {
    activated: "Runtime.DriftileRuntime.insertWindowIntoStackRight()",
  },
  driftile_maximize_column: {
    activated: "Runtime.DriftileRuntime.maximizeColumn()",
    sequence: "Meta+F",
  },
  driftile_maximize_window_to_edges: {
    activated: "Runtime.DriftileRuntime.maximizeWindowToEdges()",
    sequence: "Meta+M",
  },
  driftile_expand_column_to_available_width: {
    activated: "Runtime.DriftileRuntime.expandColumnToAvailableWidth()",
    sequence: "Meta+Ctrl+F",
  },
  driftile_move_column_left: {
    activated: "Runtime.DriftileRuntime.moveColumnLeft()",
    sequence: "Meta+Ctrl+H",
  },
  driftile_move_column_left_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnLeft()",
    sequence: "Meta+Ctrl+Left",
  },
  driftile_move_column_right: {
    activated: "Runtime.DriftileRuntime.moveColumnRight()",
    sequence: "Meta+Ctrl+L",
  },
  driftile_move_column_right_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnRight()",
    sequence: "Meta+Ctrl+Right",
  },
  driftile_move_column_to_first: {
    activated: "Runtime.DriftileRuntime.moveColumnToFirst()",
    sequence: "Meta+Ctrl+Home",
  },
  driftile_move_column_to_last: {
    activated: "Runtime.DriftileRuntime.moveColumnToLast()",
    sequence: "Meta+Ctrl+End",
  },
  driftile_move_column_to_next_desktop: {
    activated: "Runtime.DriftileRuntime.moveColumnToNextDesktop()",
    sequence: "Meta+Ctrl+U",
  },
  driftile_move_column_to_next_desktop_page_down: {
    activated: "Runtime.DriftileRuntime.moveColumnToNextDesktop()",
    sequence: "Meta+Ctrl+PgDown",
  },
  driftile_move_column_to_output_down: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputDown()",
    sequence: "Meta+Ctrl+Shift+J",
  },
  driftile_move_column_to_output_down_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputDown()",
    sequence: "Meta+Ctrl+Shift+Down",
  },
  driftile_move_column_to_output_left: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputLeft()",
    sequence: "Meta+Ctrl+Shift+H",
  },
  driftile_move_column_to_output_left_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputLeft()",
    sequence: "Meta+Ctrl+Shift+Left",
  },
  driftile_move_column_to_output_right: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputRight()",
    sequence: "Meta+Ctrl+Shift+L",
  },
  driftile_move_column_to_output_right_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputRight()",
    sequence: "Meta+Ctrl+Shift+Right",
  },
  driftile_move_column_to_output_up: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputUp()",
    sequence: "Meta+Ctrl+Shift+K",
  },
  driftile_move_column_to_output_up_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnToOutputUp()",
    sequence: "Meta+Ctrl+Shift+Up",
  },
  driftile_move_column_to_previous_desktop: {
    activated: "Runtime.DriftileRuntime.moveColumnToPreviousDesktop()",
    sequence: "Meta+Ctrl+I",
  },
  driftile_move_column_to_previous_desktop_page_up: {
    activated: "Runtime.DriftileRuntime.moveColumnToPreviousDesktop()",
    sequence: "Meta+Ctrl+PgUp",
  },
  driftile_move_window_down: {
    activated: "Runtime.DriftileRuntime.moveWindowDown()",
    sequence: "Meta+Ctrl+J",
  },
  driftile_move_window_down_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowDown()",
    sequence: "Meta+Ctrl+Down",
  },
  driftile_move_window_left: {
    activated: "Runtime.DriftileRuntime.moveWindowLeft()",
    sequence: "Meta+[",
  },
  driftile_move_window_right: {
    activated: "Runtime.DriftileRuntime.moveWindowRight()",
    sequence: "Meta+]",
  },
  driftile_move_window_to_next_desktop: {
    activated: "Runtime.DriftileRuntime.moveWindowToNextDesktop()",
  },
  driftile_move_window_to_next_desktop_page_down: {
    activated: "Runtime.DriftileRuntime.moveWindowToNextDesktop()",
  },
  driftile_move_window_to_output_down: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputDown()",
  },
  driftile_move_window_to_output_down_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputDown()",
  },
  driftile_move_window_to_output_left: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputLeft()",
  },
  driftile_move_window_to_output_left_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputLeft()",
  },
  driftile_move_window_to_output_right: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputRight()",
  },
  driftile_move_window_to_output_right_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputRight()",
  },
  driftile_move_window_to_output_up: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputUp()",
  },
  driftile_move_window_to_output_up_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputUp()",
  },
  driftile_move_window_to_previous_desktop: {
    activated: "Runtime.DriftileRuntime.moveWindowToPreviousDesktop()",
  },
  driftile_move_window_to_previous_desktop_page_up: {
    activated: "Runtime.DriftileRuntime.moveWindowToPreviousDesktop()",
  },
  driftile_move_window_up: {
    activated: "Runtime.DriftileRuntime.moveWindowUp()",
    sequence: "Meta+Ctrl+K",
  },
  driftile_move_window_up_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowUp()",
    sequence: "Meta+Ctrl+Up",
  },
  driftile_reset_column_width: {
    activated: "Runtime.DriftileRuntime.resetColumnWidth()",
  },
  driftile_reset_window_height: {
    activated: "Runtime.DriftileRuntime.resetWindowHeight()",
    sequence: "Meta+Ctrl+R",
  },
  driftile_switch_focus_between_floating_and_tiling: {
    activated: "Runtime.DriftileRuntime.switchFocusBetweenFloatingAndTiling()",
    sequence: "Meta+Shift+V",
  },
  driftile_switch_preset_column_width: {
    activated: "Runtime.DriftileRuntime.switchPresetColumnWidth()",
    sequence: "Meta+R",
  },
  driftile_switch_preset_column_width_back: {
    activated: "Runtime.DriftileRuntime.switchPresetColumnWidthBack()",
    sequence: "Meta+Shift+R",
  },
  driftile_switch_preset_window_height: {
    activated: "Runtime.DriftileRuntime.switchPresetWindowHeight()",
    sequence: "Meta+Ctrl+Shift+R",
  },
  driftile_switch_preset_window_height_back: {
    activated: "Runtime.DriftileRuntime.switchPresetWindowHeightBack()",
  },
  driftile_toggle_floating: {
    activated: "Runtime.DriftileRuntime.toggleFloating()",
    sequence: "Meta+V",
  },
  driftile_toggle_fullscreen: {
    activated: "Runtime.DriftileRuntime.toggleFullscreen()",
    sequence: "Meta+Shift+F",
  },
};

describe("KWin shortcut handlers", () => {
  const handlers = parseShortcutHandlers(qml);

  it("registers the expected stable actions and bindings", () => {
    expect(
      Object.fromEntries(
        handlers.map(({ name, ...handler }) => [name, handler]),
      ),
    ).toEqual(expectedHandlers);
  });

  it("uses unique lowercase action identifiers and key sequences", () => {
    const names = handlers.map((handler) => handler.name);
    const sequences = handlers.flatMap((handler) =>
      handler.sequence ? [handler.sequence] : [],
    );

    expect(names).toHaveLength(new Set(names).size);
    expect(sequences).toHaveLength(new Set(sequences).size);

    for (const name of names) {
      expect(name).toMatch(/^driftile_[a-z0-9_]+$/);
    }
  });

  it("keeps the claimable profile synchronized with QML", () => {
    const claimableHandlers = handlers.flatMap((handler) =>
      handler.sequence
        ? [{ name: handler.name, sequence: handler.sequence }]
        : [],
    );

    expect(claimableHandlers).toEqual(
      shortcutBindings.map(({ name, sequence }) => ({ name, sequence })),
    );

    for (const binding of shortcutBindings) {
      const block = shortcutHandlerBlock(qml, binding.name);
      expect(stringProperty(block, "text")).toBe(binding.text);
    }
  });

  it("leaves operations without an equivalent default unbound", () => {
    expect(
      handlers
        .filter((handler) => handler.sequence === undefined)
        .map((handler) => handler.name)
        .sort(),
    ).toEqual([
      "driftile_focus_floating",
      "driftile_focus_tiling",
      "driftile_insert_window_into_stack_left",
      "driftile_insert_window_into_stack_right",
      "driftile_move_window_to_next_desktop",
      "driftile_move_window_to_next_desktop_page_down",
      "driftile_move_window_to_output_down",
      "driftile_move_window_to_output_down_arrow",
      "driftile_move_window_to_output_left",
      "driftile_move_window_to_output_left_arrow",
      "driftile_move_window_to_output_right",
      "driftile_move_window_to_output_right_arrow",
      "driftile_move_window_to_output_up",
      "driftile_move_window_to_output_up_arrow",
      "driftile_move_window_to_previous_desktop",
      "driftile_move_window_to_previous_desktop_page_up",
      "driftile_reset_column_width",
      "driftile_switch_preset_window_height_back",
    ]);
  });

  it("releases a saved shortcut profile before a development upgrade", () => {
    expect(packageMetadata.scripts?.["upgrade:dev"]).toBe(
      "npm run shortcuts:release && node tools/install.mjs upgrade",
    );
  });

  it("exposes borderless windows as a user setting", () => {
    expect(metadata["X-KDE-ConfigModule"]).toBe(
      "kwin/effects/configs/kcm_kwin4_genericscripted",
    );
    expect(configuration).toContain('name="BorderlessWindows"');
    expect(configuration).toContain('<group name="">');
    expect(configuration).toContain("<default>true</default>");
    expect(configurationUi).toContain('name="kcfg_BorderlessWindows"');
    expect(qml).toContain('KWin.readConfig("BorderlessWindows", true)');
    expect(qml).toContain("function onConfigChanged()");
    expect(qml).toContain("setBorderlessWindows(");
  });
});

function parseShortcutHandlers(source: string): ShortcutHandler[] {
  const blockPattern =
    /^\s*readonly property ShortcutHandler \w+: ShortcutHandler \{([\s\S]*?)^\s{4}\}/gm;
  const handlers: ShortcutHandler[] = [];

  for (const match of source.matchAll(blockPattern)) {
    const block = match[1];

    if (!block) {
      continue;
    }

    const name = stringProperty(block, "name");
    const sequence = stringProperty(block, "sequence", false);
    const activated = block.match(/^\s*onActivated:\s*(\S.*)$/m)?.[1];

    if (!name || !activated) {
      throw new Error("ShortcutHandler requires name and onActivated");
    }

    handlers.push({
      activated,
      name,
      ...(sequence ? { sequence } : {}),
    });
  }

  return handlers;
}

function shortcutHandlerBlock(source: string, name: string): string {
  const blockPattern =
    /^\s*readonly property ShortcutHandler \w+: ShortcutHandler \{([\s\S]*?)^\s{4}\}/gm;

  for (const match of source.matchAll(blockPattern)) {
    const block = match[1];

    if (block && stringProperty(block, "name") === name) {
      return block;
    }
  }

  throw new Error(`ShortcutHandler not found: ${name}`);
}

function stringProperty(
  block: string,
  property: string,
  required = true,
): string | undefined {
  const value = block.match(
    new RegExp(`^\\s*${property}:\\s*"([^"]+)"$`, "m"),
  )?.[1];

  if (required && !value) {
    throw new Error(`ShortcutHandler requires ${property}`);
  }

  return value;
}
