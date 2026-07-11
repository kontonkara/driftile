var outputs = [];

for (
  var outputIndex = 0;
  outputIndex < workspace.screens.length;
  outputIndex += 1
) {
  outputs.push(workspace.screens[outputIndex]);
}

outputs.sort(function (left, right) {
  return left.geometry.x - right.geometry.x;
});

if (
  outputs.length !== 2 ||
  typeof workspace.currentDesktopForScreen !== "function"
) {
  throw new Error("the desktop reorder state probe requires two outputs");
}

var activeWindow = workspace.activeWindow;
var rightDestination = null;

for (
  var windowIndex = 0;
  windowIndex < workspace.stackingOrder.length;
  windowIndex += 1
) {
  var candidate = workspace.stackingOrder[windowIndex];

  if (candidate.caption.indexOf("right-desktop-destination") !== -1) {
    if (rightDestination !== null) {
      throw new Error(
        "the desktop reorder state probe found duplicate targets",
      );
    }

    rightDestination = candidate;
  }
}

if (
  activeWindow === null ||
  activeWindow === undefined ||
  rightDestination === null ||
  activeWindow.output.name !== outputs[0].name ||
  rightDestination.output.name !== outputs[1].name ||
  activeWindow.desktops.length !== 1 ||
  rightDestination.desktops.length !== 1
) {
  throw new Error("the desktop reorder state probe has invalid window state");
}

var leftDesktop = activeWindow.desktops[0];
var rightDesktop = rightDestination.desktops[0];
var selectedLeft = workspace.currentDesktopForScreen(outputs[0]);
var selectedRight = workspace.currentDesktopForScreen(outputs[1]);

if (
  selectedLeft === null ||
  selectedLeft === undefined ||
  selectedRight === null ||
  selectedRight === undefined ||
  selectedLeft.id !== leftDesktop.id ||
  selectedRight.id !== rightDesktop.id
) {
  throw new Error("desktop reordering changed an output selection");
}

var desktops = workspace.desktops;
var order;

if (
  desktops.length >= 3 &&
  desktops[0].id === rightDesktop.id &&
  desktops[1].id === leftDesktop.id
) {
  order = "down";
} else if (
  desktops.length >= 3 &&
  desktops[0].id === leftDesktop.id &&
  desktops[1].id === rightDesktop.id
) {
  order = "up";
} else {
  throw new Error("the desktop reorder state probe found an invalid order");
}

var activeSuffix = " [active]";
var windowCaption = activeWindow.caption;

if (windowCaption.slice(-activeSuffix.length) === activeSuffix) {
  windowCaption = windowCaption.slice(0, -activeSuffix.length);
}

registerShortcut(
  "Driftile Integration Desktop Reorder State Verified " +
    windowCaption +
    " " +
    order,
  "Driftile integration desktop reorder state verified",
  "",
  function () {},
);
