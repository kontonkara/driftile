# Troubleshooting

Run all commands as the desktop user, never with `sudo`. Driftile requires KWin
6.7 or newer; see [Installation](installation.md) for supported installation
paths.

## The script does not load

Open **System Settings > Window Management > KWin Scripts**, enable
**Driftile**, and select **Apply**. On a systemd-based desktop with `busctl`,
check the live KWin state:

```bash
busctl --user --json=short call \
  org.kde.KWin /Scripting org.kde.kwin.Scripting \
  isScriptLoaded s io.github.kontonkara.driftile
```

The reply must contain `"data":[true]`. If it is false, ask KWin to reload its
enabled scripts, then check again:

```bash
busctl --user call \
  org.kde.KWin /Scripting org.kde.kwin.Scripting start
```

If loading still fails, collect the KWin log below. Confirm that only one of
the release archive, NixOS module, or Home Manager module installs the package;
duplicate packages with the same ID make selection ambiguous. Follow the
disable-first [upgrade procedure](installation.md#upgrade) before reinstalling.
When `busctl` is unavailable, use the enabled state in System Settings and the
distribution's KWin log source instead.

## Shortcuts do not work

First confirm that the script is loaded. KGlobalAccel is the live source of
truth, so inspect **System Settings > Keyboard > Shortcuts**, search for
**Driftile**, and resolve conflicts there. The complete bindings and ownership
rules are in [Shortcuts](shortcuts.md#shortcut-ownership).

For helper-managed bindings, run `driftile-shortcuts check` or the matching
versioned helper's `check` command. `claim` saves displaced assignments before
changing them; `release` restores unchanged assignments and preserves later
manual edits. Do not use `--force` unless overwriting those edits is intended.

If the claim file is missing or corrupt, the helper cannot reconstruct the
displaced assignments and fails closed. Restore them manually in System
Settings before removing
`${XDG_STATE_HOME:-$HOME/.local/state}/driftile/shortcut-claim.json`. See
[Installation](installation.md#configure-shortcuts) for helper commands and
custom profiles.

## The overview does not open

When the current activation attempt is rejected, Driftile requests one
best-effort Plasma OSD with a generic message. If the OSD service is
unavailable, no message may appear. Reproduce the rejection once and inspect
the recent KWin journal for the exact technical reason. Cancellation, a stale
callback, successful activation, and normal close intentionally show no OSD.

## A window does not tile

Driftile tiles normal, resizable application windows. It intentionally leaves
dialogs, modal or transient windows, non-resizable or fixed-size normal
windows, special windows, and all-desktop windows outside layout ownership. A
manually floating window returns only through **Toggle floating**. KWin retains
geometry authority while a window is fullscreen, maximized, minimized,
interactively moved or resized, or natively tiled.

Also check **Applications excluded from tiling** in Driftile's settings. The
entries match KWin's exact, case-sensitive `desktopFileName`; clearing a match
allows fresh admission after KWin releases any native-state blocker.

On multiple outputs, an otherwise eligible window can wait when admitting it
would exceed visible capacity. It is retried after space or topology recovers.
Review the ownership boundary and current exclusions in
[Product scope](product-scope.md#kde-owned). Also check KWin Window Rules that
may change the window's role, size constraints, desktop membership, or native
tiling state.

## A window keeps or loses KWin decorations unexpectedly

First check **Hide KWin borders and title bars on application windows**.
`BorderlessWindows=false` dominates the per-application list and keeps Driftile
from applying borderless policy.

For one application, check **Applications keeping KWin borders and title
bars**. Entries match only the exact, case-sensitive KWin `desktopFileName`;
there is no fallback to another identity. A missing or empty ID is not
excluded, and an empty list retains the global behavior. Duplicate, malformed,
or oversized input rejects the complete settings update and leaves the prior
snapshot active.

An exclusion preserves the window's existing KWin decoration state; it does not
force a border onto a window already made borderless by KWin, a Window Rule, or
the application. Client-side decorations and application toolbars are part of
the application surface and are not controlled by this setting. List and
`desktopFileName` changes apply live.

## A layout does not restore

Persistence is conservative. A corrupt, stale, incompatible, ambiguous, or
incomplete snapshot is rejected as a whole; it cannot create partial ownership
or geometry writes. Driftile then uses normal admission when safe. Future or
oversized formats remain write-locked for that run. See the
[persistence boundary](architecture.md#persistence-boundary) for the matching
rules.

To intentionally discard the stored layout, disable Driftile in **KWin
Scripts** and select **Apply**. When `busctl` is available, confirm that
`isScriptLoaded` returns false. Only then move the state file aside:

```bash
state="${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini"
if [ -e "$state" ]; then
  mv -- "$state" "$state.bak.$(date +%s)"
fi
```

Re-enable Driftile to build a fresh layout. Never remove this file while the
script is loaded: its final or debounced state flush can recreate it. This
reset does not change settings or shortcut ownership.

## X11 and geometry limits

Wayland and XWayland share the same layout model. Native X11 is verified on one
output; native X11 multi-output remains unverified. KWin 6.7 does not expose
X11 base size, resize increments, aspect bounds, or strict-geometry policy to
the scripting API. Driftile therefore models exposed minimum and maximum sizes
but does not quantize layouts to hidden hints. Native X11 applications may
still have their requested frames adjusted by KWin. See
[Compatibility](compatibility.md) for the exact boundary.

## Collect a minimal report

Reproduce the problem once, then include the loaded-state reply when available,
the affected application, output count, exact action, and these facts:

```bash
printf 'session=%s desktop=%s display=%s wayland_display=%s\n' \
  "${XDG_SESSION_TYPE:-unknown}" "${XDG_CURRENT_DESKTOP:-unknown}" \
  "${DISPLAY:-unset}" "${WAYLAND_DISPLAY:-unset}"

if [ "${XDG_SESSION_TYPE:-}" = "x11" ]; then
  kwin_x11 --version
else
  kwin_wayland --version
fi
```

On a systemd-based desktop, capture only the recent KWin journal around the
reproduction:

```bash
journalctl --user -b --since "5 minutes ago" --no-pager \
  -o short-precise _COMM=kwin_wayland _COMM=kwin_x11 >kwin.log
```

On other systems, use the distribution's log viewer and limit the output to
the KWin process and the reproduction interval.

State whether the affected application is native Wayland, XWayland, or native
X11 when known. Remove unrelated sensitive application output before sharing
the log.

## Disable or uninstall safely

Release a helper-managed shortcut profile while its helper is still available,
then disable Driftile and select **Apply** before changing the package. Follow
[Disable or uninstall](installation.md#disable-or-uninstall) for release,
package, NixOS, Home Manager, and optional clean-removal steps. Do not delete a
shortcut claim file until `release` has succeeded; uninstalling the package
alone intentionally retains settings, layout state, and manually assigned
shortcuts.
