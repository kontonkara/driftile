# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

## Window gap

**Window gap** controls spacing between tiled windows and work-area edges in logical pixels. The default is `16`; the range is `0`–`64`, and `0` removes gaps.

Changes apply live to visible tiled contexts. Window order, widths, height policies, focus, manually floating frames, automatically excluded windows, and minimized frames stay unchanged. Hidden desktops use the new value when they become visible.

## Default column width

**Default column width** sets the proportional width for newly admitted columns, fresh cross-context retiles, and the **Reset column width** action. Structural splits and extractions inherit their source width. The default is `50%`; the range is `10%`–`100%`.

Changing it does not alter existing managed width policies, focus, floating anchors, transfers, or stacks. Existing widths remain authoritative until reset. A waiting window may be admitted under the new policy and move the affected viewport and frames. Newly admitted and reset widths are clamped to the live window constraints and physical-pixel grid.

## Window decorations

**Hide KWin borders and title bars on application windows** is enabled by default. It covers tiled, floating, dialog, transient, and utility windows. Panels, desktop surfaces, unmanaged windows, and windows that were already borderless keep their KWin state.

The option controls server-side KWin decorations. Client-side decorations and application toolbars are part of the application surface and may remain visible.

Disabling the option restores decorations that Driftile removed. Unloading the extension does the same. Changes apply on the next KWin reconfigure or Driftile reload.
