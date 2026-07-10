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
var desktops = workspace.desktops;
var activeWindow = workspace.activeWindow;

if (outputs.length !== 2) {
  throw new Error("the desktop-state probe requires two outputs");
}

if (desktops.length < 2) {
  throw new Error(
    "the desktop-state probe requires at least two virtual desktops",
  );
}

if (
  activeWindow === null ||
  activeWindow === undefined ||
  activeWindow.desktops.length !== 1
) {
  throw new Error("the desktop-state probe requires one active window desktop");
}

var supportsPerOutputDesktops =
  typeof workspace.currentDesktopForScreen === "function" &&
  typeof workspace.setCurrentDesktopForScreen === "function";
var leftDesktop = supportsPerOutputDesktops
  ? workspace.currentDesktopForScreen(outputs[0])
  : workspace.currentDesktop;
var rightDesktop = supportsPerOutputDesktops
  ? workspace.currentDesktopForScreen(outputs[1])
  : workspace.currentDesktop;
var expectedLeftDesktop = activeWindow.desktops[0];
var expectedRightDesktop = supportsPerOutputDesktops
  ? desktops[0]
  : expectedLeftDesktop;

if (activeWindow.output.name !== outputs[0].name) {
  throw new Error("the transferred window left its source output");
}

if (leftDesktop.id !== expectedLeftDesktop.id) {
  throw new Error("the left output did not follow the transferred window");
}

if (rightDesktop.id !== expectedRightDesktop.id) {
  throw new Error(
    "the unrelated output changed its current desktop unexpectedly" +
      " expected=" +
      expectedRightDesktop.id +
      " actual=" +
      rightDesktop.id +
      " active=" +
      activeWindow.desktops[0].id,
  );
}

var desktopLabel;

if (expectedLeftDesktop.id === desktops[0].id) {
  desktopLabel = "primary";
} else if (expectedLeftDesktop.id === desktops[1].id) {
  desktopLabel = "secondary";
} else {
  throw new Error("the active window is on an unexpected desktop");
}
var activeSuffix = " [active]";
var windowCaption = activeWindow.caption;

if (windowCaption.slice(-activeSuffix.length) === activeSuffix) {
  windowCaption = windowCaption.slice(0, -activeSuffix.length);
}
var verifiedShortcut =
  "Driftile Integration Desktop State Verified " +
  windowCaption +
  " " +
  desktopLabel;

registerShortcut(
  verifiedShortcut,
  "Driftile integration desktop state verified",
  "",
  function () {},
);
