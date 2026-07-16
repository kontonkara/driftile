# Configuration

Open **System Settings > Window Management > KWin Scripts** and configure Driftile.

The settings page groups the existing controls into two tabs:

- **General**: window decorations, focus and single-column centering, desktop
  and touchpad navigation, window gap, tab feedback, default column
  presentation and width, default initial tiled client height, proportional or
  fixed column-width steps and presets, and proportional or fixed window-height
  steps and presets.
- **Applications**: initial column widths, tiled client heights, presentation,
  focus centering, initial floating state and position, native-state rules,
  tiling exclusions, and decoration exclusions.

Driftile validates the complete settings snapshot atomically. Applying an
invalid value through an external configuration tool rejects the entire update
and preserves the active settings; valid changes apply without reloading the
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

`EasingCurve` controls how movement and size interpolation progress. It accepts
`linear`, `out-quad`, `out-cubic`, `out-quart`, `out-quint`, or `out-expo` and
defaults to `out-cubic`. `ResizeAnimationThreshold` accepts `0`–`64` logical
pixels and defaults to `10`. A resize whose maximum width or height delta is at
or below that threshold snaps to its final size without size interpolation;
window movement may still animate.

The effect animates automatic position and size changes without writing window
geometry. Manual move or resize and fullscreen remain ineligible. Geometry
changes received while another fullscreen or workspace transition owns
presentation are coalesced per window and replayed once when that ownership
ends. An active window already confirmed on the current desktop and activity
may replay before its delayed visibility flag settles; other temporarily hidden
windows keep the first captured frame until a public visibility, desktop,
activity, or later geometry signal makes replay safe.
Deletion, configuration reload, or true ineligibility discards the pending
change. Replay uses no timer or private API and writes neither geometry nor
persistence.

Launchers, switcher-hidden windows, OSDs, outlines, lock-screen and internal
windows, popups, transient dialogs, frameless shell overlays, and other
non-movable windows are outside the effect. Consecutive geometry updates
retarget the active position and size transitions in place. The first transition
uses the configured duration; later retargets use at most a `100` millisecond
base interval, follow Plasma's animation-speed setting, and never outlast the
configured duration. Targets that have not changed are not submitted again.
Position animation uses a non-negative absolute base plus a signed translation,
so rapid commands and outputs with negative global coordinates do not restart
or accumulate transitions. Movement and size animation can be disabled
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
  easingCurve = "out-cubic";
  animatePosition = true;
  animateSize = true;
  resizeAnimationThreshold = 10;
  windowClassExclusions = [ "firefox firefox" ];
};
```

## Home Manager

`programs.driftile.settings` is `null` by default, so Home Manager writes no
Driftile setting. In a non-null profile, ordinary omitted fields take the
defaults documented below. The nullable `alwaysCenterSingleColumn` and
`centerFocusedColumnOnOverflow` options default to `null`, leaving their KConfig
keys unmanaged.
This profile works with `programs.driftile.enable = false` when the package is
installed system-wide.

The activation writes only `ApplicationBorderlessExclusions`,
`ApplicationColumnPresentations`, `ApplicationColumnWidths`,
`ApplicationWindowHeights`,
`ApplicationFocusCentering`, `ApplicationFloatingPositions`,
`ApplicationInitialDestinations`,
`ApplicationInitialFocused`,
`ApplicationInitialUnfocused`,
`ApplicationInitialFloating`, `ApplicationInitialFullWidth`,
`ApplicationInitialFullscreen`, `ApplicationInitialMaximized`,
`ApplicationTilingExclusions`,
`BorderlessWindows`, `CenterFocusedColumn`, `Gap`,
`DefaultColumnPresentation`, `DefaultColumnWidthPercent`,
`DefaultColumnWidthPixels`, `DefaultFloatingPosition`, `DefaultWindowHeight`,
`ColumnWidthPresets`,
`ColumnWidthStepPercent`, `ColumnWidthStepPixels`,
`ShowTabIndicator`, `TouchpadNavigation`,
`TouchpadWorkspaceNavigation`, `TouchpadNavigationFingerCount`,
`TouchpadNaturalScroll`, `WorkspaceAutoBackAndForth`,
`WindowHeightPresets`, `WindowHeightStepPercent`, and
`WindowHeightStepPixels` in Driftile's `kwinrc` group. It does not replace the
file or manage shortcuts. A running KWin session is asked to reconfigure on a
best-effort basis; otherwise the values apply on its next reload or start.

When non-null, `alwaysCenterSingleColumn` and
`centerFocusedColumnOnOverflow` additionally write `AlwaysCenterSingleColumn`
and `CenterFocusedColumnOnOverflow` respectively.

Declare application widths and heights as typed attribute sets and exclusions
as lists. Home Manager sorts desktop-file IDs before writing newline-delimited
KConfig values.

```nix
programs.driftile.settings.applicationBorderlessExclusions = [
  "org.kde.konsole"
];

programs.driftile.settings.applicationColumnWidths = {
  "org.kde.konsole" = 60;
  "org.mozilla.firefox" = "960px";
};

programs.driftile.settings.applicationWindowHeights = {
  "org.kde.konsole" = 60;
  "org.mozilla.firefox" = "720px";
};

programs.driftile.settings.applicationColumnPresentations = {
  "org.mozilla.firefox" = "tabbed";
};

programs.driftile.settings.applicationFocusCentering = [
  "org.mozilla.firefox"
];

programs.driftile.settings.applicationInitialDestinations = {
  "org.mozilla.firefox" = {
    desktop = 2;
    output = "DP-2";
  };
  "org.kde.konsole".desktopName = "Development";
  "org.telegram.desktop".output = "HDMI-A-1";
};

programs.driftile.settings.applicationInitialFocused = [
  "org.mozilla.firefox"
];

programs.driftile.settings.applicationInitialUnfocused = [
  "org.example.BackgroundTool"
];

programs.driftile.settings.applicationInitialFloating = [
  "org.kde.kcalc"
];

programs.driftile.settings.applicationFloatingPositions = {
  "org.kde.kcalc" = {
    anchor = "bottom-right";
    x = 24;
    y = 24;
  };
};

programs.driftile.settings.applicationInitialFullWidth = [
  "org.mozilla.firefox"
];

programs.driftile.settings.applicationInitialMaximized = [
  "org.kde.konsole"
];

programs.driftile.settings.applicationInitialFullscreen = [
  "org.example.Player"
];

programs.driftile.settings.applicationTilingExclusions = [
  "org.kde.spectacle"
];

programs.driftile.settings.centerFocusedColumn = false;
programs.driftile.settings.centerFocusedColumnOnOverflow = true;
programs.driftile.settings.alwaysCenterSingleColumn = true;
programs.driftile.settings.columnWidthPresets = [ 20 50 80 ];
programs.driftile.settings.columnWidthStepPixels = 0;
programs.driftile.settings.defaultColumnPresentation = "stacked";
programs.driftile.settings.defaultColumnWidthPixels = 0;
programs.driftile.settings.defaultFloatingPosition = {
  anchor = "bottom-right";
  x = 24;
  y = 24;
};
programs.driftile.settings.defaultWindowHeight = "auto";
programs.driftile.settings.gap = 7.5;
programs.driftile.settings.showTabIndicator = true;
programs.driftile.settings.touchpadNavigation = true;
programs.driftile.settings.touchpadWorkspaceNavigation = true;
programs.driftile.settings.touchpadNavigationFingerCount = 4;
programs.driftile.settings.touchpadNaturalScroll = true;
programs.driftile.settings.workspaceAutoBackAndForth = false;
programs.driftile.settings.windowHeightPresets = [ 25 50 75 ];
programs.driftile.settings.windowHeightStepPixels = 0;
```

Application widths and heights accept legacy integers from `10` through `100`,
explicit `"10%"`–`"100%"` percentages, or fixed `"1px"`–`"16384px"` logical
sizes. A fixed application height means client height. Presentations are
`stacked` or `tabbed`. Attribute set IDs are exact and may not contain `=`.
List policy IDs may contain `=`. Home Manager accepts at most 128 unique IDs
per list policy, rejects blank, whitespace-padded, control-containing, or
over-255-byte IDs, and writes each list in canonical sorted order.

`defaultWindowHeight` accepts `"auto"` or the same percentage and fixed-pixel
forms. Its fixed value also means logical client height.

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

**Center focused columns when the old and new columns do not both fit** is
also disabled by default. It keeps the normal minimal reveal while the target
and its nearest neighbor in the navigation direction fit together, and centers
the target only when that pair overflows the sampled work area. The
always-center option above and matching application rules take precedence.
Changing this option is also write-free until a later horizontal focus action.

**Applications centered during horizontal focus** is empty by default. Enter
one exact, case-sensitive KWin `desktopFileName` per line to center only
matching destinations. Matching and the global option are combined: enabling
the global option centers every horizontal tiled-focus destination.

For a stacked destination, the rule checks the member actually selected by the
focus action, not another member in the same column. A missing or unmatched ID
keeps the normal minimal reveal. Replacing the list performs no immediate
layout, viewport, focus, or persistence write; it applies to the next left,
right, first, or last tiled-focus action.

**Keep a single tiled column centered** is disabled by default. When enabled,
one tiled column stays centered in its output, desktop, and activity; a stack
with multiple windows still counts as one column. This geometry invariant takes
precedence over viewport reveal and focus-centering policies. Floating windows
and contexts with two or more tiled columns are unaffected. Enabling it reflows
visible single-column contexts live. Disabling it stops enforcement without
forcing the current column away from its centered position.

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

## Numbered desktop back-and-forth

**Repeat the current desktop number to return to the last-used desktop** is
disabled by default. When enabled, repeating a numbered direct desktop action
whose resolved and clamped target is already current selects the valid,
distinct last-used desktop on the active output instead.

Missing history, a removed or stale historical target, and a rejected desktop
selection are no-ops. The adjacent desktop actions and the explicit **Focus
last-used desktop** action keep their existing behavior. Applying the setting
live does not select a desktop, alter selection history or layout, or write
geometry.

## Dynamic virtual desktops

Driftile always maintains one shared empty desktop after the last occupied
desktop. **Keep an empty virtual desktop before the first occupied desktop**
adds a separate empty desktop at the beginning and is disabled by default.
Occupying either boundary creates a replacement at that boundary.

Enabling the option applies live. Disabling it removes only an empty,
unselected leading desktop created by the current Driftile run; external,
occupied, and selected desktops remain untouched. While enabled, desktop
reordering keeps both boundary desktops pinned. Home Manager exposes the option
as `emptyDesktopAboveFirst`; its default `null` leaves the existing KConfig
value unmanaged.

## Window gap

**Window gap** controls spacing between tiled windows and work-area edges in
logical pixels. The default is `16`; the range is `0`–`64`, and `0` removes
gaps. The settings UI steps by `0.5`, while KConfig and Home Manager accept any
in-range numeric value, such as `1.2`.

Changes apply live to visible tiled contexts. Window order, widths, height
policies, focus, manually floating frames, automatically excluded windows, and
minimized frames stay unchanged. Hidden desktops use the new value when they
become visible. Driftile snaps solved edges to the output's physical-pixel grid;
when a scale cannot represent the requested subpixel spacing exactly, adjacent
physical gaps may differ by one pixel.

## Default column presentation

**Default column presentation** selects `stacked` or `tabbed` for every fresh
column without an exact application rule. The default is `stacked`. A tabbed
singleton retains that mode, so the next member immediately joins a tabbed
column.

Changing the value affects waiting admissions and columns created later. It
does not rewrite existing or restored columns, and a window joining an existing
column still adopts that target column's presentation.

## Default column width

**Default column width percentage** sets the proportional fallback for newly
admitted columns, fresh cross-context retiles, and the contextual **Reset
column width** action. Its default is `33%`; the range is `10%`–`100%`.

**Fixed default column width** optionally replaces that fallback with a fixed
logical-pixel policy on the same paths. `0` keeps the percentage above; positive
values range from `1px` through `16384px`. Structural splits and extractions
still inherit their source width.

A cross-context pointer drop into an empty column gutter is a structural
extraction and keeps the source width. Ordinary destination fallback is a fresh
singleton admission and reads the current application or global width policy.

Changing either value does not alter existing width policies or floating
frames. The next explicit reset applies the current fixed policy, or the
percentage fallback when fixed width is `0`, to the active tiled column or one
relation-free manually floating window; application-specific initial widths do
not override that reset. Newly admitted and reset widths remain subject to live
constraints and the assigned output's physical-pixel grid.

## Default window height

**Default initial tiled client height** controls the initial height policy for
new singleton tiled windows without an exact application rule. `auto` is the
default and preserves automatic height selection. Bare `10`–`100` values and
explicit `10%`–`100%` values select a percentage of the available tiled
height; `1px`–`16384px` selects a fixed logical client height.

The policy applies only to fresh singleton admission and fresh retiling after
the setting is applied. Existing and restored geometry is not rewritten, and
structural transfers keep their existing geometry. Exact application
initial-height rules override this global value. The solver's live client
constraints and the assigned output's physical-pixel grid remain authoritative.

## Application column widths

**Application column widths** override the initial width of new singleton
columns by exact KWin `desktopFileName`. Enter one `desktop-file-id=width` rule
per line. Bare `10`–`100` values retain the legacy percentage syntax, explicit
`10%`–`100%` values are equivalent, and `1px`–`16384px` selects a fixed logical
width. For example:

```text
org.kde.konsole=60
org.mozilla.firefox=960px
```

Blank lines are ignored, duplicate IDs and malformed rules reject the complete
settings update, and at most 128 rules are accepted. IDs are limited to 255
UTF-8 bytes.

Matching is case-sensitive. Windows without a matching usable ID keep the
global width default. Only fresh singleton admission consults the rule. A
window joining an existing column adopts that column's width; existing and
restored columns and the explicit reset action keep their normal policies.
Proportional and fixed logical widths are constrained by the admitted window
and snapped to the assigned output's physical-pixel grid. Updating the rules
performs no immediate layout or frame write.

## Application window heights

**Application initial tiled client heights** override the initial height of a
new singleton tiled window by exact, case-sensitive KWin `desktopFileName`.
Enter one `desktopFileName=height` rule per line. Bare `10`–`100` values and
explicit `10%`–`100%` values select a percentage of the available tiled height;
`1px`–`16384px` selects a fixed logical client height. For example:

```text
org.kde.konsole=60
org.mozilla.firefox=720px
```

Blank lines are ignored. Duplicate IDs, malformed rules, more than 128 rules,
or IDs longer than 255 UTF-8 bytes reject the complete settings update. A
window without a matching usable ID uses **Default initial tiled client
height**.

Exact application rules override the global height policy for fresh singleton
tiled admission and fresh retiling. Existing or restored geometry is not
rewritten, and structural transfers keep their existing geometry. The solver's
live client constraints and output-scale physical-pixel snapping remain
authoritative. Updating the rules performs no immediate layout or frame write.

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

## Application initial destinations

**Application initial destinations** assigns a genuinely new normal window to
a virtual desktop, output, or both before Driftile classifies and admits it.
Enter one exact, case-sensitive rule per line:

```text
org.mozilla.firefox=desktop:2,output:DP-2
org.kde.konsole=desktop-name:Development
org.telegram.desktop=output:HDMI-A-1
```

Desktop numbers are one-based positions in KWin's current desktop order and
range from `1` to `25`. `desktop-name` instead selects the one virtual desktop
whose current name matches exactly and case-sensitively. Do not combine
`desktop` and `desktop-name` in one rule. Missing or duplicate desktop names
reject the destination safely. Output names are exact KWin names. A
desktop-only rule keeps the window's output. An output-only rule uses the
selected desktop of the target output; moving to the same output keeps the
window's current desktop. Use KWin's debug console to inspect identifiers.

The assignment is fresh-only and one-shot. Startup-existing, restored,
already admitted, dialog, transient, and other non-normal windows are not
moved. The destination policy itself neither changes focus nor selects a
desktop. A missing output or desktop, unavailable public transfer API, or
rejected assignment leaves the window in its accepted KWin context and is not
retried. Renaming a virtual desktop affects future windows only; live rule
edits likewise affect only windows first tracked afterward.

After a confirmed assignment, initial floating and floating-position rules use
the destination work area, initial tiled sizing and presentation use the
destination layout context, an initial focus request runs after admission,
native maximize follows, and an initial fullscreen request runs last. The
policy adds no shortcut or persistence field. At most 128 rules are accepted;
application IDs, virtual desktop names, and output names are each limited to
255 UTF-8 bytes.

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

## Default floating position

**Default initial floating position** accepts the same `anchor,x,y` value as an
application floating-position rule. Blank disables it. It places a genuinely
new normal window when the window starts manually floating or first uses
**Toggle floating**; an exact application rule takes precedence.

The existing fresh-only guards, work-area clamping, output-pixel snapping, and
remembered manual frame remain authoritative. Changing the default does not
move an existing, restored, transferred, automatic, dialog, or already
positioned window.

## Application floating positions

**Application floating positions** places an exact, case-sensitive
`desktopFileName` when a genuinely new normal window first enters ordinary
manual floating. Enter one `desktopFileName=anchor,x,y` rule per line. Anchors
are `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`,
`bottom-left`, and `left`; `x` and `y` are signed logical-pixel offsets from
`-16384` through `16384`. Positive offsets point inward on an anchored edge;
the centered axis keeps the normal right or down direction. At most 128 rules
are accepted, and each ID is limited to 255 UTF-8 bytes.

```text
org.kde.kcalc=bottom-right,24,24
org.mozilla.firefox=top-left,32,32
```

The position applies when a fresh match starts through **Applications
initially floating**, or when a fresh tiled window first uses **Toggle
floating**. Driftile snaps the frame to the output's physical-pixel grid and
clamps its origin to the current work area without resizing it. Once that first
manual position is accepted, later tiling toggles use the remembered frame
instead of rereading the rule.

Startup-existing, restored, already manually floating, automatic, dialog, and
transient windows are not repositioned. Desktop and output transfers preserve
the current frame. Live edits affect only future first manual-floating
placements and add no persistence field.

## Applications initially focused

**Applications initially focused** requests focus once after Driftile admits a
genuinely new matching normal window to its tiled or floating layer. Enter
exact, case-sensitive KWin `desktopFileName` values, one per line, under the
application-list limits.

The request is made only when the destination desktop and output are already
visible. Driftile does not select a desktop or output to reveal the window.
When the request is unavailable or rejected, it is consumed without retry.
Unlisted applications keep KWin's ordinary focus behavior; this setting does
not suppress focus.

Startup-existing, restored, transferred, re-admitted, and already tracked
windows are unchanged. Initial destination and underlay admission settle
first; native maximize and fullscreen requests follow. Live edits affect only
windows first tracked afterward and add no shortcut or persistence field.

## Applications initially unfocused

**Applications initially unfocused** prevents a genuinely new matching normal
window from keeping initial focus. Enter exact, case-sensitive KWin
`desktopFileName` values, one per line, under the application-list limits.

After admission in an already visible desktop and output context, Driftile lets
KWin settle its ordinary activation once. If the new window became active, the
previous live visible window is restored; when none remains, active focus is
cleared once. A window that did not become active is left unchanged. Driftile
never selects a desktop or output for this rule.

The request is one-shot and is not retried when KWin rejects it. If the same
application appears in both initial-focus lists, this unfocused rule wins.
Startup-existing, restored, transferred, re-admitted, and already tracked
windows are unchanged. Native maximize and fullscreen requests follow the
focus decision. Live edits affect only windows first tracked afterward and add
no shortcut or persistence field.

## Applications initially full-width

**Applications initially full-width** opens a freshly admitted matching normal
tiled window as a full-width singleton column. Enter exact, case-sensitive KWin
`desktopFileName` values, one per line, under the application-list limits.

The matching application width or global default is retained as the
**Toggle full width** restore width. Startup, restored, transferred, joined,
re-tiled, or already admitted windows are unchanged. An initially floating or
automatically floating window does not use the rule. Live edits affect only
windows first tracked afterward and perform no immediate geometry write.

## Applications initially maximized to edges

**Applications initially maximized to edges** requests KWin's native
work-area-edge maximize for a freshly admitted exact normal-window match. This
is distinct from a Driftile full-width column: KWin owns the maximized state,
while the admitted tiled or floating state remains underneath for
restore.

Enter exact, case-sensitive KWin `desktopFileName` values, one per line, under
the application-list limits. Destination, initial floating placement, tiled
sizing, presentation, and full-width rules settle first. Native maximize is
requested next, and an initial fullscreen request runs last.

Startup, restored, transferred, re-admitted, and already tracked windows are
unchanged. Unsupported or rejected requests are consumed without retry. Live
edits affect only windows first tracked afterward and add no shortcut or
persistence field.

## Applications initially fullscreen

**Applications initially fullscreen** requests native fullscreen for a freshly
admitted exact normal-window match when KWin reports fullscreen support. The
admitted tiled, full-width, or floating state remains underneath, so leaving
fullscreen returns to that state.

Startup, restored, transferred, re-admitted, and already tracked windows are
unchanged. A rejected or unsupported request is not retried indefinitely. Live
edits affect only windows first tracked afterward and perform no immediate
state or geometry write.

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

**Column width step** controls the **Decrease column width** and **Increase
column width** actions. The default is `10%`; the range is `1%`–`50%`. It is a
percentage-point step of the gap-adjusted work-area span, not a percentage of
the current frame.

**Fixed column width step** optionally overrides that percentage with a fixed
logical-pixel delta. `0` uses the percentage step; positive values range from
`1px` through `16384px`. Both modes use the same live window constraints and
assigned output's physical-pixel grid, so a result can be clamped or snapped.

Changing either setting does not resize or move existing geometry. The next
explicit decrease or increase reads the current setting. Reset, presets, full
width, and available-width expansion are unchanged.

## Column width presets

**Column width presets** controls the contextual forward and backward preset
actions for the active tiled column or one relation-free manually floating
window. Enter up to 16 comma-separated values. Bare `10`–`100` values and
explicit `10%`–`100%` values are proportional; `1px`–`16384px` values are fixed
logical-pixel widths. Values must increase within each unit, while mixed values
retain their written cycle order. A blank value keeps the built-in exact thirds.

Changing the list performs no layout work and preserves existing column widths
and floating frames. The next preset action reads the new list and applies the
shared singleton resolution, live constraints, and physical-pixel grid.

## Window height step

**Window height step** controls the **Decrease window height** and **Increase
window height** actions. The default is `10%`; the range is `1%`–`50%`.

For a tiled active window, the value is a percentage-point step of the
gap-adjusted work-area height and the existing stack redistribution remains
unchanged. For an active manually floating window, it is a percentage of the
assigned work-area height with the gap excluded. The floating target preserves
width and top-left unless the partial-visibility bounds require a minimal
origin clamp. It snaps with the assigned output's device-pixel ratio and
respects live decorated size constraints.

**Fixed window height step** optionally overrides that percentage with a fixed
logical-pixel delta. `0` uses the percentage step; positive values range from
`1px` through `16384px`. Tiled and eligible manually floating paths retain
their existing redistribution and origin behavior, enforce live constraints,
and snap the result to the assigned output's physical-pixel grid.

Changing either setting performs no layout or frame write. The next explicit
decrease or increase reads the current setting. Window-height presets are
configured separately, and window-height reset remains tiled-only.

## Window height presets

**Window height presets** controls the forward and reverse preset actions for
the active tiled window or one eligible relation-free manually floating window.
A blank KConfig value or an empty Home Manager list preserves the built-in exact
`1/3`, `1/2`, and `2/3` proportions. A custom value accepts the same mixed
percentage and `1px`–`16384px` syntax as column-width presets. Fixed height is
the client height; KWin decorations remain outside that value.

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
trimming rejects the complete 33-setting snapshot. Accepted IDs have a
canonical sorted internal form. Home Manager exposes the same policy as
`programs.driftile.settings.applicationBorderlessExclusions`, a list rendered
as a sorted newline-delimited KConfig value.

Adding an exclusion live restores only decoration state Driftile claimed;
removing it lets the enabled global policy claim a decorated match. Changes to
the list or a window's `desktopFileName` reconcile live without issuing
Driftile geometry writes or changing focus, layout state, or layout
persistence. Global disable and extension unload restore owned state, while
pre-existing borderless state remains untouched.
