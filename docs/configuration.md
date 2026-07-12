# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

## Window gap

**Window gap** controls spacing between tiled windows and work-area edges in logical pixels. The default is `16`; the range is `0`–`64`, and `0` removes gaps.

Changes apply live to visible tiled contexts. Window order, widths, height policies, focus, manually floating frames, automatically excluded windows, and minimized frames stay unchanged. Hidden desktops use the new value when they become visible.

## Default column width

**Default column width** sets the proportional width for newly admitted columns, fresh cross-context retiles, and the **Reset column width** action. Structural splits and extractions inherit their source width. The default is `50%`; the range is `10%`–`100%`.

Changing it does not alter existing managed width policies, focus, floating anchors, transfers, or stacks. Existing widths remain authoritative until reset. A waiting window may be admitted under the new policy and move the affected viewport and frames. Newly admitted and reset widths are clamped to the live window constraints and physical-pixel grid.

## Column width step

**Column width step** controls the **Decrease column width** and **Increase column width** actions. The default is `10%`; the range is `1%`–`50%`.

The value is a percentage-point step of the gap-adjusted work-area span, not a percentage of the current frame. Changing it does not resize or move any window; the next explicit decrease or increase uses the new step. Reset, presets, full width, and available-width expansion are unchanged. Hard window constraints can clamp the result to a fixed boundary.

## Window height step

**Window height step** controls the **Decrease window height** and **Increase window height** actions. The default is `10%`; the range is `1%`–`50%`.

The value is a percentage-point step of the gap-adjusted work-area height, not a percentage of the current frame. Changing it performs no layout work; the next explicit decrease or increase resizes the active stack member and redistributes its automatic siblings. Reset and height presets are unchanged. Window and stack constraints can clamp the result.

## Window decorations

**Hide KWin borders and title bars on application windows** is enabled by default. It covers tiled, floating, dialog, transient, and utility windows. Panels, desktop surfaces, unmanaged windows, and windows that were already borderless keep their KWin state.

The option controls server-side KWin decorations. Client-side decorations and application toolbars are part of the application surface and may remain visible.

Disabling the option restores decorations that Driftile removed. Unloading the extension does the same. Changes apply on the next KWin reconfigure or Driftile reload.
