# Installation

Driftile requires KDE Plasma with KWin 6.7 or newer and `kpackagetool6`.
Version 0.1 targets Wayland, XWayland, and a single-output native X11 session.
Run all commands as the desktop user, not with `sudo`.

## Install a release

Download these files from the same release:

- `driftile-0.1.0.kwinscript`
- `SHA256SUMS`
- `LICENSE`
- `driftile-shortcuts-0.1.0.mjs` if using the optional shortcut helper

Verify every downloaded release asset before installing it:

```bash
sha256sum --check --ignore-missing SHA256SUMS
```

Install the KWin package:

```bash
kpackagetool6 --type=KWin/Script \
  --install ./driftile-0.1.0.kwinscript
```

Open **System Settings > Window Management > KWin Scripts**, enable
**Driftile**, and select **Apply**. The configure button on the same page opens
the gap, width, height, and decoration settings described in
[Configuration](configuration.md).

## Configure shortcuts

Driftile works without the companion helper. Use either path below for the
default profile. Actions without default keys can still be assigned manually.

### Reversible helper

The versioned helper needs Node.js 22 or newer, `busctl`, and `flock`. Enable
Driftile before running it, and keep the helper until its saved claim has been
released.

```bash
node ./driftile-shortcuts-0.1.0.mjs claim
node ./driftile-shortcuts-0.1.0.mjs check
```

`claim` transactionally saves and replaces active conflicting assignments.
`release` restores unchanged assignments while preserving shortcuts edited
after the claim:

```bash
node ./driftile-shortcuts-0.1.0.mjs release
```

Do not use `--force` unless replacing later manual edits is intentional. See
[Shortcuts](shortcuts.md) for the complete profile and recovery details.

### Manual assignment

Open **System Settings > Keyboard > Shortcuts**, search for **Driftile**, and
assign the actions you want. Resolve each reported conflict in System Settings.
This path needs no helper and allows a partial shortcut profile, but it cannot
restore displaced assignments automatically.

## Upgrade

1. If the helper owns the profile, release it with the helper from the
   installed version.
2. Disable Driftile in **KWin Scripts** and select **Apply**.
3. Download and verify the new package, checksum manifest, and optional helper.
4. Upgrade the package:

   ```bash
   kpackagetool6 --type=KWin/Script \
     --upgrade ./driftile-<new-version>.kwinscript
   ```

5. Enable Driftile, review its configuration, then claim or assign shortcuts
   for the new version.

## Disable or uninstall

Before disabling Driftile, release a helper-managed shortcut profile. For a
manual profile, restore any assignments you want to keep through System
Settings. Then disable Driftile in **KWin Scripts** and select **Apply**.

After releasing shortcuts and disabling the extension, uninstall it with:

```bash
kpackagetool6 --type=KWin/Script \
  --remove io.github.kontonkara.driftile
```

If `release` reports assignments changed after the claim, it has preserved
those edits. Resolve them before deleting the helper; forcing a release may
overwrite them.

If the saved claim file is lost or corrupt, the helper fails closed because it
cannot reconstruct displaced assignments. Restore shortcuts manually in
System Settings before removing `$XDG_STATE_HOME/driftile/shortcut-claim.json`.
When `XDG_STATE_HOME` is unset, the file is under
`$HOME/.local/state/driftile/shortcut-claim.json`.

## Nix

The flake exposes a package for `x86_64-linux` and `aarch64-linux`. Add it to a
NixOS or Home Manager package list instead of also installing the
`.kwinscript`; two copies with the same KWin package ID can make package
selection ambiguous. Enable and configure Driftile in System Settings after
activating the generation.

The Nix package provides the shortcut helper as `driftile-shortcuts` with its
Node.js, `busctl`, and `flock` runtime dependencies wrapped:

```bash
driftile-shortcuts claim
driftile-shortcuts check
driftile-shortcuts release
```

Release the profile before upgrading or removing the Nix package so the
recovery command remains available. Source builds use `nix build`; the
development shell is available through `nix develop`.

## Known 0.1 limits

- Physical connector hot-plug has not been verified; automated coverage uses
  virtual output removal and reattachment.
- Native X11 is verified on one output, but native X11 multi-output remains
  unverified.
- Persistence is disabled. Logical order, sizes, viewport state, and floating
  state are not restored across sessions or extension reloads.

The release page also provides the exact tagged source for both executable
artifacts. `LICENSE` contains their GPL-3.0-or-later terms.
