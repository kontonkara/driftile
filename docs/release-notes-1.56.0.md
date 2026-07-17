# Driftile 1.56.0

Driftile 1.56.0 adds static, bounded window labels to the optional Overview.

## Highlights

- Show a normalized caption footer on ordinary large window thumbnails.
- Show a distinct captured application identity as a second line, or use it as
  the primary fallback when the caption is empty.
- Reuse the same normalized caption and application fallback for tabs and
  minimized placeholders.
- Bound hostile or overlong text, remove control characters, and collapse
  repeated whitespace before labels reach QML.
- Hide the complete footer on small thumbnails instead of obscuring content or
  input.

## Compatibility

KDE Plasma and KWin 6.7 or newer are required. Labels are static and read-only.
The release adds no pointer or keyboard input, timer, animation, setting,
action, binding, layout or persistence write, or private API. The main layout
script, transition effect, and logical persistence v4 are unchanged.
