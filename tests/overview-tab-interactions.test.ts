import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const desktopCard = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/DesktopCard.qml",
    import.meta.url,
  ),
  "utf8",
);

const tab = desktopCard.slice(
  desktopCard.indexOf("id: tabShell"),
  desktopCard.indexOf("id: thumbnailShell"),
);
const placeholder = desktopCard.slice(
  desktopCard.indexOf("id: minimizedPlaceholderShell"),
  desktopCard.indexOf("id: windowDropArea"),
);
const thumbnail = desktopCard.slice(
  desktopCard.indexOf("id: thumbnailShell"),
  desktopCard.indexOf("id: minimizedPlaceholderShell"),
);

describe("overview tab and minimized interactions", () => {
  it("keeps real tab captions and exact close controls available independently", () => {
    const captionStart = tab.indexOf(
      "Text {",
      tab.indexOf("id: tabApplicationIcon"),
    );
    const caption = tab.slice(
      captionStart,
      tab.indexOf("Rectangle {", captionStart),
    );
    const closeExact = tab.slice(
      tab.indexOf("function closeIsExact()"),
      tab.indexOf("x: frame ? frame.x : 0"),
    );

    expect(caption).toMatch(
      /text: windowPresentation\.windowLabel !== null\s*\? windowPresentation\.windowLabel\.primary\s*: `Tab \$\{tabShell\.frame \? tabShell\.frame\.memberIndex \+ 1 : ""\}`/u,
    );
    expect(caption).not.toContain("showWindowLabels");
    expect(desktopCard.match(/WindowCloseButton \{/gu)).toHaveLength(3);
    expect(tab).toContain(
      "readonly property bool closeButtonLargeEnough: width >= 64 && height >= 20",
    );
    expect(tab).toMatch(
      /id: tabCloseButton[\s\S]*settingEnabled: card\.showWindowCloseButtons[\s\S]*closeEligible: windowPresentation\.closeEligible[\s\S]*surfaceLargeEnough: tabShell\.closeButtonLargeEnough/u,
    );
    expect(closeExact).toContain("tabShell.visible && tabShell.frameIsExact()");
    expect(closeExact).toContain("windowPresentation.closeEligible");
    expect(closeExact).toContain(
      "card.windowSnapshotCanRequestClose(windowPresentation)",
    );
    expect(closeExact).not.toContain("primaryVisualKind");
  });

  it("separates tab activation from guarded left and middle close regions", () => {
    const closeButton = tab.slice(
      tab.indexOf("id: tabCloseButton"),
      tab.indexOf("HoverHandler {", tab.indexOf("id: tabCloseButton")),
    );
    const activationId = tab.indexOf("id: tabActivationHandler");
    const activation = tab.slice(
      tab.lastIndexOf("TapHandler {", activationId),
      tab.indexOf("\n                    TapHandler {", activationId),
    );
    const middle = tab.slice(
      tab.indexOf("\n                    TapHandler {", activationId),
    );

    expect(closeButton).toMatch(
      /enabled: card\.interactionEligible && !card\.spatialDirectDragBlocked\s*&& card\.columnDragActiveSource === null\s*&& card\.columnPointerHoverSource === null\s*&& card\.columnPointerPressSource === null/u,
    );
    expect(closeButton).toMatch(
      /onCloseRequested: \{\s*if \(!tabShell\.closeIsExact\(\)\) \{\s*return;[\s\S]*card\.windowCloseRequested\(windowPresentation\.candidate,/u,
    );
    expect(activation).toMatch(
      /onTapped: point => \{\s*if \(card\.closeButtonContainsPoint\(tabCloseButton, tabShell,\s*point\.position\)\) \{\s*tabShell\.disarmMinimizedActivation\(\);\s*return;/u,
    );
    expect(tab).toMatch(
      /const releaseLocalPosition = Qt\.point\(releaseLocalX, releaseLocalY\);\s*return tabShell\.contains\(releaseLocalPosition\)\s*&& !card\.closeButtonContainsPoint\(tabCloseButton, tabShell,\s*releaseLocalPosition\);/u,
    );
    expect(middle).toMatch(
      /acceptedButtons: Qt\.MiddleButton[\s\S]*enabled: tabShell\.visible && windowPresentation\.closeEligible[\s\S]*if \(!tabShell\.closeIsExact\(\)\) \{\s*return;[\s\S]*card\.windowCloseRequested\(windowPresentation\.candidate,/u,
    );
  });

  it("owns primary tab taps exclusively while preserving gesture takeovers", () => {
    const activationId = tab.indexOf("id: tabActivationHandler");
    const activation = tab.slice(
      tab.lastIndexOf("TapHandler {", activationId),
      tab.indexOf("\n                    TapHandler {", activationId),
    );
    const recovery = tab.slice(
      tab.indexOf("function handleActivationGrabChanged("),
      tab.indexOf("function closeIsExact("),
    );
    const thumbnailPrimaryStart = thumbnail.indexOf("TapHandler {");
    const thumbnailPrimary = thumbnail.slice(
      thumbnailPrimaryStart,
      thumbnail.indexOf(
        "\n                    TapHandler {",
        thumbnailPrimaryStart,
      ),
    );

    expect(activationId).toBeGreaterThanOrEqual(0);
    expect(thumbnailPrimaryStart).toBeGreaterThanOrEqual(0);
    expect(tab).toContain("parent: tabRailLayer");
    expect(activation).toContain(
      "gesturePolicy: TapHandler.ReleaseWithinBounds",
    );
    expect(activation).not.toContain("TapHandler.DragThreshold");
    expect(activation).toMatch(
      /grabPermissions: PointerHandler\.ApprovesTakeOverByHandlersOfSameType\s*\| PointerHandler\.ApprovesTakeOverByHandlersOfDifferentType\s*\| PointerHandler\.ApprovesCancellation/u,
    );
    expect(recovery).toMatch(
      /transition === PointerDevice\.GrabPassive\s*\|\| transition === PointerDevice\.GrabExclusive/u,
    );
    expect(recovery).toMatch(
      /transition !== PointerDevice\.UngrabPassive\s*&& transition !== PointerDevice\.UngrabExclusive/u,
    );
    expect(tab).toContain(
      "const threshold = tabActivationHandler.dragThreshold;",
    );
    expect(thumbnailPrimary).toMatch(
      /acceptedButtons: Qt\.LeftButton[\s\S]*acceptedDevices: PointerDevice\.Mouse \| PointerDevice\.TouchPad[\s\S]*card\.windowTapped\(model\.window,/u,
    );
    expect(thumbnail.match(/DragHandler \{/gu)).toHaveLength(2);
    expect(`${activation}\n${recovery}`).not.toMatch(
      /PointerHandler\.TakeOverForbidden|org\.kde\.kwin\.private|\bMouseArea\s*\{/u,
    );
  });

  it("uses timer-free hover and pressed feedback for tabs and placeholders", () => {
    expect(tab).toMatch(
      /color: tabActivationHandler\.pressed \? "#f24b6482"\s*: tabHoverHandler\.hovered \? "#e641526b"/u,
    );
    expect(tab).toContain("id: tabHoverHandler");
    expect(tab).toContain("id: tabActivationHandler");
    expect(placeholder).toMatch(
      /color: minimizedPlaceholderActivationHandler\.pressed \? "#f23e4d65"\s*: minimizedPlaceholderHoverHandler\.hovered \? "#e6323e52"/u,
    );
    expect(placeholder).toContain("id: minimizedPlaceholderHoverHandler");
    expect(placeholder).toContain("id: minimizedPlaceholderActivationHandler");
    expect(`${tab}\n${placeholder}`).not.toMatch(
      /\b(?:Timer|Behavior|NumberAnimation|ColorAnimation|SequentialAnimation|ParallelAnimation)\s*\{/u,
    );
  });
});
