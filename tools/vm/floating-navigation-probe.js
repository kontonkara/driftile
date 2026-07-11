var activeSuffix = " [active]";
var captionPrefix = "Driftile VM Floating Navigation ";
var arrangedWindows = 0;
var targets = {
  left: { x: 120, y: 380 },
  center: { x: 650, y: 120 },
  right: { x: 1100, y: 650 },
};

function baseCaption(window) {
  var caption = window.caption;

  if (caption.slice(-activeSuffix.length) === activeSuffix) {
    return caption.slice(0, -activeSuffix.length);
  }

  return caption;
}

for (var index = 0; index < workspace.stackingOrder.length; index += 1) {
  var window = workspace.stackingOrder[index];
  var caption = baseCaption(window);

  if (caption.indexOf(captionPrefix) !== 0) {
    continue;
  }

  var target = targets[caption.slice(captionPrefix.length)];

  if (target === undefined) {
    continue;
  }

  window.frameGeometry = {
    x: target.x,
    y: target.y,
    width: 360,
    height: 240,
  };
  arrangedWindows += 1;
}

if (arrangedWindows !== 3) {
  throw new Error("the floating-navigation probe requires three windows");
}
