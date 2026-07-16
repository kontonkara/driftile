# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

The settings page groups the existing controls into two tabs:

- **General**: window decorations, focus centering, touchpad navigation, window
  gap, tab feedback, default column presentation and width, column width step
  and presets, and window height step and presets.
- **Applications**: initial column widths and presentation, focus centering,
  initial floating rules, tiling exclusions, and decoration exclusions.

Driftile validates all twenty settings as one snapshot. Applying an invalid
value through an external configuration tool rejects the entire update and
preserves the active settings; valid changes apply without reloading the
extension.

## Optional overview gesture

The separately installed **Driftile Overview** effect uses a four-finger up
swipe to open and a down swipe to close by default. Configure or disable the
gesture from the effect's settings. Finger counts range from `3` to `5`.

Home Manager leaves these KConfig values unmanaged by default. A complete
profile can own both independently of package installation:

```nix
programs.driftile.overview.touchpadGesture = {
  enable = true;
  fingerCount = 4;
};
```

Use a different count from vertical desktop navigation and Plasma's built-in
Overview, or disable the overlapping gesture, so each global direction has one
owner.

## Optional transitions

The separately installed **Driftile Transitions** effect is disabled by
default. Enable and configure it under **System Settings > Window Management >
Desktop Effects**. Its base duration ranges from `0` to `1000` milliseconds,
defaults to `180`, and follows Plasma's global animation-speed setting. A value
of `0` disables animation.

The effect animates automatic position and size changes without writing window
geometry. Manual move or resize and fullscreen remain ineligible. Geometry
changes received while another fullscreen or workspace transition owns
presentation are coalesced per window and replayed once when that ownership
ends. A temporarily hidden window keeps the first captured frame until a public
visibility, desktop, activity, or later geometry signal makes replay safe.
Deletion, configuration reload, or true ineligibility discards the pending
change. Replay uses no timer or private API and writes neither geometry nor
persistence.

Launchers, switcher-hidden windows, OSDs, outlines, lock-screen and internal
windows, popups, transient dialogs, frameless shell overlays, and other
non-movable windows are outside the effect. Consecutive geometry updates at
non-negative global positions retarget the active position and size
transitions. Moves involving a negative global position use a relative
translation, keeping off-screen columns and outputs with negative coordinates
animated without writing geometry. Movement and size animation can be disabled
independently.

`WindowClassExclusions` accepts at most 128 exact, case-sensitive KWin
`windowClass` values, one per line and at most 255 UTF-8 bytes each. Use KWin's
debug console to copy the complete value; partial matching is not performed.
Blank lines are ignored. A duplicate, malformed, or oversized document disables
the effect until a valid value is loaded.

Home Manager can own these values independently of package installation. Each
nullable option leaves its existing KConfig value untouched when set to `null`:

```nix
programs.driftile.transitions = {
  duration = 180;
  animatePosition = true;
  animateSize = true;
  windowClassExclusions = [ "firefox firefox" ];
};
```

## Home Manager

`programs.driftile.settings` is `null` by default, so Home Manager writes no
Driftile setting. A non-null value is one complete typed profile: omitted fields
take the defaults documented below, and Home Manager writes all twenty
values.
This profile works with `programs.driftile.enable = false` when the package is
installed system-wide.

The activation writes only `ApplicationBorderlessExclusions`,
`ApplicationColumnPresentations`, `ApplicationColumnWidths`,
`ApplicationFocusCentering`,
`ApplicationInitialFloating`, `ApplicationTilingExclusions`,
`BorderlessWindows`, `CenterFocusedColumn`, `Gap`,
`DefaultColumnPresentation`, `DefaultColumnWidthPercent`, `ColumnWidthPresets`,
`ColumnWidthStepPercent`, `ShowTabIndicator`, `TouchpadNavigation`,
`TouchpadWorkspaceNavigation`, `TouchpadNavigationFingerCount`,
`TouchpadNaturalScroll`,
`WindowHeightPresets`, and `WindowHeightStepPercent` in Driftile's `kwinrc`
group. It does not replace the file or manage shortcuts. A running KWin session
is asked to reconfigure on a best-effort basis; otherwise the values apply on
its next reload or start.

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

programs.driftile.settings.applicationColumnPresentations = {
  "org.mozilla.firefox" = "tabbed";
};

programs.driftile.settings.applicationFocusCentering = [
  "org.mozilla.firefox"
];

programs.driftile.settings.applicationInitialFloating = [
  "org.kde.kcalc"
];

programs.driftile.settings.applicationTilingExclusions = [
  "org.kde.spectacle"
];

programs.driftile.settings.centerFocusedColumn = false;
programs.driftile.settings.columnWidthPresets = [ 20 50 80 ];
programs.driftile.settings.defaultColumnPresentation = "stacked";
programs.driftile.settings.showTabIndicator = true;
programs.driftile.settings.touchpadNavigation = true;
programs.driftile.settings.touchpadWorkspaceNavigation = true;
programs.driftile.settings.touchpadNavigationFingerCount = 4;
programs.driftile.settings.touchpadNaturalScroll = true;
programs.driftile.settings.windowHeightPresets = [ 25 50 75 ];
```

Widths must be `10`–`100`; presentations are `stacked` or `tabbed`. Attribute
set IDs are exact and may not contain `=`. List policy IDs may contain `=`.
Home Manager accepts at most 128 unique IDs per list policy, rejects blank,
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

## Tab indicator

**Show a transient OSD for tabbed-window selection** is enabled by default.
Confirmed activation of a member in a multi-window tabbed column, including a
successful transition into tabbed presentation, uses Plasma's passive OSD and
never creates a managed window or captures input. The OSD remains silent while
Plasma's or Driftile's overview is active. Disable the option without changing
column state or shortcuts.

## Horizontal focus centering

**Center tiled columns after horizontal focus navigation** is disabled by
default. When enabled, successful left, right, first, and last tiled focus
actions center their destination column with the same viewport policy as the
explicit **Center column** action. If centering cannot be prepared safely, the
normal minimal reveal still completes the focus action.

Changing the option does not move the current layout. Vertical, floating,
layer, and direct application focus are unchanged, and the explicit **Center
column** action remains available.

**Applications centered during horizontal focus** is empty by default. Enter
one exact, case-sensitive KWin `desktopFileName` per line to center only
matching destinations. Matching and the global option are combined: enabling
the global option centers every horizontal tiled-focus destination.

For a stacked destination, the rule checks the member actually selected by the
focus action, not another member in the same column. A missing or unmatched ID
keeps the normal minimal reveal. Replacing the list performs no immediate
layout, viewport, focus, or persistence write; it applies to the next left,
right, first, or last tiled-focus action.

## Touchpad navigation

**Enable horizontal touchpad navigation** focuses tiled columns. **Enable
vertical touchpad desktop navigation** selects adjacent virtual desktops. Both
options are independent, disabled by default, and work only on native Wayland.

`TouchpadNavigationFingerCount`
(`touchpadNavigationFingerCount` in Home Manager) accepts `3`–`5` fingers and
defaults to `5`.

`TouchpadNaturalScroll` (`touchpadNaturalScroll` in Home Manager) defaults to
enabled, preserving content-following mappings: left and right swipes focus the
next and previous tiled columns, while up and down swipes select the next and
previous desktop. Disabling it reverses every enabled direction. The normal
horizontal focus reveal and optional centering policies still apply.

Vertical desktop swipes target the single output under the pointer. A pointer
in an output gap or overlapping output geometry produces no desktop change.
Keyboard desktop actions continue to target the active output.

Partial and cancelled gestures do nothing. Changing either enable option, the
finger count, or natural direction recreates only the enabled gesture handlers
without restarting KWin. Native X11 treats both enabled options as safe no-ops,
and neither option adds a shortcut action or default key binding.

## Window gap

**Window gap** controls spacing between tiled windows and work-area edges in logical pixels. The default is `16`; the range is `0`–`64`, and `0` removes gaps.

Changes apply live to visible tiled contexts. Window order, widths, height policies, focus, manually floating frames, automatically excluded windows, and minimized frames stay unchanged. Hidden desktops use the new value when they become visible.

## Default column presentation

**Default column presentation** selects `stacked` or `tabbed` for every fresh
column without an exact application rule. The default is `stacked`. A tabbed
singleton retains that mode, so the next member immediately joins a tabbed
column.

Changing the value affects waiting admissions and columns created later. It
does not rewrite existing or restored columns, and a window joining an existing
column still adopts that target column's presentation.

## Default column width

**Default column width** sets the proportional width for newly admitted columns,
fresh cross-context retiles, and the contextual **Reset column width** action.
Structural splits and extractions inherit their source width. The default is
`33%`; the range is `10%`–`100%`.

A cross-context pointer drop into an empty column gutter is a structural
extraction and keeps the source width. Ordinary destination fallback is a fresh
singleton admission and reads the current application or global width policy.

Changing it does not alter existing width policies or floating frames. The next
explicit reset applies it to the active tiled column or one relation-free
manually floating window; application-specific initial widths do not override
that reset. Newly admitted and reset widths use the gap-adjusted singleton
resolution, live constraints, and assigned-output physical-pixel grid.

## Application column widths

**Application column widths** overrides the initial width of new singleton
columns by exact KWin `desktopFileName`. Enter one
`desktop-file-id=percentage` rule per line, for example
`org.kde.konsole=60`. Percentages range from `10` to `100`; blank lines are
ignored, duplicate IDs and malformed rules reject the complete settings update,
and at most 128 rules are accepted. IDs are limited to 255 UTF-8 bytes.

Matching is case-sensitive. Windows without a matching usable ID keep the
global width default. Updating the rules does not resize existing columns;
later new columns and fresh singleton admissions use the new value, clamped to
the live window constraints and physical-pixel grid.

## Application column presentation

**Application column presentation** sets the initial display mode of a new
column by exact KWin `desktopFileName`. Enter one
`desktop-file-id=stacked|tabbed` rule per line. Matching is case-sensitive;
blank lines are ignored, and malformed, duplicate, or over-limit rules reject
the complete settings update. At most 128 rules are accepted, and IDs are
limited to 255 UTF-8 bytes.

An exact application rule overrides **Default column presentation**. Windows
without a matching usable ID use that global default.

A tabbed singleton keeps that mode even though it looks like a stacked
singleton. When another window joins, the column is immediately tabbed. A
split, expel, fresh cross-context transfer, or initially floating window that
later forms its own column uses the moved application's current rule. Existing
columns are not rewritten when the setting changes, and a window joining an
existing column always adopts the target column's mode.

## Applications initially floating

**Applications initially floating** starts a matching normal application
window as an ordinary manually floating window when Driftile first admits it.
Matching uses the exact, case-sensitive KWin `desktopFileName`; enter one ID per
line under the same limits as the other application list policies. Driftile
preserves the frame accepted from KWin.

The policy is fresh-only. It does not reclassify an already admitted window or
override restored tiled or floating ownership when the setting changes. A
window snapshots the policy when Driftile first tracks it, including while it
waits behind a KWin-owned state. Tiling exclusions and automatic floating roles
such as dialogs, transients, and fixed-size windows take priority.

The normal **Toggle floating** action can tile a window that started manually
floating. Its application-specific initial column width applies at that point.
The policy uses existing floating and layout persistence and adds no persistence
schema field.

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

**Column width presets** controls the contextual forward and backward preset
actions for the active tiled column or one relation-free manually floating
window. Enter up to 16 comma-separated, strictly increasing integer percentages
from `10` to `100`. A blank value keeps the built-in exact thirds.

Changing the list performs no layout work and preserves existing column widths
and floating frames. The next preset action reads the new list and applies the
shared singleton resolution, live constraints, and physical-pixel grid.

## Window height step

**Window height step** controls the **Decrease window height** and **Increase window height** actions. The default is `10%`; the range is `1%`–`50%`.

For a tiled active window, the value is a percentage-point step of the
gap-adjusted work-area height and the existing stack redistribution remains
unchanged. For an active manually floating window, it is a percentage of the
assigned work-area height with the gap excluded. The floating target preserves
width and top-left unless the partial-visibility bounds require a minimal
origin clamp. It snaps with the assigned output's device-pixel ratio and
respects live decorated size constraints.

Changing the value performs no layout work. Window-height presets are configured
separately, and window-height reset remains tiled-only.

## Window height presets

**Window height presets** controls the forward and reverse preset actions for
the active tiled window or one eligible relation-free manually floating window.
A blank KConfig value or an empty Home Manager list preserves the built-in exact
`1/3`, `1/2`, and `2/3` proportions. A custom value contains 1–16 strictly
increasing integer percentages from `10` to `100`.

Changing the list performs no immediate layout, frame, focus, or persistence
work. Later explicit height-preset actions read the new cycle. Window-height
step and reset actions are unchanged.

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
trimming rejects the complete twenty-setting snapshot. Accepted IDs have a
canonical sorted internal form. Home Manager exposes the same policy as
`programs.driftile.settings.applicationBorderlessExclusions`, a list rendered
as a sorted newline-delimited KConfig value.

Adding an exclusion live restores only decoration state Driftile claimed;
removing it lets the enabled global policy claim a decorated match. Changes to
the list or a window's `desktopFileName` reconcile live without issuing
Driftile geometry writes or changing focus, layout state, or layout
persistence. Global disable and extension unload restore owned state, while
pre-existing borderless state remains untouched.
