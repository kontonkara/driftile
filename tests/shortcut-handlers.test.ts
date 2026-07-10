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

const expectedHandlers: Readonly<
  Record<string, Omit<ShortcutHandler, "name">>
> = {
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
  driftile_focus_column_right: {
    activated: "Runtime.DriftileRuntime.focusRight()",
    sequence: "Meta+L",
  },
  driftile_focus_column_right_arrow: {
    activated: "Runtime.DriftileRuntime.focusRight()",
    sequence: "Meta+Right",
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
  driftile_increase_column_width_plus: {
    activated: "Runtime.DriftileRuntime.increaseColumnWidth()",
    sequence: "Meta++",
  },
  driftile_insert_window_into_stack_left: {
    activated: "Runtime.DriftileRuntime.insertWindowIntoStackLeft()",
  },
  driftile_insert_window_into_stack_right: {
    activated: "Runtime.DriftileRuntime.insertWindowIntoStackRight()",
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
    sequence: "Meta+Ctrl+U",
  },
  driftile_move_window_to_next_desktop_page_down: {
    activated: "Runtime.DriftileRuntime.moveWindowToNextDesktop()",
    sequence: "Meta+Ctrl+PgDown",
  },
  driftile_move_window_to_output_down: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputDown()",
    sequence: "Meta+Ctrl+Shift+J",
  },
  driftile_move_window_to_output_down_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputDown()",
    sequence: "Meta+Ctrl+Shift+Down",
  },
  driftile_move_window_to_output_left: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputLeft()",
    sequence: "Meta+Ctrl+Shift+H",
  },
  driftile_move_window_to_output_left_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputLeft()",
    sequence: "Meta+Ctrl+Shift+Left",
  },
  driftile_move_window_to_output_right: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputRight()",
    sequence: "Meta+Ctrl+Shift+L",
  },
  driftile_move_window_to_output_right_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputRight()",
    sequence: "Meta+Ctrl+Shift+Right",
  },
  driftile_move_window_to_output_up: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputUp()",
    sequence: "Meta+Ctrl+Shift+K",
  },
  driftile_move_window_to_output_up_arrow: {
    activated: "Runtime.DriftileRuntime.moveWindowToOutputUp()",
    sequence: "Meta+Ctrl+Shift+Up",
  },
  driftile_move_window_to_previous_desktop: {
    activated: "Runtime.DriftileRuntime.moveWindowToPreviousDesktop()",
    sequence: "Meta+Ctrl+I",
  },
  driftile_move_window_to_previous_desktop_page_up: {
    activated: "Runtime.DriftileRuntime.moveWindowToPreviousDesktop()",
    sequence: "Meta+Ctrl+PgUp",
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
  driftile_toggle_floating: {
    activated: "Runtime.DriftileRuntime.toggleFloating()",
    sequence: "Meta+V",
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
      "driftile_insert_window_into_stack_left",
      "driftile_insert_window_into_stack_right",
      "driftile_reset_column_width",
    ]);
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
