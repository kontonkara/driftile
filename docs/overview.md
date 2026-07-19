# Spatial Overview

Driftile Overview is an optional KWin effect that shows the layout published by
the main Driftile script as one spatial plane. It does not maintain another
layout model or take layout ownership. Plasma's built-in Overview remains
available and is not replaced or reconfigured.

The effect is disabled by default. After installing it, enable it under
**System Settings > Window Management > Desktop Effects**. A fresh shortcut
record uses `Meta+O`; existing KGlobalAccel assignments, including an explicitly
unbound action, are preserved during upgrades.

`driftile_open_overview` and `driftile_close_overview` are separate unbound
actions for automation. Opening an already active or pending Overview and
closing an inactive Overview are safe no-ops.

## Spatial plane

Each output gets its own output-local plane. Its virtual desktops are continuous
full-width rows stacked vertically, with the current desktop centered when the
effect opens. Neighboring rows remain spatially above and below it instead of
being presented as independent cards. Rows outside the bounded visible range
are not instantiated.

Every row uses the normal layout solver for its usable work area, pixel grid,
gaps, horizontal camera, columns, and member frames. Captured rows preserve
those exact solved frames. The current row can replace a complete captured
column with guarded public live KWin geometry; an incomplete, stale, or
inconsistent live column fails closed and keeps its solved projection.

Stacked columns show every eligible member in its exact solved or live frame. A
tabbed column shows only its selected member at the exact full shared frame.
The Overview does not add a synthetic tab strip, member guide, or thumbnail
inset. Floating windows retain their output-local geometry. Minimized windows
are excluded from the main spatial plane.

The horizontal camera is session-only. It initially matches the authoritative
layout viewport, follows a valid active tiled window, and can be detached by
manual horizontal input. Overview navigation never writes a viewport offset
back to Driftile.

## Motion and input

Opening zooms continuously from the active workspace into the spatial plane.
Closing reverses the same presentation, including a close requested before the
opening motion has finished. A manually panned current row returns to its live
camera during the close zoom; reopening mid-transition reverses that return.

Discrete vertical navigation moves a bounded camera smoothly between workspace
rows. Precise wheel or touchpad input moves the camera directly, without being
converted into delayed steps. Precise horizontal input similarly pans only the
row under the pointer. Holding `Shift` maps a conventional vertical wheel to
horizontal row movement.

An ordinary vertical wheel selects the previous or next desktop without
wrapping. Horizontal discrete input selects and reveals the previous or next
column. Rapid discrete input is coalesced, while a direction reversal cancels
pending movement in the old direction.

Dragging empty space pans the workspace plane vertically. Dragging empty space
inside a row pans that row horizontally within its finite bounds. Window and
desktop drags can continue navigation through the matching edge zones. A
right-button drag pans the row under the pointer horizontally, including when
the drag starts over a window thumbnail. No pan, wheel, gesture, or reveal
operation changes persisted layout state.

The optional touchpad activation gesture uses KWin's native Wayland API. It is a
safe no-op on native X11. Four fingers are used by default when the gesture is
enabled; choose a different count or disable a conflicting Plasma gesture so
one global direction has one owner.

## Window and workspace interaction

On opening, keyboard selection prefers the active actionable window, then the
first actionable window on the current desktop, then the first target in visual
order. Arrow keys move spatially without wrapping. `Tab` and `Shift+Tab`
cycle visible targets; `Home` and `End` select the first or last target.

`Enter`, `Return`, or `Space` activates the selected live window or
workspace through guarded public KWin APIs. `Delete` requests closure of a
selected closeable window. `Escape` clears a non-empty search first and
otherwise closes the effect.

Only the selected member of a tabbed column is a target in the spatial plane.
Unselected tabbed members and minimized windows do not receive synthetic
targets. Off-screen targets in an instantiated row remain navigable and are
revealed when selected.

A left click activates a visible window or selects a non-current workspace.
Dragging a visible window can transfer it to another desktop or output after
the source and destination are revalidated. Holding the dragged window over
another workspace activates that workspace after a bounded dwell while keeping
the drag active. Dragging the compact workspace number marker reorders eligible
desktops. The protected final empty desktop is never reordered or crossed.

Adding, removing, or reordering virtual desktops refreshes an active Overview
in place. Activity and output topology changes still close a stale scene
instead of applying input to uncertain targets.

## Search

Typing filters eligible projected windows with case-insensitive AND matching
across title, application identity, desktop name, output name, and live state.
The supported scopes are:

- `title:`
- `app:`
- `desktop:`
- `output:`
- `state:`

Double quotes match a phrase, a leading `-` excludes a clause, and a standalone
`|` separates up to four alternative groups. For example:

```text
app:firefox title:"release notes" | app:konsole "build log"
```

Malformed recognized syntax fails closed and exposes no partial result.
`Backspace` removes one Unicode code point, `Ctrl+Backspace` removes the
trailing structured clause, and `Ctrl+U` clears the query. The query is
session-only.

`F1` opens the compact keyboard reference. While it is open, background input
is inactive; `F1` or `Escape` closes the panel first.

## Optional appearance

The spatial plane starts without decorative overlays. These settings are all
disabled by default and can be enabled independently:

- desktop names;
- output names;
- window labels;
- application identity and icons;
- window close buttons;
- window state badges.

Invalid or non-boolean values fall back to disabled. Search fields remain
available when their visual labels are hidden. Appearance options do not alter
layout geometry or persistence; close buttons only expose the existing guarded
close request.

Backdrop color and zoom are configurable. Zoom accepts values from `0.2`
through `0.75` and defaults to `0.5`. The pointer screen edge defaults to
`none`, so the effect reserves no edge unless one is explicitly configured.

## Installation and configuration

Install the main package before the optional Overview package. The
[installation guide](installation.md#optional-overview) contains KPackage,
upgrade, and removal commands for ordinary distributions.

NixOS and Home Manager keep the effect opt-in:

```nix
programs.driftile.overview.enable = true;
```

Home Manager can manage access and appearance with nullable options. A `null`
value leaves the existing KConfig entry untouched. See
[Configuration](configuration.md#optional-overview-access-and-appearance).
Neither Nix module enables the effect inside KWin; enable it in **Desktop
Effects** after rebuilding. Do not install the same package ID through both
NixOS and Home Manager for one user.

## Safety boundary

The effect opens only from a stable layout snapshot matching KWin's current
activity, outputs, desktops, and windows. Missing, future, malformed, changing,
or stale state keeps it closed.

Every focus, close, desktop selection, reorder, and transfer revalidates its
live target before using a public KWin API. Invalid targets fail safely, and a
stale effect closes without taking layout ownership. Disabling or uninstalling
the effect leaves the main extension and Plasma's built-in Overview unchanged.

See [Compatibility](compatibility.md) for backend limits and
[Architecture](architecture.md) for the validation boundary.
