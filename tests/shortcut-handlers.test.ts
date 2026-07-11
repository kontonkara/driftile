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
const runtime = readFileSync(
  new URL("../src/runtime.ts", import.meta.url),
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
  driftile_consume_window_into_column: {
    activated: "Runtime.DriftileRuntime.consumeWindowIntoColumn()",
    sequence: "Meta+,",
  },
  driftile_decrease_column_width: {
    activated: "Runtime.DriftileRuntime.decreaseColumnWidth()",
    sequence: "Meta+-",
  },
  driftile_expel_window_from_column: {
    activated: "Runtime.DriftileRuntime.expelWindowFromColumn()",
    sequence: "Meta+.",
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
  driftile_focus_desktop_1: {
    activated: "Runtime.DriftileRuntime.focusDesktop(1)",
    sequence: "Meta+1",
  },
  driftile_focus_desktop_2: {
    activated: "Runtime.DriftileRuntime.focusDesktop(2)",
    sequence: "Meta+2",
  },
  driftile_focus_desktop_3: {
    activated: "Runtime.DriftileRuntime.focusDesktop(3)",
    sequence: "Meta+3",
  },
  driftile_focus_desktop_4: {
    activated: "Runtime.DriftileRuntime.focusDesktop(4)",
    sequence: "Meta+4",
  },
  driftile_focus_desktop_5: {
    activated: "Runtime.DriftileRuntime.focusDesktop(5)",
    sequence: "Meta+5",
  },
  driftile_focus_desktop_6: {
    activated: "Runtime.DriftileRuntime.focusDesktop(6)",
    sequence: "Meta+6",
  },
  driftile_focus_desktop_7: {
    activated: "Runtime.DriftileRuntime.focusDesktop(7)",
    sequence: "Meta+7",
  },
  driftile_focus_desktop_8: {
    activated: "Runtime.DriftileRuntime.focusDesktop(8)",
    sequence: "Meta+8",
  },
  driftile_focus_desktop_9: {
    activated: "Runtime.DriftileRuntime.focusDesktop(9)",
    sequence: "Meta+9",
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
  driftile_move_desktop_down: {
    activated: "Runtime.DriftileRuntime.moveDesktopDown()",
    sequence: "Meta+Shift+U",
  },
  driftile_move_desktop_down_page_down: {
    activated: "Runtime.DriftileRuntime.moveDesktopDown()",
    sequence: "Meta+Shift+PgDown",
  },
  driftile_move_desktop_up: {
    activated: "Runtime.DriftileRuntime.moveDesktopUp()",
    sequence: "Meta+Shift+I",
  },
  driftile_move_desktop_up_page_up: {
    activated: "Runtime.DriftileRuntime.moveDesktopUp()",
    sequence: "Meta+Shift+PgUp",
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
  driftile_move_column_to_desktop_1: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(1)",
    sequence: "Meta+Ctrl+1",
  },
  driftile_move_column_to_desktop_2: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(2)",
    sequence: "Meta+Ctrl+2",
  },
  driftile_move_column_to_desktop_3: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(3)",
    sequence: "Meta+Ctrl+3",
  },
  driftile_move_column_to_desktop_4: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(4)",
    sequence: "Meta+Ctrl+4",
  },
  driftile_move_column_to_desktop_5: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(5)",
    sequence: "Meta+Ctrl+5",
  },
  driftile_move_column_to_desktop_6: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(6)",
    sequence: "Meta+Ctrl+6",
  },
  driftile_move_column_to_desktop_7: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(7)",
    sequence: "Meta+Ctrl+7",
  },
  driftile_move_column_to_desktop_8: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(8)",
    sequence: "Meta+Ctrl+8",
  },
  driftile_move_column_to_desktop_9: {
    activated: "Runtime.DriftileRuntime.moveColumnToDesktop(9)",
    sequence: "Meta+Ctrl+9",
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

  it("exposes the window gap as a live bounded user setting", () => {
    const gapEntry = configuration.match(
      /<entry name="Gap" type="Int">([\s\S]*?)<\/entry>/,
    )?.[1];
    const gapWidget = configurationUi.match(
      /<widget class="QSpinBox" name="kcfg_Gap">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(gapEntry).toContain("<label>Window gap in logical pixels</label>");
    expect(gapEntry).toContain("<default>16</default>");
    expect(gapEntry).toContain("<min>0</min>");
    expect(gapEntry).toContain("<max>64</max>");
    expect(configurationUi).toContain("<string>Window gap:</string>");
    expect(gapWidget).toContain("<string> px</string>");
    expect(gapWidget).toMatch(
      /<property name="maximum">\s*<number>64<\/number>/,
    );
    expect(gapWidget).toMatch(/<property name="value">\s*<number>16<\/number>/);
    expect(qml.match(/KWin\.readConfig\("Gap", 16\)/g)).toHaveLength(2);
    expect(qml).toContain(
      'Runtime.DriftileRuntime.setGap(KWin.readConfig("Gap", 16))',
    );
  });

  it("exposes the default column width as a live bounded user setting", () => {
    const widthEntry = configuration.match(
      /<entry name="DefaultColumnWidthPercent" type="Int">([\s\S]*?)<\/entry>/,
    )?.[1];
    const widthLabel = configurationUi.match(
      /<widget class="QLabel" name="defaultColumnWidthLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const widthWidget = configurationUi.match(
      /<widget class="QSpinBox" name="kcfg_DefaultColumnWidthPercent">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(widthEntry).toContain(
      "<label>Default column width in percent</label>",
    );
    expect(widthEntry).toContain("<default>50</default>");
    expect(widthEntry).toContain("<min>10</min>");
    expect(widthEntry).toContain("<max>100</max>");
    expect(widthLabel).toContain("<string>Default column width:</string>");
    expect(widthLabel).toContain(
      "<cstring>kcfg_DefaultColumnWidthPercent</cstring>",
    );
    expect(widthWidget).toContain("<string> %</string>");
    expect(widthWidget).toMatch(
      /<property name="minimum">\s*<number>10<\/number>/,
    );
    expect(widthWidget).toMatch(
      /<property name="maximum">\s*<number>100<\/number>/,
    );
    expect(widthWidget).toMatch(
      /<property name="value">\s*<number>50<\/number>/,
    );
    expect(
      qml.match(/KWin\.readConfig\("DefaultColumnWidthPercent", 50\)/g),
    ).toHaveLength(2);
    expect(qml).toMatch(
      /Runtime\.DriftileRuntime\.setDefaultColumnWidthPercent\(\s*KWin\.readConfig\("DefaultColumnWidthPercent", 50\)\)/,
    );
  });

  it("exposes the column width step as a live bounded user setting", () => {
    const stepEntry = configuration.match(
      /<entry name="ColumnWidthStepPercent" type="Int">([\s\S]*?)<\/entry>/,
    )?.[1];
    const stepLabel = configurationUi.match(
      /<widget class="QLabel" name="columnWidthStepLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const stepWidget = configurationUi.match(
      /<widget class="QSpinBox" name="kcfg_ColumnWidthStepPercent">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(stepEntry).toContain("<label>Column width step in percent</label>");
    expect(stepEntry).toContain("<default>10</default>");
    expect(stepEntry).toContain("<min>1</min>");
    expect(stepEntry).toContain("<max>50</max>");
    expect(stepLabel).toContain("<string>Column width step:</string>");
    expect(stepLabel).toContain(
      "<cstring>kcfg_ColumnWidthStepPercent</cstring>",
    );
    expect(stepWidget).toContain("<string> %</string>");
    expect(stepWidget).toMatch(
      /<property name="minimum">\s*<number>1<\/number>/,
    );
    expect(stepWidget).toMatch(
      /<property name="maximum">\s*<number>50<\/number>/,
    );
    expect(stepWidget).toMatch(
      /<property name="value">\s*<number>10<\/number>/,
    );
    expect(
      qml.match(/KWin\.readConfig\("ColumnWidthStepPercent", 10\)/g),
    ).toHaveLength(2);
    expect(qml).toMatch(
      /Runtime\.DriftileRuntime\.setColumnWidthStepPercent\(\s*KWin\.readConfig\("ColumnWidthStepPercent", 10\)\)/,
    );
    expect(qml).toMatch(
      /KWin\.readConfig\("DefaultColumnWidthPercent", 50\),\s*KWin\.readConfig\("ColumnWidthStepPercent", 10\)\)/,
    );
    expect(runtime).toMatch(
      /nextController\.setDefaultColumnWidthPercent\(defaultColumnWidthPercent\);\s*nextController\.setColumnWidthStepPercent\(columnWidthStepPercent\);\s*if \(!nextController\.start\(\)\)/,
    );
    expect(runtime).toMatch(
      /export function setColumnWidthStepPercent\(percent: number\): void \{\s*controller\?\.setColumnWidthStepPercent\(percent\);\s*\}/,
    );
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
