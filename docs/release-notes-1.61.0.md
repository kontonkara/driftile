# Driftile 1.61.0

Driftile 1.61.0 adds lazy application icons to eligible window labels in the
optional Overview.

## Highlights

- Show the public KWin application icon on sufficiently large ordinary
  footers, tabs, and minimized placeholders.
- Avoid reading an icon or instantiating its Loader and Kirigami payload when
  icons are disabled or a surface is ineligible.
- Enable or disable icons live through default-enabled KConfig or a nullable
  Home Manager preference.
- Keep the NixOS option surface unchanged; system installations use the same
  per-user effect setting.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Icons use the read-only public
`Window.icon` API and Kirigami presentation. The release adds no input, search,
focus, window or layout write, persistence field, private API, or KWin fork.
Logical persistence remains v4.
