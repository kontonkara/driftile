var outputs = [];

for (
  var outputIndex = 0;
  outputIndex < workspace.screens.length;
  outputIndex += 1
) {
  outputs.push(workspace.screens[outputIndex]);
}

outputs.sort(function (left, right) {
  return (
    left.geometry.x - right.geometry.x ||
    left.geometry.y - right.geometry.y ||
    left.name.localeCompare(right.name)
  );
});

var desktops = workspace.desktops;
var activeWindow = workspace.activeWindow;

if (outputs.length !== 2) {
  throw new Error("the output-transfer probe requires two outputs");
}

if (desktops.length !== 2) {
  throw new Error("the output-transfer probe requires two virtual desktops");
}

if (
  typeof workspace.currentDesktopForScreen !== "function" ||
  activeWindow === null ||
  activeWindow === undefined ||
  activeWindow.output === null ||
  activeWindow.output === undefined ||
  activeWindow.desktops.length !== 1
) {
  throw new Error("the output-transfer probe requires per-output desktops");
}

var leftOutput = outputs[0];
var rightOutput = outputs[1];
var leftDesktop = workspace.currentDesktopForScreen(leftOutput);
var rightDesktop = workspace.currentDesktopForScreen(rightOutput);

if (
  leftDesktop === null ||
  leftDesktop === undefined ||
  leftDesktop.id !== desktops[0].id
) {
  throw new Error("the output transfer changed the left current desktop");
}

if (
  rightDesktop === null ||
  rightDesktop === undefined ||
  rightDesktop.id !== desktops[1].id
) {
  throw new Error("the output transfer changed the right current desktop");
}

var stateLabel;
var expectedDesktop;

if (activeWindow.output.name === rightOutput.name) {
  stateLabel = "right-secondary";
  expectedDesktop = desktops[1];
} else if (activeWindow.output.name === leftOutput.name) {
  stateLabel = "left-primary";
  expectedDesktop = desktops[0];
} else {
  throw new Error("the active window is not on a tested output");
}

if (activeWindow.desktops[0].id !== expectedDesktop.id) {
  throw new Error("the active window is not on the visible target desktop");
}

var activeSuffix = " [active]";
var windowCaption = activeWindow.caption;

if (windowCaption.slice(-activeSuffix.length) === activeSuffix) {
  windowCaption = windowCaption.slice(0, -activeSuffix.length);
}

registerShortcut(
  "Driftile Integration Output Transfer State Verified " +
    windowCaption +
    " " +
    stateLabel,
  "Driftile integration output transfer state verified",
  "",
  function () {},
);
