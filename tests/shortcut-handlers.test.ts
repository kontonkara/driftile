import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_DRIFTILE_SETTINGS } from "../src/settings";
import { shortcutActions } from "../src/shortcut-actions";
import {
  encodeShortcut,
  shortcutBindings,
  shortcutProfileId,
} from "../src/shortcut-profile";

interface ShortcutHandler {
  readonly activated: string;
  readonly name: string;
  readonly sequence?: string;
  readonly text: string;
}

const bootstrapQml = readFileSync(
  new URL("../packaging/kwin-script/contents/ui/main.qml", import.meta.url),
  "utf8",
);
const qml = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/main.qml",
    import.meta.url,
  ),
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
  Record<string, Pick<ShortcutHandler, "activated" | "sequence">>
> = {
  driftile_close_window: {
    activated: "Workspace.slotWindowClose()",
    sequence: "Meta+Q",
  },
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
  driftile_focus_column_or_output_left: {
    activated: "Runtime.DriftileRuntime.focusColumnOrOutputLeft()",
  },
  driftile_focus_column_or_output_right: {
    activated: "Runtime.DriftileRuntime.focusColumnOrOutputRight()",
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
  driftile_focus_last_used_desktop: {
    activated: "Runtime.DriftileRuntime.focusLastUsedDesktop()",
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
  driftile_focus_window_down_or_next_desktop: {
    activated: "Runtime.DriftileRuntime.focusDownOrNextDesktop()",
  },
  driftile_focus_window_down_or_output_down: {
    activated: "Runtime.DriftileRuntime.focusWindowOrOutputDown()",
  },
  driftile_focus_window_up: {
    activated: "Runtime.DriftileRuntime.focusUp()",
    sequence: "Meta+K",
  },
  driftile_focus_window_up_arrow: {
    activated: "Runtime.DriftileRuntime.focusUp()",
    sequence: "Meta+Up",
  },
  driftile_focus_window_up_or_previous_desktop: {
    activated: "Runtime.DriftileRuntime.focusUpOrPreviousDesktop()",
  },
  driftile_focus_window_up_or_output_up: {
    activated: "Runtime.DriftileRuntime.focusWindowOrOutputUp()",
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
  driftile_toggle_column_tabbed_display: {
    activated: "Runtime.DriftileRuntime.toggleColumnTabbedDisplay()",
    sequence: "Meta+W",
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
  driftile_move_column_left_or_to_output_left: {
    activated: "Runtime.DriftileRuntime.moveColumnLeftOrToOutputLeft()",
  },
  driftile_move_column_right: {
    activated: "Runtime.DriftileRuntime.moveColumnRight()",
    sequence: "Meta+Ctrl+L",
  },
  driftile_move_column_right_arrow: {
    activated: "Runtime.DriftileRuntime.moveColumnRight()",
    sequence: "Meta+Ctrl+Right",
  },
  driftile_move_column_right_or_to_output_right: {
    activated: "Runtime.DriftileRuntime.moveColumnRightOrToOutputRight()",
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
  driftile_move_window_down_or_to_next_desktop: {
    activated: "Runtime.DriftileRuntime.moveWindowDownOrToNextDesktop()",
  },
  driftile_move_window_down_or_to_output_down: {
    activated: "Runtime.DriftileRuntime.moveWindowDownOrToOutputDown()",
  },
  driftile_move_window_left: {
    activated: "Runtime.DriftileRuntime.moveWindowLeft()",
    sequence: "Meta+[",
  },
  driftile_move_window_right: {
    activated: "Runtime.DriftileRuntime.moveWindowRight()",
    sequence: "Meta+]",
  },
  driftile_move_window_to_desktop_1: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(1)",
  },
  driftile_move_window_to_desktop_2: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(2)",
  },
  driftile_move_window_to_desktop_3: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(3)",
  },
  driftile_move_window_to_desktop_4: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(4)",
  },
  driftile_move_window_to_desktop_5: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(5)",
  },
  driftile_move_window_to_desktop_6: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(6)",
  },
  driftile_move_window_to_desktop_7: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(7)",
  },
  driftile_move_window_to_desktop_8: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(8)",
  },
  driftile_move_window_to_desktop_9: {
    activated: "Runtime.DriftileRuntime.moveWindowToDesktop(9)",
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
  driftile_move_window_up_or_to_previous_desktop: {
    activated: "Runtime.DriftileRuntime.moveWindowUpOrToPreviousDesktop()",
  },
  driftile_move_window_up_or_to_output_up: {
    activated: "Runtime.DriftileRuntime.moveWindowUpOrToOutputUp()",
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

  it("keeps the fixed entry point as a cache-busting runtime bootstrap", () => {
    expect(
      createHash("sha256").update(bootstrapQml, "utf8").digest("hex"),
    ).toBe("8f2a26ad1cff5b42177ac90406dab017f8aa7d5bd87ca72889c1405ed52af7f2");
    expect(bootstrapQml).toContain("QtObject {");
    expect(bootstrapQml).toContain("Date.now().toString(36)");
    expect(bootstrapQml).toContain("Math.random().toString(36).slice(2)");
    expect(bootstrapQml).toContain('Qt.resolvedUrl("../runtime/selector.qml")');
    expect(bootstrapQml.match(/\bLoader\s*\{/gu)).toHaveLength(1);
    expect(bootstrapQml).not.toMatch(
      /ShortcutHandler|DriftileRuntime|Workspace|readConfig/u,
    );
  });

  it("registers the expected stable actions and bindings", () => {
    expect(
      Object.fromEntries(
        handlers.map(({ activated, name, sequence }) => [
          name,
          {
            activated,
            ...(sequence === undefined ? {} : { sequence }),
          },
        ]),
      ),
    ).toEqual(expectedHandlers);
  });

  it("keeps the canonical action catalog synchronized with QML", () => {
    expect(shortcutActions).toHaveLength(128);
    expect(shortcutActions).toEqual(
      handlers.map(({ name, sequence, text }) => ({
        name,
        text,
        ...(sequence === undefined ? {} : { defaultSequence: sequence }),
      })),
    );
    expect(
      shortcutActions.filter((action) => action.defaultSequence !== undefined),
    ).toHaveLength(88);
    expect(
      shortcutActions.filter((action) => action.defaultSequence === undefined),
    ).toHaveLength(40);
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

    expect(shortcutBindings).toHaveLength(88);
    expect(shortcutBindings).toEqual(
      shortcutActions.flatMap((action) =>
        action.defaultSequence === undefined
          ? []
          : [
              {
                key: encodeShortcut(action.defaultSequence),
                name: action.name,
                sequence: action.defaultSequence,
                text: action.text,
              },
            ],
      ),
    );
    expect(shortcutProfileId).toHaveLength(3684);
    expect(
      createHash("sha256").update(shortcutProfileId, "utf8").digest("hex"),
    ).toBe("5b6ad4e1b9cb9ba8bc57b931f6d20d72fec7c86bd38320ea460aec49ad2cdf59");
  });

  it("leaves operations without an equivalent default unbound", () => {
    expect(
      handlers
        .filter((handler) => handler.sequence === undefined)
        .map((handler) => handler.name)
        .sort(),
    ).toEqual([
      "driftile_focus_column_or_output_left",
      "driftile_focus_column_or_output_right",
      "driftile_focus_floating",
      "driftile_focus_last_used_desktop",
      "driftile_focus_tiling",
      "driftile_focus_window_down_or_next_desktop",
      "driftile_focus_window_down_or_output_down",
      "driftile_focus_window_up_or_output_up",
      "driftile_focus_window_up_or_previous_desktop",
      "driftile_insert_window_into_stack_left",
      "driftile_insert_window_into_stack_right",
      "driftile_move_column_left_or_to_output_left",
      "driftile_move_column_right_or_to_output_right",
      "driftile_move_window_down_or_to_next_desktop",
      "driftile_move_window_down_or_to_output_down",
      "driftile_move_window_to_desktop_1",
      "driftile_move_window_to_desktop_2",
      "driftile_move_window_to_desktop_3",
      "driftile_move_window_to_desktop_4",
      "driftile_move_window_to_desktop_5",
      "driftile_move_window_to_desktop_6",
      "driftile_move_window_to_desktop_7",
      "driftile_move_window_to_desktop_8",
      "driftile_move_window_to_desktop_9",
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
      "driftile_move_window_up_or_to_output_up",
      "driftile_move_window_up_or_to_previous_desktop",
      "driftile_reset_column_width",
      "driftile_switch_preset_window_height_back",
    ]);
  });

  it("routes development upgrades through the safe package lifecycle", () => {
    expect(packageMetadata.scripts?.["upgrade:dev"]).toBe(
      "node tools/install.mjs upgrade",
    );
  });

  it("points shortcut configuration to the native KDE editor", () => {
    expect(configurationUi).toContain('name="shortcutConfigurationHint"');
    expect(configurationUi).toContain(
      "Configure keyboard shortcuts in System Settings &gt; Keyboard &gt; Shortcuts.",
    );
  });

  it("groups the existing settings into ordered general and applications tabs", () => {
    const settingsTabsStart = configurationUi.indexOf(
      '<widget class="QTabWidget" name="settingsTabs">',
    );
    const generalTabStart = configurationUi.indexOf(
      '<widget class="QWidget" name="generalTab">',
      settingsTabsStart,
    );
    const applicationsTabStart = configurationUi.indexOf(
      '<widget class="QWidget" name="applicationsTab">',
      generalTabStart,
    );
    const controlNames = (section: string): readonly string[] =>
      Array.from(
        section.matchAll(/<widget\b[^>]*\bname="(kcfg_[^"]+)"/g),
        (match) => match[1] ?? "",
      );
    const generalControls = [
      "kcfg_BorderlessWindows",
      "kcfg_CenterFocusedColumn",
      "kcfg_ShowTabIndicator",
      "kcfg_TouchpadNavigation",
      "kcfg_TouchpadWorkspaceNavigation",
      "kcfg_TouchpadNavigationFingerCount",
      "kcfg_TouchpadNaturalScroll",
      "kcfg_Gap",
      "kcfg_DefaultColumnPresentation",
      "kcfg_DefaultColumnWidthPercent",
      "kcfg_ColumnWidthStepPercent",
      "kcfg_ColumnWidthPresets",
      "kcfg_WindowHeightStepPercent",
      "kcfg_WindowHeightPresets",
    ];
    const applicationControls = [
      "kcfg_ApplicationColumnPresentations",
      "kcfg_ApplicationColumnWidths",
      "kcfg_ApplicationFocusCentering",
      "kcfg_ApplicationInitialFloating",
      "kcfg_ApplicationTilingExclusions",
      "kcfg_ApplicationBorderlessExclusions",
    ];

    expect(settingsTabsStart).toBeGreaterThan(-1);
    expect(generalTabStart).toBeGreaterThan(settingsTabsStart);
    expect(applicationsTabStart).toBeGreaterThan(generalTabStart);

    const generalTab = configurationUi.slice(
      generalTabStart,
      applicationsTabStart,
    );
    const applicationsTab = configurationUi.slice(applicationsTabStart);

    expect(generalTab).toMatch(
      /<attribute name="title">\s*<string>General<\/string>/,
    );
    expect(applicationsTab).toMatch(
      /<attribute name="title">\s*<string>Applications<\/string>/,
    );
    expect(controlNames(generalTab)).toEqual(generalControls);
    expect(controlNames(applicationsTab)).toEqual(applicationControls);
    expect(controlNames(configurationUi)).toEqual([
      ...generalControls,
      ...applicationControls,
    ]);
  });

  it("exposes borderless windows as a user setting", () => {
    expect(metadata["X-KDE-ConfigModule"]).toBe(
      "kwin/effects/configs/kcm_kwin4_genericscripted",
    );
    expect(configuration).toContain('name="BorderlessWindows"');
    expect(configuration).toContain('<group name="">');
    expect(configuration).toContain("<default>true</default>");
    expect(configurationUi).toContain('name="kcfg_BorderlessWindows"');
    expect(qml).toContain(
      `borderlessWindows: KWin.readConfig("BorderlessWindows", ${String(DEFAULT_DRIFTILE_SETTINGS.borderlessWindows)})`,
    );
    expect(qml).toContain("function onConfigChanged()");
    expect(qml).toContain("root.applySettings(root.readSettings())");
  });

  it("exposes opt-in centering for horizontal tiled focus", () => {
    const centeringEntry = configuration.match(
      /<entry name="CenterFocusedColumn" type="Bool">([\s\S]*?)<\/entry>/,
    )?.[1];
    const centeringWidget = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_CenterFocusedColumn">([\s\S]*?)<\/widget>/,
    )?.[1];
    const applicationCenteringEntry = configuration.match(
      /<entry name="ApplicationFocusCentering" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const applicationCenteringLabel = configurationUi.match(
      /<widget class="QLabel" name="applicationFocusCenteringLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const applicationCenteringWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationFocusCentering">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(centeringEntry).toContain(
      "<label>Center tiled columns after horizontal focus navigation</label>",
    );
    expect(centeringEntry).toContain("<default>false</default>");
    expect(centeringWidget).toContain(
      "<string>Center tiled columns after horizontal focus navigation</string>",
    );
    expect(qml).toContain(
      'centerFocusedColumn: KWin.readConfig("CenterFocusedColumn", false)',
    );
    expect(applicationCenteringEntry).toContain(
      "<label>Applications centered after horizontal focus navigation by KWin desktopFileName</label>",
    );
    expect(applicationCenteringEntry).toContain("<default></default>");
    expect(applicationCenteringLabel).toContain(
      "<string>Applications centered during horizontal focus:</string>",
    );
    expect(applicationCenteringLabel).toContain(
      "<cstring>kcfg_ApplicationFocusCentering</cstring>",
    );
    expect(applicationCenteringWidget).toContain(
      "Enter one exact, case-sensitive KWin desktopFileName per line. This affects horizontal focus centering only.",
    );
    expect(qml).toContain(
      'applicationFocusCentering: KWin.readConfig("ApplicationFocusCentering", "")',
    );
    expect(runtime).toContain(
      "nextController.setCenterFocusedColumn(settings.centerFocusedColumn)",
    );
    expect(runtime).toContain(
      "controller.setCenterFocusedColumn(settings.centerFocusedColumn)",
    );
  });

  it("exposes the tab indicator as a live user setting", () => {
    const indicatorEntry = configuration.match(
      /<entry name="ShowTabIndicator" type="Bool">([\s\S]*?)<\/entry>/,
    )?.[1];
    const indicatorWidget = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_ShowTabIndicator">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(indicatorEntry).toContain(
      "<label>Show a transient OSD for tabbed-window selection</label>",
    );
    expect(indicatorEntry).toContain("<default>true</default>");
    expect(indicatorWidget).toContain(
      "<string>Show a transient OSD for tabbed-window selection</string>",
    );
    expect(qml).toContain(
      `showTabIndicator: KWin.readConfig("ShowTabIndicator", ${String(DEFAULT_DRIFTILE_SETTINGS.showTabIndicator)})`,
    );
  });

  it("exposes opt-in vertical touchpad desktop navigation", () => {
    const workspaceNavigationEntry = configuration.match(
      /<entry name="TouchpadWorkspaceNavigation" type="Bool">([\s\S]*?)<\/entry>/,
    )?.[1];
    const workspaceNavigationWidget = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_TouchpadWorkspaceNavigation">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(workspaceNavigationEntry).toContain(
      "<label>Enable vertical touchpad desktop navigation</label>",
    );
    expect(workspaceNavigationEntry).toContain("<default>false</default>");
    expect(workspaceNavigationWidget).toContain(
      "<string>Enable vertical touchpad desktop navigation</string>",
    );
    expect(workspaceNavigationWidget).toContain(
      "<string>Swipe vertically to focus the adjacent virtual desktop.</string>",
    );
    expect(runtime).toContain(
      "export function getTouchpadWorkspaceNavigation(): boolean",
    );
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
    expect(qml).toContain(
      `gap: KWin.readConfig("Gap", ${String(DEFAULT_DRIFTILE_SETTINGS.gap)})`,
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
    expect(widthEntry).toContain("<default>33</default>");
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
      /<property name="value">\s*<number>33<\/number>/,
    );
    expect(qml).toContain(
      `defaultColumnWidthPercent: KWin.readConfig("DefaultColumnWidthPercent", ${String(DEFAULT_DRIFTILE_SETTINGS.defaultColumnWidthPercent)})`,
    );
  });

  it("exposes the default column presentation as an exact string setting", () => {
    const presentationEntry = configuration.match(
      /<entry name="DefaultColumnPresentation" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const presentationLabel = configurationUi.match(
      /<widget class="QLabel" name="defaultColumnPresentationLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const presentationWidget = configurationUi.match(
      /<widget class="QComboBox" name="kcfg_DefaultColumnPresentation">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(presentationEntry).toContain(
      "<label>Default column presentation</label>",
    );
    expect(presentationEntry).toContain("<default>stacked</default>");
    expect(presentationLabel).toContain(
      "<string>Default column presentation:</string>",
    );
    expect(presentationLabel).toContain(
      "<cstring>kcfg_DefaultColumnPresentation</cstring>",
    );
    expect(presentationWidget).toMatch(
      /<property name="kcfg_property" stdset="0">\s*<string>currentText<\/string>/,
    );
    expect(
      Array.from(
        presentationWidget?.matchAll(
          /<item>\s*<property name="text">\s*<string>([^<]+)<\/string>/g,
        ) ?? [],
        (match) => match[1],
      ),
    ).toEqual(["stacked", "tabbed"]);
    expect(qml).toContain(
      `defaultColumnPresentation: KWin.readConfig("DefaultColumnPresentation", "${DEFAULT_DRIFTILE_SETTINGS.defaultColumnPresentation}")`,
    );
  });

  it("exposes exact application width overrides as a bounded list", () => {
    const overridesEntry = configuration.match(
      /<entry name="ApplicationColumnWidths" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const overridesWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationColumnWidths">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(overridesEntry).toContain(
      "<label>Initial column widths by desktop-file ID</label>",
    );
    expect(overridesEntry).toContain("<default></default>");
    expect(configurationUi).toContain(
      "<string>Application column widths:</string>",
    );
    expect(overridesWidget).toContain("org.kde.konsole=60");
    expect(qml).toContain(
      'applicationColumnWidths: KWin.readConfig("ApplicationColumnWidths", "")',
    );
    expect(runtime).toContain(
      "applicationColumnWidths: settings.applicationColumnWidths",
    );
    expect(runtime).toContain(
      "controller.setApplicationColumnWidths(settings.applicationColumnWidths)",
    );
  });

  it("exposes exact application column presentations as a bounded map", () => {
    const presentationsEntry = configuration.match(
      /<entry name="ApplicationColumnPresentations" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const presentationsWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationColumnPresentations">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(presentationsEntry).toContain(
      "<label>Column presentations by desktop-file ID</label>",
    );
    expect(presentationsEntry).toContain("<default></default>");
    expect(configurationUi).toContain(
      "<string>Application column presentations:</string>",
    );
    expect(presentationsWidget).toContain("org.gnome.Evince=tabbed");
    expect(presentationsWidget).toContain(
      "Use desktop-file-id=stacked or desktop-file-id=tabbed.",
    );
    expect(qml).toContain(
      'applicationColumnPresentations: KWin.readConfig("ApplicationColumnPresentations", "")',
    );
    expect(runtime).toContain(
      "applicationColumnPresentations: settings.applicationColumnPresentations",
    );
    expect(runtime).toContain("controller.setApplicationColumnPresentations(");
  });

  it("exposes exact application initial-floating rules as a bounded list", () => {
    const initialFloatingEntry = configuration.match(
      /<entry name="ApplicationInitialFloating" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const initialFloatingLabel = configurationUi.match(
      /<widget class="QLabel" name="applicationInitialFloatingLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const initialFloatingWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationInitialFloating">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(initialFloatingEntry).toContain(
      "<label>Applications initially floating by desktop-file ID</label>",
    );
    expect(initialFloatingEntry).toContain("<default></default>");
    expect(initialFloatingLabel).toContain(
      "<string>Applications initially floating:</string>",
    );
    expect(initialFloatingLabel).toContain(
      "<cstring>kcfg_ApplicationInitialFloating</cstring>",
    );
    expect(initialFloatingWidget).toContain(
      "Enter one exact, case-sensitive desktop-file ID per line.",
    );
    expect(initialFloatingWidget).toContain(
      "New exact matches start as manually floating windows.",
    );
    expect(qml).toContain(
      'applicationInitialFloating: KWin.readConfig("ApplicationInitialFloating", "")',
    );
  });

  it("exposes exact application tiling exclusions as a bounded list", () => {
    const exclusionsEntry = configuration.match(
      /<entry name="ApplicationTilingExclusions" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const exclusionsLabel = configurationUi.match(
      /<widget class="QLabel" name="applicationTilingExclusionsLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const exclusionsWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationTilingExclusions">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(exclusionsEntry).toContain(
      "<label>Applications excluded from tiling by desktop-file ID</label>",
    );
    expect(exclusionsEntry).toContain("<default></default>");
    expect(exclusionsLabel).toContain(
      "<string>Applications excluded from tiling:</string>",
    );
    expect(exclusionsLabel).toContain(
      "<cstring>kcfg_ApplicationTilingExclusions</cstring>",
    );
    expect(exclusionsWidget).toContain(
      "Enter one exact, case-sensitive desktop-file ID per line.",
    );
    expect(exclusionsWidget).toContain("Blank lines are ignored.");
    expect(qml).toContain(
      'applicationTilingExclusions: KWin.readConfig("ApplicationTilingExclusions", "")',
    );
  });

  it("exposes exact application borderless exclusions as a bounded list", () => {
    const exclusionsEntry = configuration.match(
      /<entry name="ApplicationBorderlessExclusions" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const exclusionsLabel = configurationUi.match(
      /<widget class="QLabel" name="applicationBorderlessExclusionsLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const exclusionsWidget = configurationUi.match(
      /<widget class="QPlainTextEdit" name="kcfg_ApplicationBorderlessExclusions">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(exclusionsEntry).toContain(
      "<label>Applications keeping KWin borders and title bars by desktop-file ID</label>",
    );
    expect(exclusionsEntry).toContain("<default></default>");
    expect(exclusionsLabel).toContain(
      "<string>Applications keeping KWin borders and title bars:</string>",
    );
    expect(exclusionsLabel).toContain(
      "<cstring>kcfg_ApplicationBorderlessExclusions</cstring>",
    );
    expect(exclusionsWidget).toContain(
      "Enter one exact, case-sensitive desktop-file ID per line.",
    );
    expect(exclusionsWidget).toContain("Blank lines are ignored.");
    expect(qml).toContain(
      'applicationBorderlessExclusions: KWin.readConfig("ApplicationBorderlessExclusions", "")',
    );
    expect(runtime).toContain(
      "applicationBorderlessExclusions: settings.applicationBorderlessExclusions",
    );
    expect(runtime).toContain("controller.setApplicationBorderlessExclusions(");
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
    expect(qml).toContain(
      `columnWidthStepPercent: KWin.readConfig("ColumnWidthStepPercent", ${String(DEFAULT_DRIFTILE_SETTINGS.columnWidthStepPercent)})`,
    );
    expect(runtime).toContain(
      "controller.setColumnWidthStepPercent(settings.columnWidthStepPercent)",
    );
  });

  it("exposes a bounded custom column-width preset cycle", () => {
    const presetsEntry = configuration.match(
      /<entry name="ColumnWidthPresets" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const presetsLabel = configurationUi.match(
      /<widget class="QLabel" name="columnWidthPresetsLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const presetsWidget = configurationUi.match(
      /<widget class="QLineEdit" name="kcfg_ColumnWidthPresets">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(presetsEntry).toContain(
      "<label>Column width presets in percent</label>",
    );
    expect(presetsEntry).toContain("<default></default>");
    expect(presetsLabel).toContain("<string>Column width presets:</string>");
    expect(presetsLabel).toContain(
      "<cstring>kcfg_ColumnWidthPresets</cstring>",
    );
    expect(presetsWidget).toContain("Comma-separated");
    expect(presetsWidget).toContain("Blank uses the built-in thirds.");
    expect(qml).toContain(
      'columnWidthPresets: KWin.readConfig("ColumnWidthPresets", "")',
    );
    expect(runtime).toContain(
      "nextController.setColumnWidthPresets(settings.columnWidthPresets.percentages)",
    );
    expect(runtime).toContain(
      "controller.setColumnWidthPresets(settings.columnWidthPresets.percentages)",
    );
  });

  it("exposes the window height step as a live bounded user setting", () => {
    const stepEntry = configuration.match(
      /<entry name="WindowHeightStepPercent" type="Int">([\s\S]*?)<\/entry>/,
    )?.[1];
    const stepLabel = configurationUi.match(
      /<widget class="QLabel" name="windowHeightStepLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const stepWidget = configurationUi.match(
      /<widget class="QSpinBox" name="kcfg_WindowHeightStepPercent">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(stepEntry).toContain("<label>Window height step in percent</label>");
    expect(stepEntry).toContain("<default>10</default>");
    expect(stepEntry).toContain("<min>1</min>");
    expect(stepEntry).toContain("<max>50</max>");
    expect(stepLabel).toContain("<string>Window height step:</string>");
    expect(stepLabel).toContain(
      "<cstring>kcfg_WindowHeightStepPercent</cstring>",
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
    expect(qml).toContain(
      `windowHeightStepPercent: KWin.readConfig("WindowHeightStepPercent", ${String(DEFAULT_DRIFTILE_SETTINGS.windowHeightStepPercent)})`,
    );
    expect(runtime).toContain(
      "controller.setWindowHeightStepPercent(settings.windowHeightStepPercent)",
    );
  });

  it("exposes a bounded custom window-height preset cycle", () => {
    const presetsEntry = configuration.match(
      /<entry name="WindowHeightPresets" type="String">([\s\S]*?)<\/entry>/,
    )?.[1];
    const presetsLabel = configurationUi.match(
      /<widget class="QLabel" name="windowHeightPresetsLabel">([\s\S]*?)<\/widget>/,
    )?.[1];
    const presetsWidget = configurationUi.match(
      /<widget class="QLineEdit" name="kcfg_WindowHeightPresets">([\s\S]*?)<\/widget>/,
    )?.[1];

    expect(presetsEntry).toContain(
      "<label>Window height presets in percent</label>",
    );
    expect(presetsEntry).toContain("<default></default>");
    expect(presetsLabel).toContain("<string>Window height presets:</string>");
    expect(presetsLabel).toContain(
      "<cstring>kcfg_WindowHeightPresets</cstring>",
    );
    expect(presetsWidget).toContain("Comma-separated");
    expect(presetsWidget).toContain(
      "Blank uses the built-in 1/3, 1/2, and 2/3 proportions.",
    );
    expect(qml).toContain(
      'windowHeightPresets: KWin.readConfig("WindowHeightPresets", "")',
    );
    expect(runtime).toMatch(
      /nextController\.setWindowHeightPresets\(\s*settings\.windowHeightPresets\.percentages,\s*\)/u,
    );
    expect(runtime).toContain(
      "controller.setWindowHeightPresets(settings.windowHeightPresets.percentages)",
    );
  });

  it("validates and applies settings as one live snapshot", () => {
    expect(qml).toContain("function readSettings()");
    expect(qml).toContain("root.applySettings(root.readSettings())");
    expect(qml).toMatch(
      /Runtime\.DriftileRuntime\.init\([\s\S]*root\.readSettings\(\), loadedLayoutState,[\s\S]*root\.queueLayoutState,\s*root\.showDropPreview,\s*root\.hideDropPreview,\s*root\.showTabIndicator\)/,
    );
    expect(qml).toMatch(
      /function showDropPreview\(x, y, width, height\) \{\s*Workspace\.showOutline\(x, y, width, height\);\s*\}/,
    );
    expect(qml).toMatch(
      /function hideDropPreview\(\) \{\s*Workspace\.hideOutline\(\);\s*\}/,
    );
    expect(runtime).toContain(
      "const settings = decodeSettings(settingsSnapshot)",
    );
    expect(runtime).toContain("hidePointerDropPreview");
    expect(runtime).toContain("showPointerDropPreview");
    expect(runtime).toContain("decodeDriftileSettings(value)");
    expect(runtime).toContain(
      "sameDriftileSettings(appliedSettings, settings)",
    );
    expect(runtime).not.toMatch(
      /export function set(?:Borderless|Gap|Default)/,
    );
  });

  it("wires versioned layout storage around the runtime lifecycle", () => {
    expect(qml).toContain("import QtCore");
    expect(qml).toContain('key: "layout-v1"');
    expect(qml).toContain(
      'StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/driftile-layout-state.ini"',
    );
    expect(qml).toMatch(
      /const loadedLayoutState = layoutStateStore\.load\(\);[\s\S]*Runtime\.DriftileRuntime\.init\([\s\S]*loadedLayoutState,[\s\S]*root\.queueLayoutState,[\s\S]*root\.hideDropPreview,[\s\S]*root\.showTabIndicator\)/,
    );
    expect(qml).toMatch(
      /Component\.onDestruction:[\s\S]*flushLayoutState\(\);[\s\S]*layoutStateStore\.flush\(\);[\s\S]*Runtime\.DriftileRuntime\.destroy\(\);/,
    );
    expect(runtime).toContain(
      'typeof loadedLayoutState === "string" ? loadedLayoutState : ""',
    );
    expect(runtime).toContain("createRuntimeLayoutPersistence(");
    expect(runtime).toContain(
      "nextController.start(layoutPersistence.initialState)",
    );
    expect(runtime).toContain("layoutStateForCurrentTopology");
    expect(runtime).toContain("layoutPersistence.stateForCurrentTopology()");
    expect(runtime).toContain("knownLayoutSnapshots");
    expect(runtime).toContain("layoutPersistence.snapshots()");
    expect(runtime).toContain(
      "onLayoutStateChanged: layoutPersistence.onStateChanged",
    );
    expect(runtime).toContain(
      "activeController.requestLayoutStatePublication()",
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
    const text = stringProperty(block, "text");
    const activated = block.match(/^\s*onActivated:\s*(\S.*)$/m)?.[1];

    if (!name || !text || !activated) {
      throw new Error("ShortcutHandler requires name, text, and onActivated");
    }

    handlers.push({
      activated,
      name,
      ...(sequence ? { sequence } : {}),
      text,
    });
  }

  return handlers;
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
