var leftOutput = null;
var rightOutput = null;

for (var index = 0; index < workspace.screens.length; index += 1) {
  var output = workspace.screens[index];

  if (leftOutput === null || output.geometry.x < leftOutput.geometry.x) {
    leftOutput = output;
  }

  if (rightOutput === null || output.geometry.x > rightOutput.geometry.x) {
    rightOutput = output;
  }
}

if (
  workspace.screens.length !== 2 ||
  leftOutput === null ||
  rightOutput === null ||
  leftOutput === rightOutput
) {
  throw new Error("the integration output router requires two outputs");
}

function routeWindow(window) {
  var title = window.caption;

  if (title.indexOf("driftile-multi-output-") !== 0) {
    return;
  }

  if (title.indexOf("-left-") !== -1) {
    workspace.sendClientToScreen(window, leftOutput);
  } else if (title.indexOf("-right-") !== -1) {
    workspace.sendClientToScreen(window, rightOutput);
  }
}

workspace.windowAdded.connect(routeWindow);

for (
  var windowIndex = 0;
  windowIndex < workspace.stackingOrder.length;
  windowIndex += 1
) {
  routeWindow(workspace.stackingOrder[windowIndex]);
}
