var activeSuffix = " [active]";
var activeWindow = workspace.activeWindow;

if (activeWindow === null) {
  throw new Error("the active-window probe requires an active window");
}

var caption = activeWindow.caption;

if (caption.slice(-activeSuffix.length) === activeSuffix) {
  caption = caption.slice(0, -activeSuffix.length);
}

registerShortcut(
  "_k_session:Driftile VM Active Window " + caption,
  "Driftile VM active window probe",
  "",
  function () {},
);
