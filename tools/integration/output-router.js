var leftOutput;
var rightOutput;

function refreshOutputs() {
  leftOutput = null;
  rightOutput = null;

  for (var index = 0; index < workspace.screens.length; index += 1) {
    var output = workspace.screens[index];

    if (leftOutput === null || output.geometry.x < leftOutput.geometry.x) {
      leftOutput = output;
    }

    if (rightOutput === null || output.geometry.x > rightOutput.geometry.x) {
      rightOutput = output;
    }
  }

  if (leftOutput === rightOutput) {
    rightOutput = null;
  }
}

function routeWindow(window) {
  var title = window.caption;

  if (title.indexOf("driftile-multi-output-") !== 0) {
    return;
  }

  if (title.indexOf("-left-") !== -1 && leftOutput !== null) {
    workspace.sendClientToScreen(window, leftOutput);
  } else if (title.indexOf("-right-") !== -1 && rightOutput !== null) {
    workspace.sendClientToScreen(window, rightOutput);
  }
}

function routeWindows() {
  for (
    var windowIndex = 0;
    windowIndex < workspace.stackingOrder.length;
    windowIndex += 1
  ) {
    routeWindow(workspace.stackingOrder[windowIndex]);
  }
}

refreshOutputs();

if (leftOutput === null || rightOutput === null) {
  throw new Error("the integration output router requires two outputs");
}

workspace.windowAdded.connect(routeWindow);
workspace.screensChanged.connect(function () {
  refreshOutputs();
  routeWindows();
});
routeWindows();
