import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const actionStrip = readFileSync(
  new URL("contents/runtime/ui/WorkspaceActionStrip.qml", effectRoot),
  "utf8",
);
const gapButton = readFileSync(
  new URL("contents/runtime/ui/WorkspaceGapCreateButton.qml", effectRoot),
  "utf8",
);

const keyboard = scene.slice(
  scene.indexOf("Keys.onPressed:"),
  scene.indexOf("Component.onCompleted:"),
);
const management = scene.slice(
  scene.indexOf("function workspaceDesktopName("),
  scene.indexOf("function planWorkspaceGapDrop("),
);
const rowControls = scene.slice(
  scene.indexOf("WorkspaceActionStrip {"),
  scene.indexOf("Repeater {\n            id: workspaceGapDropRepeater"),
);
const gapControls = scene.slice(
  scene.indexOf("id: workspaceGapDropRepeater"),
  scene.indexOf("id: spatialWindowDragVisual"),
);

describe("Overview workspace management scene", () => {
  it("keeps rename ownership and stale-context cancellation on the scene root", () => {
    const topologyHandler = scene.slice(
      scene.indexOf("onDesktopTopologyRevisionChanged:"),
      scene.indexOf("onSpatialZoomInputEligibleChanged:"),
    );

    for (const state of [
      "workspaceRenameEditing",
      "workspaceRenameActivityId",
      "workspaceRenameDesktop",
      "workspaceRenameDesktopId",
      "workspaceRenameDesktopIds",
      "workspaceRenameExpectedName",
      "workspaceRenameGeneration",
      "workspaceRenameModel",
      "workspaceRenameOutputId",
      "workspaceRenameSessionId",
      "workspaceRenameTopologyRevision",
    ]) {
      expect(scene).toContain(
        `property ${state === "workspaceRenameEditing" ? "bool" : state === "workspaceRenameDesktop" || state === "workspaceRenameDesktopIds" || state === "workspaceRenameModel" ? "var" : state === "workspaceRenameGeneration" || state === "workspaceRenameSessionId" || state === "workspaceRenameTopologyRevision" ? "int" : "string"} ${state}`,
      );
    }
    expect(management).toMatch(
      /function workspaceRenameEditorIsExact[\s\S]*sceneEffect === workspaceRenameEffect[\s\S]*activeOverviewSessionId === workspaceRenameSessionId[\s\S]*overviewContextGeneration === workspaceRenameGeneration[\s\S]*overviewModel === workspaceRenameModel[\s\S]*activeOverviewActivityId === workspaceRenameActivityId[\s\S]*outputId === workspaceRenameOutputId[\s\S]*desktopTopologyRevision === workspaceRenameTopologyRevision[\s\S]*sameStringList\(desktopIds, workspaceRenameDesktopIds\)[\s\S]*workspaceDesktopName[\s\S]*workspaceRenameExpectedName/u,
    );
    expect(scene).toContain("onOverviewModelChanged: {");
    expect(topologyHandler).toMatch(
      /root\.abortPendingWindowFocus\("topology"\)[\s\S]*root\.cancelWorkspaceRenameOnDrift\(\);[\s\S]*root\.cancelActiveWindowSpatialDrag\(\);/u,
    );
    expect(scene).toContain("target: root.workspaceRenameDesktop");
    expect(scene).toMatch(
      /function onNameChanged\(\) \{\s*root\.cancelWorkspaceRenameOnDrift\(\);/u,
    );
  });

  it("adds one guarded plus control without replacing either gap drop area", () => {
    expect(gapControls).toContain('keys: ["driftile-window"]');
    expect(gapControls).toContain('keys: ["driftile-column"]');
    expect(gapControls).toContain("WorkspaceGapCreateButton {");
    expect(gapControls).toMatch(
      /root\.workspaceCreatePlanForGap\(\s*workspaceGapDropSlot\.index\)/u,
    );
    expect(management).toContain("planWorkspaceGapDropAtCanvasY(pointY)");
    expect(management).toContain("workspaceGapPlanIsExact(gapPlan, position)");
    expect(management).toMatch(
      /adjacentDesktopId: desktopIds\[position - 1\],[\s\S]*anchorDesktopId: desktopIds\[position\],[\s\S]*insertionIndex: position/u,
    );
    expect(management).toMatch(
      /kind: "create",\s*position: exactPlan\.insertionIndex/u,
    );
    expect(gapButton).toContain("PointerDevice.TouchScreen");
    expect(gapButton).toContain('Accessible.name: "Create workspace here"');
  });

  it("shows compact pointer and touch row actions with a root-backed editor", () => {
    expect(rowControls).toContain("WorkspaceActionStrip {");
    expect(rowControls).toContain(
      "editing: desktopCardLoader.active && root.workspaceRenameEditing",
    );
    expect(rowControls).toContain(
      "renameDraft: editing ? root.workspaceRenameDraft",
    );
    expect(rowControls).toContain("root.beginWorkspaceRename(");
    expect(rowControls).toContain("root.removeWorkspace(");
    expect(actionStrip).toContain('label: "Rename"');
    expect(actionStrip).toContain('label: "Remove"');
    expect(actionStrip).toContain("PointerDevice.TouchScreen");
    expect(actionStrip).toContain("Accessible.EditableText");
    expect(actionStrip).toContain("maximumLength: 256");
    expect(actionStrip).toMatch(
      /Qt\.Key_Enter[\s\S]*submitRenameRequested\(\)[\s\S]*Qt\.Key_Escape[\s\S]*cancelRenameRequested\(\)/u,
    );
    expect(management).toMatch(
      /function workspaceRowActionsEligible[\s\S]*expectedIndex < desktopIds\.length - 1[\s\S]*!emptyDesktopAboveFirst \|\| expectedIndex > 0/u,
    );
  });

  it("submits bounded rename commands only through the exact public command surface", () => {
    expect(management).toContain(
      "function boundedPlainWorkspaceUnicode(value, emptyAllowed)",
    );
    expect(management).toMatch(
      /value\.length > 256[\s\S]*codePoint <= 0x1f[\s\S]*codePoint === 0x2028[\s\S]*bytes > 255/u,
    );
    expect(management).toMatch(
      /function submitWorkspaceRename[\s\S]*workspaceRenameEditorIsExact\(\)[\s\S]*boundedWorkspaceName\(workspaceRenameDraft\)[\s\S]*expectedName: workspaceRenameExpectedName,[\s\S]*kind: "rename",[\s\S]*name: workspaceRenameDraft[\s\S]*submitWorkspaceCommand\(context, action\)/u,
    );
    expect(management).not.toMatch(
      /KWin\.Workspace\.(?:createDesktop|removeDesktop|moveDesktop)|\.name\s*=(?!=)|\.setValue\s*\(/u,
    );
  });

  it("enables remove only for exact empty unselected interior workspaces", () => {
    expect(rowControls).toContain("property bool exactRemoveEligible: false");
    expect(rowControls).toContain("removeEligible: exactRemoveEligible");
    expect(rowControls).toMatch(
      /exactRemoveEligibilityContext:[\s\S]*overviewContextGeneration[\s\S]*desktopTopologyRevision[\s\S]*currentWorkspaceIndex[\s\S]*overviewDesktopCardEpoch/u,
    );
    expect(rowControls).toMatch(
      /function refreshRemoveEligibility\(\)[\s\S]*exactRemoveEligible = interactionEligible[\s\S]*workspaceRemoveEligible\(/u,
    );
    expect(rowControls).not.toMatch(
      /removeEligible:\s*root\.workspaceRemoveEligible/u,
    );
    expect(management).toMatch(
      /function workspaceRemoveEligible[\s\S]*desktopIds\.length < 3[\s\S]*expectedIndex <= 0[\s\S]*expectedIndex >= desktopIds\.length - 1[\s\S]*workspaceDesktopSelectedAnywhere[\s\S]*workspaceDesktopIsGloballyEmpty/u,
    );
    expect(management).toContain(
      "const windows = KWin.Workspace.stackingOrder;",
    );
    expect(management).toMatch(
      /window\.deleted === true \|\| window\.desktopWindow === true \|\| window\.dock === true[\s\S]*window\.onAllDesktops === true/u,
    );
    expect(management).toMatch(
      /windowDesktops\.length < 1[\s\S]*desktopIds\.indexOf\(windowDesktopId\) < 0[\s\S]*windowDesktopId === expectedDesktopId[\s\S]*return false/u,
    );
    expect(management).toContain(
      "KWin.Workspace.currentDesktopForScreen(screen)",
    );
    expect(management).toMatch(
      /kind: "remove"[\s\S]*sceneEffect\.submitWorkspaceCommand\(context, action\)/u,
    );
  });

  it("routes Insert, F2, and Delete by the selected marker kind", () => {
    expect(keyboard).toContain("event.key === Qt.Key_Insert");
    expect(keyboard).toContain("root.createWorkspaceAfterKeyboardSelection()");
    expect(keyboard).toContain("event.key === Qt.Key_F2");
    expect(keyboard).toContain("root.renameKeyboardDesktopSelection()");
    expect(keyboard).toContain("event.key === Qt.Key_Delete");
    expect(keyboard).toContain("root.deleteKeyboardSelection()");
    expect(management).toMatch(
      /function createWorkspaceAfterKeyboardSelection[\s\S]*target\.kind !== "desktop"[\s\S]*workspaceCreatePlanForGap\(selectedIndex\)/u,
    );
    expect(management).toMatch(
      /function deleteKeyboardSelection[\s\S]*target\.kind === "window"[\s\S]*closeWindow\([\s\S]*target\.kind !== "desktop"[\s\S]*removeWorkspace/u,
    );
  });

  it("isolates rename editing from scene input while Escape remains cancel", () => {
    expect(scene).toMatch(
      /readonly property bool spatialPointerInputEligible:[\s\S]*!workspaceRenameEditing/u,
    );
    expect(scene).toMatch(
      /readonly property bool spatialZoomCompetingInputEligible:[\s\S]*!workspaceRenameEditing/u,
    );
    expect(scene).toContain(
      "!root.spatialHorizontalRowDragActive && !root.workspaceRenameEditing",
    );
    expect(keyboard).toMatch(
      /if \(workspaceRenameEditing\) \{[\s\S]*Qt\.Key_Escape[\s\S]*cancelWorkspaceRename\(\);[\s\S]*event\.accepted = true;[\s\S]*return;/u,
    );
    expect(management).toMatch(
      /function beginWorkspaceRename[\s\S]*cancelActiveColumnSpatialDrag\(\);[\s\S]*cancelSpatialZoomTransaction\(\);[\s\S]*cancelKeyboardBoundaryNavigation\(\);[\s\S]*resetOverviewWheelState\(\);[\s\S]*resetDesktopReorder\(\);[\s\S]*clearSpatialTouchPan\(\);/u,
    );
    expect(scene).toMatch(
      /function workspaceManagementControlContainsPoint[\s\S]*spatialVisibleRangeIsValid\(overviewSpatialVisibleRangePlan\)[\s\S]*desktopRepeater\.itemAt\(index\)[\s\S]*loader\.active === true[\s\S]*workspaceGapDropRepeater\.itemAt\(index\)[\s\S]*slot\.enabled === true/u,
    );
    for (const containsFunction of [
      "spatialTouchPanContains",
      "spatialViewportBackdropContains",
      "spatialHorizontalViewportBackdropContains",
    ]) {
      expect(scene).toMatch(
        new RegExp(
          `function ${containsFunction}\\(point\\) \\{[\\s\\S]*?workspaceManagementControlContainsPoint\\(point\\)`,
          "u",
        ),
      );
    }
    expect(management).toMatch(
      /function workspaceCommandSceneIsExact[\s\S]*spatialViewportDragHandler\.active[\s\S]*spatialHorizontalViewportDragHandler\.active[\s\S]*spatialTouchPanDragHandler\.active/u,
    );
  });

  it("keeps accepted commands in Overview for the existing in-place refresh", () => {
    expect(
      management.match(/submitWorkspaceCommand\(context, action\)/gu),
    ).toHaveLength(3);
    expect(management).not.toMatch(
      /deactivate(?:Immediately)?\(|requestLiveModelRefresh|\bTimer\s*\{|setInterval|setTimeout|org\.kde\.kwin\.private/u,
    );
    expect(scene).toMatch(
      /function beginOverviewContextRefreshBarrier\(\) \{\s*cancelSpatialHorizontalCameraMotion\(\);\s*cancelWorkspaceRename\(\);/u,
    );
    expect(scene).toMatch(
      /function resetOverviewSession\(\) \{\s*cancelSpatialHorizontalCameraMotion\(\);\s*cancelWorkspaceRename\(\);/u,
    );
  });
});
