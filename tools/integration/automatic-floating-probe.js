var armShortcut = "Driftile Integration Automatic Floating Arm";
var captureShortcut = "Driftile Integration Automatic Floating Capture";
var resetShortcut = "Driftile Integration Automatic Floating Reset";
var verifyShortcut = "Driftile Integration Automatic Floating Verify";
var armedShortcutPrefix = "Driftile Integration Automatic Floating Armed ";
var capturedShortcutPrefix =
  "Driftile Integration Automatic Floating Captured ";
var verifiedShortcutPrefix =
  "Driftile Integration Automatic Floating Verified ";
var closedShortcutPrefix = "Driftile Integration Automatic Floating Closed ";
var resetShortcutPrefix =
  "Driftile Integration Automatic Floating Reset Complete ";
var activeSuffix = " [active]";
var dialogCaptionPrefix = "driftile-dialog-";
var parentCaptionPrefix = "driftile-dialog-parent-";
var pendingSnapshot = null;
var parentBaseline = null;
var snapshot = null;
var verificationIndex = 0;

function baseCaption(window) {
  var caption = window.caption;

  if (caption.slice(-activeSuffix.length) === activeSuffix) {
    return caption.slice(0, -activeSuffix.length);
  }

  return caption;
}

function windowId(window) {
  return String(window.internalId);
}

function copyFrame(window) {
  var frame = window.frameGeometry;

  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
}

function framesEqual(left, right) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function desktopIds(window) {
  var ids = [];

  for (var index = 0; index < window.desktops.length; index += 1) {
    ids.push(String(window.desktops[index].id));
  }

  return ids;
}

function desktopIdsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (var index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function captureWindow(window) {
  if (
    window.output === null ||
    window.output === undefined ||
    window.desktops.length !== 1
  ) {
    throw new Error(
      "the automatic-floating probe requires one output and one desktop per window",
    );
  }

  return {
    id: windowId(window),
    caption: baseCaption(window),
    frame: copyFrame(window),
    noBorder: window.noBorder,
    output: window.output.name,
    desktops: desktopIds(window),
  };
}

function captureDialogWindow(dialogWindow) {
  var caption = baseCaption(dialogWindow);

  if (
    caption.indexOf(dialogCaptionPrefix) !== 0 ||
    caption.indexOf(parentCaptionPrefix) === 0
  ) {
    return null;
  }

  var nativeWaylandSuffix = "-wayland";
  var nativeWayland =
    caption.slice(-nativeWaylandSuffix.length) === nativeWaylandSuffix;

  if (nativeWayland) {
    if (!dialogWindow.modal || !dialogWindow.transient) {
      throw new Error("the Wayland dialog is not modal and transient");
    }
  } else if (
    !dialogWindow.dialog ||
    !dialogWindow.modal ||
    !dialogWindow.transient
  ) {
    throw new Error("the X11 candidate is not a modal transient dialog");
  }

  var parent = dialogWindow.transientFor;

  if (parent === null || parent === undefined) {
    throw new Error("the modal dialog has no transient parent");
  }

  var expectedParentCaption =
    parentCaptionPrefix + caption.slice(dialogCaptionPrefix.length);

  if (baseCaption(parent) !== expectedParentCaption) {
    throw new Error("the modal dialog has an unexpected transient parent");
  }

  return {
    dialog: captureWindow(dialogWindow),
    parent: captureWindow(parent),
  };
}

function captureDialog() {
  var activeWindow = workspace.activeWindow;

  if (activeWindow === null || activeWindow === undefined) {
    return null;
  }

  return captureDialogWindow(activeWindow);
}

function findDialog() {
  for (var index = 0; index < workspace.stackingOrder.length; index += 1) {
    var window = workspace.stackingOrder[index];

    var caption = baseCaption(window);

    if (
      caption.indexOf(dialogCaptionPrefix) === 0 &&
      caption.indexOf(parentCaptionPrefix) !== 0
    ) {
      return window;
    }
  }

  return null;
}

function snapshotsEqual(left, right) {
  return (
    windowSnapshotsEqual(left.dialog, right.dialog) &&
    windowSnapshotsEqual(left.parent, right.parent)
  );
}

function windowSnapshotsEqual(left, right) {
  return (
    left.id === right.id &&
    left.caption === right.caption &&
    framesEqual(left.frame, right.frame) &&
    left.noBorder === right.noBorder &&
    left.output === right.output &&
    desktopIdsEqual(left.desktops, right.desktops)
  );
}

function armDialogParent() {
  if (parentBaseline !== null) {
    return;
  }

  if (findDialog() !== null) {
    throw new Error("the modal dialog opened before the parent was armed");
  }

  var parent = workspace.activeWindow;

  if (parent === null || parent === undefined) {
    throw new Error("the automatic-floating probe has no active dialog parent");
  }

  var parentCaption = baseCaption(parent);

  if (parentCaption.indexOf(parentCaptionPrefix) !== 0) {
    throw new Error("the automatic-floating probe found an unexpected parent");
  }

  var dialogCaption =
    dialogCaptionPrefix + parentCaption.slice(parentCaptionPrefix.length);
  parentBaseline = captureWindow(parent);
  registerShortcut(
    armedShortcutPrefix + dialogCaption,
    "Driftile integration automatic floating armed",
    "",
    function () {},
  );
}

function captureActiveDialog() {
  if (snapshot !== null) {
    return;
  }

  var dialogWindow = findDialog();

  if (dialogWindow === null) {
    pendingSnapshot = null;
    return;
  }

  var candidate = captureDialogWindow(dialogWindow);

  if (candidate === null) {
    pendingSnapshot = null;
    return;
  }

  if (!candidate.dialog.noBorder || !candidate.parent.noBorder) {
    pendingSnapshot = null;
    return;
  }

  if (
    parentBaseline === null ||
    !windowSnapshotsEqual(parentBaseline, candidate.parent)
  ) {
    throw new Error("the modal dialog changed its armed parent state");
  }

  if (
    workspace.activeWindow === null ||
    workspace.activeWindow === undefined ||
    windowId(workspace.activeWindow) !== candidate.dialog.id
  ) {
    workspace.activeWindow = dialogWindow;
    pendingSnapshot = null;
    return;
  }

  if (pendingSnapshot === null || !snapshotsEqual(pendingSnapshot, candidate)) {
    pendingSnapshot = candidate;
    return;
  }

  snapshot = candidate;
  registerShortcut(
    capturedShortcutPrefix + snapshot.dialog.caption,
    "Driftile integration automatic floating captured",
    "",
    function () {},
  );
}

function verifyActiveDialog() {
  if (snapshot === null) {
    throw new Error("the automatic-floating probe has no dialog snapshot");
  }

  var current = captureDialog();

  if (current === null) {
    throw new Error("the captured modal dialog is no longer active");
  }

  if (!snapshotsEqual(snapshot, current)) {
    throw new Error(
      "the captured dialog identity, frame, output, desktop, or parent changed",
    );
  }

  verificationIndex += 1;
  registerShortcut(
    verifiedShortcutPrefix + snapshot.dialog.caption + " " + verificationIndex,
    "Driftile integration automatic floating verified",
    "",
    function () {},
  );
}

function resetProbe() {
  if (snapshot === null) {
    throw new Error("the automatic-floating probe has no snapshot to reset");
  }

  var dialogCaption = snapshot.dialog.caption;
  parentBaseline = null;
  pendingSnapshot = null;
  snapshot = null;
  verificationIndex = 0;
  registerShortcut(
    resetShortcutPrefix + dialogCaption,
    "Driftile integration automatic floating reset",
    "",
    function () {},
  );
}

workspace.windowRemoved.connect(function (window) {
  if (snapshot === null || windowId(window) !== snapshot.dialog.id) {
    return;
  }

  registerShortcut(
    closedShortcutPrefix + snapshot.dialog.caption,
    "Driftile integration automatic floating closed",
    "",
    function () {},
  );
});

registerShortcut(
  armShortcut,
  "Driftile integration automatic floating arm",
  "",
  armDialogParent,
);
registerShortcut(
  captureShortcut,
  "Driftile integration automatic floating capture",
  "",
  captureActiveDialog,
);
registerShortcut(
  resetShortcut,
  "Driftile integration automatic floating reset",
  "",
  resetProbe,
);
registerShortcut(
  verifyShortcut,
  "Driftile integration automatic floating verify",
  "",
  verifyActiveDialog,
);
