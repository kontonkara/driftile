# Installation

Driftile 1.81.0 is the latest stable release. It requires KDE Plasma with KWin
6.7 or newer and `kpackagetool6`, and targets Wayland, XWayland, and a
single-output native X11 session.
Touchpad navigation is available only on native Wayland. Run all commands as
the desktop user, not with `sudo`.

## Choose an installation path

- **Any compatible Linux distribution:** install the standard KWin package from
  [Install a release](#install-a-release).
- **NixOS:** use the system module under
  [NixOS](#nixos).
- **Home Manager:** use the per-user module under
  [Home Manager](#home-manager).

## Install a release

Download these files from the
[`v1.81.0` release](https://github.com/kontonkara/driftile/releases/tag/v1.81.0):

- `driftile-1.81.0.kwinscript`
- `driftile-overview-1.81.0.kwineffect` if using the optional overview
- `driftile-transitions-1.81.0.kwineffect` if using optional geometry
  transitions
- `SHA256SUMS`
- `LICENSE`
- `driftile-shortcuts-1.81.0.mjs` if using the optional shortcut helper

Verify every downloaded release asset before installing it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

Install the KWin package:

```bash
kpackagetool6 --type=KWin/Script \
  --install ./driftile-1.81.0.kwinscript
```

Open **System Settings > Window Management > KWin Scripts**, enable
**Driftile**, and select **Apply**. The configure button on the same page opens
the layout and presentation settings described in
[Configuration](configuration.md).

### Optional overview

Install the optional overview effect separately:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-overview-1.81.0.kwineffect
```

Enable **Driftile Overview** under **System Settings > Window Management >
Desktop Effects**. Its configure button controls appearance, screen-edge, and
touchpad access. See [Overview companion](overview.md) for its controls.

### Optional transitions

Install the optional transition effect separately:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-transitions-1.81.0.kwineffect
```

Enable **Driftile Transitions** under **System Settings > Window Management >
Desktop Effects**. Its configure button sets a `0`–`1000` millisecond base
duration; `0` disables animation. Plasma's global animation-speed setting still
scales the selected duration. The effect also provides easing and small-resize
threshold controls. It changes only presentation and remains disabled by
default.

## Configure shortcuts

Driftile works without the companion helper. The 1.81.0 helper claims the
bundled defaults and accepts custom profiles. Any action can instead be
assigned manually.

### Reversible helper

The versioned helper needs Node.js 22 or newer, `busctl`, and `flock`. Enable
Driftile before running it, and keep the helper until its saved claim has been
released.

```bash
node ./driftile-shortcuts-1.81.0.mjs claim
node ./driftile-shortcuts-1.81.0.mjs check
```

`claim` transactionally saves and replaces active conflicting assignments.
`release` restores unchanged assignments while preserving shortcuts edited
after the claim:

```bash
node ./driftile-shortcuts-1.81.0.mjs release
```

If `release` reports assignments edited after the claim, stop and resolve them
in System Settings before retrying. Do not use `--force` during an upgrade,
rollback, or removal. See [Shortcuts](shortcuts.md) for the complete default
profile, custom JSON v1 schema, and recovery details.

Pass the same custom file to `claim` and `check`. `release` reads the saved
transaction and rejects `--profile`:

```bash
node ./driftile-shortcuts-1.81.0.mjs claim --profile ./shortcuts.json
node ./driftile-shortcuts-1.81.0.mjs check --profile ./shortcuts.json
node ./driftile-shortcuts-1.81.0.mjs release
```

Release the current claim before claiming a changed profile.

### Manual assignment

Open **System Settings > Keyboard > Shortcuts**, search for **Driftile**, and
assign the actions you want. Resolve each reported conflict in System Settings.
This path needs no helper and allows a partial shortcut profile, but it cannot
restore displaced assignments automatically.

### Optional native shortcut editor

Driftile provides **Driftile Shortcuts**, an optional Qt/KDE editor for the
active extension's primary and alternate assignments. Enable
Driftile before starting it; an inactive extension has no registered actions to
edit. Changes remain local to the window until **Apply** is pressed. Apply
checks the complete pending assignment and current KGlobalAccel owners, rejects
conflicts or external changes, then writes and verifies the changed actions as
one rollback-capable transaction.

The editor is separate from the KWin package, so ordinary installations remain
lightweight. To build it from a 1.81.0 checkout, install CMake 3.22 or
newer, a C++20 compiler, Qt 6.7 development files for Core, DBus, and Widgets,
and KDE Frameworks 6 development files for GlobalAccel and XmlGui. Then run:

```bash
cmake -S native/shortcut-editor -B build/shortcut-editor \
  -DCMAKE_BUILD_TYPE=Release \
  -DDRIFTILE_VERSION=1.81.0 \
  -DCMAKE_INSTALL_PREFIX="$HOME/.local"
cmake --build build/shortcut-editor --parallel
cmake --install build/shortcut-editor
"$HOME/.local/bin/driftile-shortcut-editor"
```

The flake exposes the separate `driftile-shortcut-editor` package:

```bash
nix build .#driftile-shortcut-editor
./result/bin/driftile-shortcut-editor
```

After importing the current NixOS or Home Manager module, install it without
adding the GUI dependencies to the main package:

```nix
programs.driftile.shortcutEditor.enable = true;
```

The editor changes live assignments only. Keep using the reversible helper for
saved claim/release transactions or JSON profiles.

The package installs a freedesktop launcher and AppStream metadata,
exposes `--help` and `--version`, displays registered defaults, and restores
either the selected default or the complete default set as unapplied changes.
The same conflict checks and rollback-capable Apply transaction remain
authoritative.

## Upgrade

1. If the helper owns the profile, release it with the helper from the
   installed version. Stop on a preserved manual-edit conflict and resolve it
   in System Settings; do not use `--force`. If an old helper was already
   replaced, the new helper can still release its saved v1 transaction.
2. Disable Driftile in **KWin Scripts** and the optional overview and
   transition effects in **Desktop Effects**, then select **Apply**.
3. Download and verify the matching main package, optional overview and
   transition effects, checksum manifest, and helper.
4. Upgrade the package:

   ```bash
   kpackagetool6 --type=KWin/Script \
     --upgrade ./driftile-<new-version>.kwinscript
   ```

5. Enable Driftile and review its configuration.
6. If using the helper, claim the new profile and run `check` with the same
   optional custom profile.
7. Re-enable the optional overview and transition effects.

Manually assigned KGlobalAccel shortcuts remain unchanged across an upgrade.
Edit them in System Settings only when the fresh release defaults are wanted.

Read [Migration](migration.md) before upgrading across release generations;
it records any version-specific session or option changes.

## Disable or uninstall

Before disabling Driftile, release a helper-managed shortcut profile. For a
manual profile, restore any assignments you want to keep through System
Settings. Then disable Driftile in **KWin Scripts** and select **Apply**.

After releasing shortcuts and disabling the extension, uninstall it with:

```bash
kpackagetool6 --type=KWin/Script \
  --remove io.github.kontonkara.driftile
```

Remove each installed optional effect independently:

```bash
kpackagetool6 --type=KWin/Effect \
  --remove io.github.kontonkara.driftile.overview
```

```bash
kpackagetool6 --type=KWin/Effect \
  --remove io.github.kontonkara.driftile.transitions
```

If `release` reports assignments changed after the claim, it has preserved
those edits. Resolve them before deleting the helper; forcing a release may
overwrite them.

If the saved claim file is lost or corrupt, the helper fails closed because it
cannot reconstruct displaced assignments. Restore shortcuts manually in
System Settings before removing `$XDG_STATE_HOME/driftile/shortcut-claim.json`.
When `XDG_STATE_HOME` is unset, the file is under
`$HOME/.local/state/driftile/shortcut-claim.json`.

Uninstalling the package does not delete configuration or layout data. For an
optional clean removal, first complete the shortcut release and uninstall
steps above, then remove Driftile's stored KConfig values and layout snapshot:

```bash
kwriteconfig6 --file kwinrc --group Plugins \
  --key io.github.kontonkara.driftileEnabled --delete ""
for key in ApplicationBorderlessExclusions ApplicationColumnPresentations \
  ApplicationColumnWidths ApplicationFloatingPositions \
  ApplicationFocusCentering ApplicationInitialDestinations \
  ApplicationInitialFocused ApplicationInitialUnfocused \
  ApplicationInitialFloating ApplicationInitialLayouts \
  ApplicationInitialFullscreen \
  ApplicationInitialFullWidth ApplicationInitialMaximized \
  ApplicationTilingExclusions ApplicationWindowHeights \
  AlwaysCenterSingleColumn BorderlessWindows CenterFocusedColumn \
  CenterFocusedColumnOnOverflow ColumnWidthPresets ColumnWidthStepPercent \
  ColumnWidthStepPixels DefaultColumnPresentation DefaultColumnWidthPercent \
  DefaultColumnWidthPixels DefaultInitialLayout DefaultWindowHeight \
  EmptyDesktopAboveFirst Gap \
  NumberedDesktopTargets ShowTabIndicator TouchpadNavigation \
  TouchpadWorkspaceNavigation TouchpadNavigationFingerCount \
  TouchpadNaturalScroll WindowHeightPresets WindowHeightStepPercent \
  WindowHeightStepPixels WorkspaceAutoBackAndForth; do
  kwriteconfig6 --file kwinrc \
    --group Script-io.github.kontonkara.driftile \
    --key "$key" --delete ""
done
for key in BackdropColor OverviewZoom ScreenEdge ShowApplicationIcons \
  ShowApplicationIdentity ShowDesktopNames ShowOutputNames \
  ShowWindowCloseButtons ShowWindowLabels ShowWindowStateBadges \
  TouchpadGesture TouchpadGestureFingerCount; do
  kwriteconfig6 --file kwinrc \
    --group Effect-io.github.kontonkara.driftile.overview \
    --key "$key" --delete ""
done
for key in AnimatePosition AnimateSize Duration EasingCurve \
  ResizeAnimationThreshold WindowCaptionExclusions WindowClassExclusions \
  WindowRoleExclusions; do
  kwriteconfig6 --file kwinrc \
    --group Effect-io.github.kontonkara.driftile.transitions \
    --key "$key" --delete ""
done
rm -- "${XDG_CONFIG_HOME:-$HOME/.config}/driftile-layout-state.ini"
```

Delete the shortcut claim file only after a successful release. Shortcuts
assigned manually remain in KGlobalAccel and must be removed through System
Settings.

## NixOS and Home Manager

The flake exposes packages and installation modules for `x86_64-linux` and
`aarch64-linux`. Add Driftile as an input:

```nix
inputs.driftile.url = "github:kontonkara/driftile/v1.81.0";
```

### NixOS

For a system-wide NixOS installation, import the NixOS module:

```nix
modules = [
  driftile.nixosModules.default
  {
    programs.driftile.enable = true;
  }
];
```

### Home Manager

For a per-user installation, import the module into an existing Home Manager
configuration:

```nix
modules = [
  driftile.homeManagerModules.default
  {
    programs.driftile.enable = true;
  }
];
```

### Shared options

Optional companions remain separate and disabled unless requested:

```nix
programs.driftile.overview.enable = true;
programs.driftile.transitions.enable = true;
programs.driftile.shortcutEditor.enable = true;
```

The modules install packages but do not enable KWin effects. Enable **Driftile
Overview** or **Driftile Transitions** in **Desktop Effects** after rebuilding.
Home Manager can also own the main settings and nullable companion settings:

```nix
programs.driftile.settings = {
  gap = 16;
  defaultColumnWidthPercent = 33;
};

programs.driftile.overview.screenEdge = "top-left";
programs.driftile.transitions.duration = 180;
```

See [Configuration](configuration.md#home-manager) for the complete typed
settings and companion options, and [Shortcuts](shortcuts.md#custom-profiles)
for declarative shortcut profiles. When NixOS installs the package system-wide,
Home Manager can manage settings with `programs.driftile.enable = false` to
avoid installing the same KWin package twice.

Choose one installation scope for each package ID. Rebuild, then enable and
configure Driftile in System Settings. Before upgrading or removing a Nix
package, release any helper-owned shortcut profile while
`driftile-shortcuts` is still available.

## Compatibility and migration

See [Compatibility](compatibility.md) for current platform, geometry, toolkit,
and hardware limits. Read [Migration](migration.md) before changing release or
installation generations. Published artifacts and version-specific notes are
available on [GitHub Releases](https://github.com/kontonkara/driftile/releases).
