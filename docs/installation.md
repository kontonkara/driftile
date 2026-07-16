# Installation

Driftile 1.39.0 is the latest stable release. It requires KDE Plasma with KWin
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
[`v1.39.0` release](https://github.com/kontonkara/driftile/releases/tag/v1.39.0):

- `driftile-1.39.0.kwinscript`
- `driftile-overview-1.39.0.kwineffect` if using the optional overview
- `driftile-transitions-1.39.0.kwineffect` if using optional geometry
  transitions
- `SHA256SUMS`
- `LICENSE`
- `driftile-shortcuts-1.39.0.mjs` if using the optional shortcut helper

Verify every downloaded release asset before installing it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

Install the KWin package:

```bash
kpackagetool6 --type=KWin/Script \
  --install ./driftile-1.39.0.kwinscript
```

Open **System Settings > Window Management > KWin Scripts**, enable
**Driftile**, and select **Apply**. The configure button on the same page opens
the layout and presentation settings described in
[Configuration](configuration.md).

### Optional transitions

Install the optional transition effect separately:

```bash
kpackagetool6 --type=KWin/Effect \
  --install ./driftile-transitions-1.39.0.kwineffect
```

Enable **Driftile Transitions** under **System Settings > Window Management >
Desktop Effects**. Its configure button sets a `0`–`1000` millisecond base
duration; `0` disables animation. Plasma's global animation-speed setting still
scales the selected duration. The effect also provides easing and small-resize
threshold controls. It changes only presentation and remains disabled by
default.

## Configure shortcuts

Driftile works without the companion helper. The 1.39.0 helper claims the
bundled defaults and accepts custom profiles. Any action can instead be
assigned manually.

### Reversible helper

The versioned helper needs Node.js 22 or newer, `busctl`, and `flock`. Enable
Driftile before running it, and keep the helper until its saved claim has been
released.

```bash
node ./driftile-shortcuts-1.39.0.mjs claim
node ./driftile-shortcuts-1.39.0.mjs check
```

`claim` transactionally saves and replaces active conflicting assignments.
`release` restores unchanged assignments while preserving shortcuts edited
after the claim:

```bash
node ./driftile-shortcuts-1.39.0.mjs release
```

If `release` reports assignments edited after the claim, stop and resolve them
in System Settings before retrying. Do not use `--force` during an upgrade,
rollback, or removal. See [Shortcuts](shortcuts.md) for the complete default
profile, custom JSON v1 schema, and recovery details.

Pass the same custom file to `claim` and `check`. `release` reads the saved
transaction and rejects `--profile`:

```bash
node ./driftile-shortcuts-1.39.0.mjs claim --profile ./shortcuts.json
node ./driftile-shortcuts-1.39.0.mjs check --profile ./shortcuts.json
node ./driftile-shortcuts-1.39.0.mjs release
```

Release the current claim before claiming a changed profile.

### Manual assignment

Open **System Settings > Keyboard > Shortcuts**, search for **Driftile**, and
assign the actions you want. Resolve each reported conflict in System Settings.
This path needs no helper and allows a partial shortcut profile, but it cannot
restore displaced assignments automatically.

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

5. When upgrading to 1.19.0 from 1.18.0 or 1.19.0-rc.1, restart the Plasma
   session once. Fresh installations do not require this step.
6. Enable Driftile and review its configuration.
7. If using the helper, claim the new profile and run `check` with the same
   optional custom profile.
8. Re-enable the optional overview and transition effects.

Manually assigned KGlobalAccel shortcuts remain unchanged across an upgrade.
Edit them in System Settings only when the fresh release defaults are wanted.

Release packages keep KWin's required entrypoints stable and select the
complete QML and JavaScript runtime by content hash. After the one-time 1.19.0
transition, changed runtimes no longer reuse an older in-memory component.

## Disable or uninstall

Before disabling Driftile, release a helper-managed shortcut profile. For a
manual profile, restore any assignments you want to keep through System
Settings. Then disable Driftile in **KWin Scripts** and select **Apply**.

After releasing shortcuts and disabling the extension, uninstall it with:

```bash
kpackagetool6 --type=KWin/Script \
  --remove io.github.kontonkara.driftile
```

Remove the optional transition effect independently:

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
  ApplicationInitialFocused ApplicationInitialFloating \
  ApplicationInitialFullscreen \
  ApplicationInitialFullWidth ApplicationInitialMaximized \
  ApplicationTilingExclusions ApplicationWindowHeights \
  AlwaysCenterSingleColumn BorderlessWindows CenterFocusedColumn \
  CenterFocusedColumnOnOverflow ColumnWidthPresets ColumnWidthStepPercent \
  ColumnWidthStepPixels DefaultColumnPresentation DefaultColumnWidthPercent \
  DefaultColumnWidthPixels DefaultWindowHeight EmptyDesktopAboveFirst Gap \
  ShowTabIndicator TouchpadNavigation \
  TouchpadWorkspaceNavigation TouchpadNavigationFingerCount \
  TouchpadNaturalScroll WindowHeightPresets WindowHeightStepPercent \
  WindowHeightStepPixels WorkspaceAutoBackAndForth; do
  kwriteconfig6 --file kwinrc \
    --group Script-io.github.kontonkara.driftile \
    --key "$key" --delete ""
done
for key in TouchpadGesture TouchpadGestureFingerCount; do
  kwriteconfig6 --file kwinrc \
    --group Effect-io.github.kontonkara.driftile.overview \
    --key "$key" --delete ""
done
for key in AnimatePosition AnimateSize Duration EasingCurve \
  ResizeAnimationThreshold WindowClassExclusions; do
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
inputs.driftile.url = "github:kontonkara/driftile/v1.39.0";
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

The 1.39.0 module exposes the optional overview as a separate package. It
remains disabled unless requested:

```nix
programs.driftile.overview.enable = true;
programs.driftile.overview.touchpadGesture = {
  enable = true;
  fingerCount = 4;
};
```

`overview.touchpadGesture` is a Home Manager-only nullable profile. Its default
is `null`, which leaves the effect's existing gesture values untouched; it can
manage an overview installed in another scope.

The modules also expose the optional transition effect as an independent
package:

```nix
programs.driftile.transitions.enable = true;
programs.driftile.transitions.duration = 180;
programs.driftile.transitions.animatePosition = true;
programs.driftile.transitions.animateSize = true;
programs.driftile.transitions.windowClassExclusions = [ ];
```

Installation does not enable the effect in KWin. Enable **Driftile
Transitions** in **Desktop Effects** after rebuilding.

The duration is a nullable integer from `0` to `1000`; both animation switches
and the bounded exact `windowClass` list are nullable too. Each default is
`null`, which leaves that KWin setting untouched. These options can manage an
effect installed in another scope without setting `transitions.enable`.

Main-script, overview, and transition ownership are independent. NixOS may
install one while Home Manager installs another, but the modules reject
installing the same package ID in both scopes for one user. The overview module
does not enable its effect in KWin. On a fresh shortcut record, the enabled
overview offers `Meta+O`; upgrades preserve the current KGlobalAccel
assignment. See [Overview companion](overview.md).

The current Home Manager module exposes a complete settings profile:

```nix
programs.driftile.settings = {
  applicationBorderlessExclusions = [ ];
  applicationColumnPresentations = {
    "org.mozilla.firefox" = "tabbed";
  };
  applicationColumnWidths = {
    "org.kde.konsole" = 60;
  };
  applicationFocusCentering = [ ];
  applicationInitialDestinations = {
    "org.mozilla.firefox" = {
      desktop = 2;
      output = "DP-2";
    };
  };
  applicationInitialFocused = [ ];
  applicationInitialFloating = [ ];
  applicationFloatingPositions = {
    "org.kde.kcalc" = {
      anchor = "bottom-right";
      x = 24;
      y = 24;
    };
  };
  applicationInitialFullWidth = [ ];
  applicationInitialMaximized = [ ];
  applicationInitialFullscreen = [ ];
  applicationTilingExclusions = [ ];
  borderlessWindows = true;
  centerFocusedColumn = false;
  columnWidthPresets = [ 20 50 80 ];
  defaultColumnPresentation = "stacked";
  gap = 16;
  showTabIndicator = true;
  defaultColumnWidthPercent = 33;
  defaultColumnWidthPixels = 0;
  columnWidthStepPercent = 10;
  touchpadNavigation = false;
  touchpadWorkspaceNavigation = false;
  touchpadNavigationFingerCount = 5;
  touchpadNaturalScroll = true;
  windowHeightPresets = [ ];
  windowHeightStepPercent = 10;
};
```

Application policy lists default to empty; an empty `windowHeightPresets` list
keeps the exact built-in `1/3`, `1/2`, and `2/3` cycle. See
[Application column presentation](configuration.md#application-column-presentation),
[Horizontal focus centering](configuration.md#horizontal-focus-centering),
[Application initial destinations](configuration.md#application-initial-destinations),
[Applications initially focused](configuration.md#applications-initially-focused),
[Applications initially floating](configuration.md#applications-initially-floating),
[Application floating positions](configuration.md#application-floating-positions),
[Applications initially maximized to edges](configuration.md#applications-initially-maximized-to-edges),
[Window height presets](configuration.md#window-height-presets),
and
[Application borderless exclusions](configuration.md#application-borderless-exclusions)
for exact matching, limits, and live behavior.

The profile is independent of package installation. When the package is
already installed by NixOS or another system module, keep
`programs.driftile.enable = false` and set `programs.driftile.settings` in Home
Manager. See [Configuration](configuration.md#home-manager) for ownership and
reload behavior.

The 1.39.0 Home Manager module can also generate a custom shortcut profile:

```nix
programs.driftile.shortcuts = {
  driftile_focus_column_left = [ "Meta+A" "Meta+Left" ];
  driftile_reset_column_width = [ ];
};
```

This writes JSON v1 to `$XDG_CONFIG_HOME/driftile/shortcuts.json` (normally
`~/.config/driftile/shortcuts.json`). It does not claim shortcuts
automatically. After rebuilding, enable Driftile and run:

```bash
profile="${XDG_CONFIG_HOME:-$HOME/.config}/driftile/shortcuts.json"
driftile-shortcuts claim --profile "$profile"
driftile-shortcuts check --profile "$profile"
```

For a system-wide NixOS installation, import the Home Manager module only for
settings or a shortcut profile and leave Home Manager's
`programs.driftile.enable` false. The system package supplies
`driftile-shortcuts`, while Home Manager manages only the requested user
configuration; this avoids installing the KWin package twice.

`programs.driftile.package` can override the package in either module. Choose
one installation scope for each user instead of also installing the
`.kwinscript`; multiple copies with the same KWin package ID can make package
selection ambiguous. Rebuild the NixOS or Home Manager generation, then enable
and configure Driftile in System Settings.

The Nix package provides the shortcut helper as `driftile-shortcuts` with its
Node.js, `busctl`, and `flock` runtime dependencies wrapped:

```bash
driftile-shortcuts claim
driftile-shortcuts check
driftile-shortcuts release
```

Release the profile before upgrading or removing the Nix package so the
recovery command remains available. Before a removal rebuild, also disable
Driftile in **KWin Scripts** and select **Apply**. Then remove the relevant
module declaration or set `programs.driftile.enable = false` and rebuild. Nix
removal retains the same `kwinrc`, layout snapshot, and manually assigned
shortcut state described above. Remove `programs.driftile.settings` before
cleaning its KConfig values so a later Home Manager activation cannot restore
them.

Source builds use `nix build`; the development shell is available through
`nix develop`.

## Compatibility and migration

See [Compatibility](compatibility.md) for current platform, geometry, toolkit,
and hardware limits. Read [Migration](migration.md) before changing release or
installation generations. Published artifacts and version-specific notes are
available on [GitHub Releases](https://github.com/kontonkara/driftile/releases).
