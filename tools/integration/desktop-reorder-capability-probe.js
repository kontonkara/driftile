var capability =
  typeof workspace.moveDesktop === "function" ? "Supported" : "Unavailable";

registerShortcut(
  "Driftile Integration Desktop Reorder " + capability,
  "Driftile integration desktop reorder capability",
  "",
  function () {},
);
