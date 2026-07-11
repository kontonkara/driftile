var titlePrefix = "driftile-floating-navigation-";
var activeSuffix = " [active]";
var arrangedWindows = 0;

function baseCaption(window) {
  var caption = window.caption;

  if (caption.slice(-activeSuffix.length) === activeSuffix) {
    return caption.slice(0, -activeSuffix.length);
  }

  return caption;
}

function navigationPosition(title) {
  var suffix = title.slice(-2);

  if (suffix === "-a") {
    return { x: 80, y: 80 };
  }

  if (suffix === "-b") {
    return { x: 460, y: 240 };
  }

  if (suffix === "-c") {
    return { x: 840, y: 440 };
  }

  return null;
}

for (var index = 0; index < workspace.stackingOrder.length; index += 1) {
  var window = workspace.stackingOrder[index];
  var title = baseCaption(window);

  if (title.indexOf(titlePrefix) !== 0) {
    continue;
  }

  var position = navigationPosition(title);

  if (position === null) {
    continue;
  }

  window.frameGeometry = {
    x: position.x,
    y: position.y,
    width: 360,
    height: 240,
  };
  arrangedWindows += 1;
}

if (arrangedWindows !== 3) {
  throw new Error("the floating-navigation arranger requires three windows");
}
