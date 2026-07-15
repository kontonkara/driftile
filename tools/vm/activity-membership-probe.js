var primaryWindowFragments = [
  " - Konsole A - Meta+H",
  " - Konsole B - middle column",
  " - Konsole C - Meta+L",
];
var secondaryWindowFragments = [
  "Driftile VM Firefox",
  "Driftile VM Activity XWayland Terminal",
];

function activityIds() {
  var ids = [];

  for (var index = 0; index < workspace.activities.length; index += 1) {
    ids.push(String(workspace.activities[index]));
  }

  return ids;
}

function matchingWindow(fragment) {
  var matches = [];

  for (var index = 0; index < workspace.stackingOrder.length; index += 1) {
    var window = workspace.stackingOrder[index];

    if (String(window.caption).indexOf(fragment) !== -1) {
      matches.push(window);
    }
  }

  if (matches.length !== 1) {
    throw new Error(
      "the activity membership probe requires one window matching " + fragment,
    );
  }

  return matches[0];
}

var activities = activityIds();
var primaryActivity = String(workspace.currentActivity);

if (activities.length !== 2 || activities.indexOf(primaryActivity) === -1) {
  throw new Error(
    "the activity membership probe requires two activities and a valid current activity",
  );
}

var secondaryActivity =
  activities[0] === primaryActivity ? activities[1] : activities[0];
var primaryWindows = primaryWindowFragments.map(matchingWindow);
var secondaryWindows = secondaryWindowFragments.map(matchingWindow);

for (
  var primaryIndex = 0;
  primaryIndex < primaryWindows.length;
  primaryIndex += 1
) {
  primaryWindows[primaryIndex].activities = [primaryActivity];
}

for (
  var secondaryIndex = 0;
  secondaryIndex < secondaryWindows.length;
  secondaryIndex += 1
) {
  secondaryWindows[secondaryIndex].activities = [secondaryActivity];
}
