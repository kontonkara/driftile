# Driftile 1.58.0

Driftile 1.58.0 adds guarded close buttons to eligible Overview window
previews.

## Highlights

- Show one compact close button on an eligible thumbnail, tab, or minimized
  placeholder when that surface is hovered or keyboard-selected.
- Close the exact live window without activating, focusing, restoring, or
  dragging it first.
- Hide the button on small surfaces and preserve attention cues and labels.
- Enable or disable the presentation live through KConfig or a nullable Home
  Manager preference.
- Preserve existing `Delete` and middle-click close behavior.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. The release adds no KWin action,
binding, layout or persistence write, timer, animation, private API, or KWin
fork. Logical persistence remains v4.
