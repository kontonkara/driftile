var targetPrefix = "driftile-state-target-";
var target = null;

for (var index = 0; index < workspace.stackingOrder.length; index += 1) {
  var candidate = workspace.stackingOrder[index];

  if (candidate.caption.indexOf(targetPrefix) !== 0) {
    continue;
  }

  if (target !== null) {
    throw new Error("multiple native tile targets found");
  }

  target = candidate;
}

if (target === null) {
  throw new Error("native tile target not found");
}

if (target.tile !== null) {
  var requestedTile = target.tile;

  if (typeof requestedTile.unmanage === "function") {
    if (!requestedTile.unmanage(target)) {
      throw new Error("native tile could not release the target");
    }
  } else {
    target.tile = null;
  }

  if (target.tile !== null) {
    throw new Error("native tile target remained attached");
  }
} else {
  var root = workspace.rootTile(target.output, target.desktops[0]);

  if (root === null) {
    throw new Error("native tile root not found");
  }

  var outputGeometry = target.output.geometry;
  var tile = root.pick(outputGeometry.x + 1, outputGeometry.y + 1);

  if (tile === null) {
    throw new Error("native tile leaf not found");
  }

  if (typeof tile.manage === "function") {
    if (!tile.manage(target)) {
      throw new Error("native tile could not manage the target");
    }
  } else {
    target.tile = tile;
  }

  if (target.tile !== tile) {
    throw new Error("native tile target was not attached");
  }
}

var expectedKeepAbove = target.tile !== null;
target.keepAbove = expectedKeepAbove;

if (target.keepAbove !== expectedKeepAbove) {
  throw new Error("native tile completion marker was not applied");
}
