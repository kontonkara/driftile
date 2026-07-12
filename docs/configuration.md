# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

Driftile validates all seven settings as one snapshot. Applying an invalid value
through an external configuration tool rejects the entire update and preserves
the active settings; valid changes apply without reloading the extension.

## Home Manager

`programs.driftile.settings` is `null` by default, so Home Manager writes no
Driftile setting. A non-null value is one complete typed profile: omitted fields
take the defaults documented below, and Home Manager writes all seven values.
This profile works with `programs.driftile.enable = false` when the package is
installed system-wide.

The activation writes only `ApplicationColumnWidths`, `BorderlessWindows`,
`Gap`, `DefaultColumnWidthPercent`, `ColumnWidthPresets`,
`ColumnWidthStepPercent`, and `WindowHeightStepPercent` in Driftile's `kwinrc`
group. It does not replace the file or manage shortcuts. A running KWin session
is asked to reconfigure on a best-effort basis; otherwise the values apply on
its next reload or start.

Declare application overrides as a typed attribute set. Home Manager sorts the
desktop-file IDs before writing the newline-delimited KConfig value.

```nix
programs.driftile.settings.applicationColumnWidths = {
  "org.kde.konsole" = 60;
  "org.mozilla.firefox" = 80;
};

programs.driftile.settings.columnWidthPresets = [ 20 50 80 ];
```

Widths must be `10`–`100`. IDs are exact, may not contain `=` or control
characters, and are limited to 255 UTF-8 bytes. A profile may contain at most
128 overrides.

Changing `settings` back to `null` or removing the Home Manager module import
stops future writes but leaves the last values in `kwinrc`. Change them through
System Settings or declare another complete profile when different values are
required.

## Keyboard shortcuts

Open **System Settings > Keyboard > Shortcuts** and search for **Driftile** to
change any registered action. KGlobalAccel stores and applies assignments live;
the KWin-script settings page does not maintain a second copy.

## Window gap

**Window gap** controls spacing between tiled windows and work-area edges in logical pixels. The default is `16`; the range is `0`–`64`, and `0` removes gaps.

Changes apply live to visible tiled contexts. Window order, widths, height policies, focus, manually floating frames, automatically excluded windows, and minimized frames stay unchanged. Hidden desktops use the new value when they become visible.

## Default column width

**Default column width** sets the proportional width for newly admitted columns, fresh cross-context retiles, and the **Reset column width** action. Structural splits and extractions inherit their source width. The default is `50%`; the range is `10%`–`100%`.

Changing it does not alter existing managed width policies, focus, floating anchors, transfers, or stacks. Existing widths remain authoritative until reset. A waiting window may be admitted under the new policy and move the affected viewport and frames. Newly admitted and reset widths are clamped to the live window constraints and physical-pixel grid.

## Application column widths

**Application column widths** overrides the initial width of new singleton
columns by exact KWin `desktopFileName`. Enter one
`desktop-file-id=percentage` rule per line, for example
`org.kde.konsole=60`. Percentages range from `10` to `100`; blank lines are
ignored, duplicate IDs and malformed rules reject the complete settings update,
and at most 128 rules are accepted. IDs are limited to 255 UTF-8 bytes.

Matching is case-sensitive. Windows without a matching usable ID keep the
global default. Updating the rules does not resize existing columns; later new
columns and fresh singleton admissions use the new value, clamped to the live
window constraints and physical-pixel grid.

## Column width step

**Column width step** controls the **Decrease column width** and **Increase column width** actions. The default is `10%`; the range is `1%`–`50%`.

The value is a percentage-point step of the gap-adjusted work-area span, not a percentage of the current frame. Changing it does not resize or move any window; the next explicit decrease or increase uses the new step. Reset, presets, full width, and available-width expansion are unchanged. Hard window constraints can clamp the result to a fixed boundary.

## Column width presets

**Column width presets** controls the forward and backward preset actions.
Enter up to 16 comma-separated, strictly increasing integer percentages from
`10` to `100`. A blank value keeps the built-in exact thirds.

Changing the list performs no layout work and preserves existing column widths,
focus, and viewport state. The next preset action reads the new list and still
applies the shared window constraints.

## Window height step

**Window height step** controls the **Decrease window height** and **Increase window height** actions. The default is `10%`; the range is `1%`–`50%`.

The value is a percentage-point step of the gap-adjusted work-area height, not a percentage of the current frame. Changing it performs no layout work; the next explicit decrease or increase resizes the active stack member and redistributes its automatic siblings. Reset and height presets are unchanged. Window and stack constraints can clamp the result.

## Window decorations

**Hide KWin borders and title bars on application windows** is enabled by default. It covers tiled, floating, dialog, transient, and utility windows. Panels, desktop surfaces, unmanaged windows, and windows that were already borderless keep their KWin state.

The option controls server-side KWin decorations. Client-side decorations and application toolbars are part of the application surface and may remain visible.

Disabling the option restores decorations that Driftile removed. Unloading the extension does the same. Changes apply on the next KWin reconfigure or Driftile reload.
