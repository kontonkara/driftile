# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

Driftile validates all eleven settings as one snapshot. Applying an invalid value
through an external configuration tool rejects the entire update and preserves
the active settings; valid changes apply without reloading the extension.

## Home Manager

`programs.driftile.settings` is `null` by default, so Home Manager writes no
Driftile setting. A non-null value is one complete typed profile: omitted fields
take the defaults documented below, and Home Manager writes all eleven values.
This profile works with `programs.driftile.enable = false` when the package is
installed system-wide.

The activation writes only `ApplicationBorderlessExclusions`,
`ApplicationColumnWidths`, `ApplicationTilingExclusions`,
`BorderlessWindows`, `CenterFocusedColumn`, `Gap`,
`DefaultColumnWidthPercent`, `ColumnWidthPresets`,
`ColumnWidthStepPercent`, `TouchpadNavigation`, and
`WindowHeightStepPercent` in Driftile's `kwinrc` group. It does not replace
the file or manage shortcuts. A running KWin session is asked to reconfigure
on a best-effort basis; otherwise the values apply on its next reload or start.

Declare application widths as a typed attribute set and exclusions as lists.
Home Manager sorts desktop-file IDs before writing newline-delimited KConfig
values.

```nix
programs.driftile.settings.applicationBorderlessExclusions = [
  "org.kde.konsole"
];

programs.driftile.settings.applicationColumnWidths = {
  "org.kde.konsole" = 60;
  "org.mozilla.firefox" = 80;
};

programs.driftile.settings.applicationTilingExclusions = [
  "org.kde.spectacle"
];

programs.driftile.settings.centerFocusedColumn = false;
programs.driftile.settings.columnWidthPresets = [ 20 50 80 ];
programs.driftile.settings.touchpadNavigation = true;
```

Widths must be `10`–`100`. Width-override IDs are exact and may not contain
`=`. Exclusion IDs may contain `=` because the whole line is the ID. Home
Manager accepts at most 128 unique IDs per exclusion policy, rejects blank,
whitespace-padded, control-containing, or over-255-byte IDs, and writes each
list in canonical sorted order.

Changing `settings` back to `null` or removing the Home Manager module import
stops future writes but leaves the last values in `kwinrc`. Change them through
System Settings or declare another complete profile when different values are
required.

## Keyboard shortcuts

Open **System Settings > Keyboard > Shortcuts** and search for **Driftile** to
change any registered action. KGlobalAccel stores and applies assignments live;
the KWin-script settings page does not maintain a second copy.

## Horizontal focus centering

**Center tiled columns after horizontal focus navigation** is disabled by
default. When enabled, successful left, right, first, and last tiled focus
actions center their destination column with the same viewport policy as the
explicit **Center column** action. If centering cannot be prepared safely, the
normal minimal reveal still completes the focus action.

Changing the option does not move the current layout. Vertical, floating,
layer, and direct application focus are unchanged, and the explicit **Center
column** action remains available.

## Touchpad navigation

**Enable five-finger horizontal touchpad navigation** is disabled by default.
On native Wayland, a completed left swipe focuses the next tiled column to the
right, while a completed right swipe focuses the previous column to the left.
The normal horizontal focus reveal and optional centering policies still apply.

Partial and cancelled gestures do nothing. Enabling or disabling the option
updates gesture registration without restarting KWin. Native X11 treats the
enabled option as a safe no-op, and the option adds no shortcut action or
default key binding.

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

## Application tiling exclusions

**Applications excluded from tiling** keeps matching normal application
windows outside layout ownership by exact KWin `desktopFileName`. Enter one ID
per line. Blank lines are ignored; matching is case-sensitive; duplicates,
control characters, and more than 128 entries reject the complete settings
update. Each ID is limited to 255 UTF-8 bytes.

Adding an exclusion live releases matching tiled, waiting, or manually floating
windows without writing their frames. Removing it admits matching eligible
windows as fresh singleton columns once KWin releases fullscreen, maximize,
native-tile, move, or resize authority. Exclusions take priority over
application-specific initial widths and are not stored in layout persistence.

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

## Application borderless exclusions

`ApplicationBorderlessExclusions` is a KConfig `String` setting, shown as
**Applications keeping KWin borders and title bars**. Enter one exact,
case-sensitive KWin `desktopFileName` per line. A matching otherwise eligible
window keeps its existing KWin decoration state whether it is tiled, floating,
a dialog, transient, or utility window. Matching uses no resource-class,
window-role, or other fallback. A missing or empty `desktopFileName` is not
excluded.

An empty document retains the global borderless behavior described above. When
`BorderlessWindows=false`, that global setting dominates: Driftile applies no
borderless policy regardless of the exclusion list.

The KConfig decoder accepts at most 65,664 characters in the complete document,
512 characters in each raw line, 128 nonblank unique IDs, and 255 UTF-8 bytes
in each trimmed ID. It trims surrounding whitespace and ignores blank lines.
Control characters, invalid UTF-16, an oversized value, or a duplicate after
trimming rejects the complete eleven-setting snapshot. Accepted IDs have a
canonical sorted internal form. Home Manager exposes the same policy as
`programs.driftile.settings.applicationBorderlessExclusions`, a list rendered
as a sorted newline-delimited KConfig value.

Adding an exclusion live restores only decoration state Driftile claimed;
removing it lets the enabled global policy claim a decorated match. Changes to
the list or a window's `desktopFileName` reconcile live without issuing
Driftile geometry writes or changing focus, layout state, or layout
persistence. Global disable and extension unload restore owned state, while
pre-existing borderless state remains untouched.
