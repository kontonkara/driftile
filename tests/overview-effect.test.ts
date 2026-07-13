import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const metadata = JSON.parse(
  readFileSync(new URL("metadata.json", effectRoot), "utf8"),
) as {
  readonly KPackageStructure?: string;
  readonly KPlugin?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};
const main = readFileSync(new URL("contents/ui/main.qml", effectRoot), "utf8");
const reader = readFileSync(
  new URL("contents/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);
const scene = readFileSync(
  new URL("contents/ui/OverviewScene.qml", effectRoot),
  "utf8",
);
const desktopCard = readFileSync(
  new URL("contents/ui/DesktopCard.qml", effectRoot),
  "utf8",
);
const qmlSources = [main, reader, scene, desktopCard];

describe("overview effect package", () => {
  it("declares a disabled standalone KWin effect without configuration", () => {
    expect(metadata.KPackageStructure).toBe("KWin/Effect");
    expect(metadata.KPlugin).toMatchObject({
      Category: "Window Management",
      EnabledByDefault: false,
      Id: "io.github.kontonkara.driftile.overview",
      Name: "Driftile Overview",
    });
    expect(metadata["X-Plasma-API"]).toBe("declarativescript");
    expect(metadata["X-Plasma-MainScript"]).toBe("ui/main.qml");
    expect(metadata).not.toHaveProperty("X-KDE-ConfigModule");
    expect(metadata).not.toHaveProperty("X-KWin-Border-Activate");
  });

  it("registers one unbound toggle action and no screen edge", () => {
    expect(main.match(/KWin\.ShortcutHandler\s*\{/gu)).toHaveLength(1);
    expect(main).toContain('name: "driftile_toggle_overview"');
    expect(main).not.toMatch(/\bsequence\s*:/u);
    expect(main).not.toMatch(/ScreenEdge|registerScreenEdge/u);
  });

  it("samples the persisted layout exactly twice without writing", () => {
    expect(reader).toContain('category: "Layout"');
    expect(reader).toContain('settings.value("layout-v1", "")');
    expect(reader.match(/settings\.value\("layout-v1", ""\)/gu)).toHaveLength(
      2,
    );
    expect(reader).toContain("readonly property int sampleInterval: 325");
    expect(reader).toContain("root.firstSample === secondSample");
    expect(reader).toContain("root.firstSample.length > 0");
    expect(reader).not.toMatch(/setValue|repeat:\s*true/u);
  });

  it("uses only the public KWin QML module and writes only active-window focus", () => {
    for (const source of qmlSources) {
      expect(source).not.toContain("org.kde.kwin.private");
    }

    expect(main).toContain("KWin.SceneEffect");
    expect(scene).toContain("KWin.SceneView.effect");
    expect(scene).toContain("KWin.SceneView.screen");
    expect(scene).toContain("KWin.SceneView.currentDesktop");
    expect(scene).toContain("for (const desktop of KWin.Workspace.desktops)");
    expect(scene).toContain("function onWindowAdded()");
    expect(scene).toContain("function onWindowRemoved()");
    expect(desktopCard).toContain("KWin.WindowModel");
    expect(desktopCard).toContain("KWin.WindowFilterModel");
    expect(desktopCard).toContain("KWin.WindowThumbnail");
    const workspaceWrites =
      qmlSources
        .join("\n")
        .match(/KWin\.Workspace\.[A-Za-z0-9_]+\s*=(?!=)/gu) ?? [];
    expect(workspaceWrites).toHaveLength(1);
    expect(workspaceWrites[0]).toMatch(/^KWin\.Workspace\.activeWindow\s*=$/u);
    expect(qmlSources.join("\n")).not.toMatch(
      /(?:model\.window|candidate)\.[A-Za-z0-9_]+\s*=(?!=)|\.setValue\s*\(/u,
    );
  });

  it("focuses only a valid current-context thumbnail on a left click", () => {
    const focusHandler = scene.slice(
      scene.indexOf("function focusWindow("),
      scene.indexOf("function windowUsesDesktop("),
    );
    const desktopMembership = scene.slice(
      scene.indexOf("function windowUsesDesktop("),
      scene.indexOf("function windowUsesCurrentActivity("),
    );
    const activityMembership = scene.slice(
      scene.indexOf("function windowUsesCurrentActivity("),
      scene.indexOf("function orderedDesktopIds("),
    );

    expect(desktopCard.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(desktopCard).toContain("acceptedButtons: Qt.LeftButton");
    expect(desktopCard).toContain(
      "acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad",
    );
    expect(desktopCard).toContain(
      "enabled: card.current && thumbnailShell.visible",
    );
    expect(desktopCard).toContain(
      "card.windowTapped(model.window, thumbnailShell.windowId, card.desktop, card.desktopId)",
    );

    expect(focusHandler).toContain("!sceneEffect");
    expect(focusHandler).toContain("sceneEffect.active !== true");
    expect(focusHandler).toContain("!candidate");
    expect(focusHandler).toContain("candidate.deleted");
    expect(focusHandler).toContain("candidate.hidden");
    expect(focusHandler).toContain("candidate.minimized");
    expect(focusHandler).toContain("candidate.wantsInput !== true");
    expect(focusHandler).toContain(
      "String(candidate.internalId) !== expectedWindowId",
    );
    expect(focusHandler).toContain("!targetScreen");
    expect(focusHandler).toContain("candidate.output !== targetScreen");
    expect(focusHandler).toContain("activeDesktop !== expectedDesktop");
    expect(focusHandler).toContain(
      "String(activeDesktop.id) !== expectedDesktopId",
    );
    expect(focusHandler).toContain("expectedDesktopId.length === 0");
    expect(desktopMembership).toContain("const desktops = candidate.desktops");
    expect(desktopMembership).toMatch(
      /if \(desktops\.length === 0\) \{\s*return true;/u,
    );
    expect(activityMembership).toContain(
      "const activities = candidate.activities",
    );
    expect(activityMembership).toMatch(
      /if \(activities\.length === 0\) \{\s*return true;/u,
    );
    expect(activityMembership).toContain("KWin.Workspace.currentActivity");
    expect(
      focusHandler.match(/KWin\.Workspace\.activeWindow !== candidate/gu),
    ).toHaveLength(2);
    expect(focusHandler).toContain("KWin.Workspace.activeWindow = candidate");
    expect(focusHandler).toContain("sceneEffect.deactivate()");

    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = candidate",
    );
    const deactivate = focusHandler.indexOf("sceneEffect.deactivate()");
    const earlyReturns = [...focusHandler.matchAll(/\breturn;/gu)].map(
      (match) => match.index,
    );
    expect(earlyReturns).toHaveLength(3);
    expect(
      earlyReturns.slice(0, 2).every((index) => index < activeWindowWrite),
    ).toBe(true);
    expect(activeWindowWrite).toBeGreaterThan(0);
    expect(earlyReturns[2]).toBeGreaterThan(activeWindowWrite);
    expect(earlyReturns[2]).toBeLessThan(deactivate);
    expect(deactivate).toBeGreaterThan(activeWindowWrite);

    expect(scene).not.toContain("KWin.Workspace.stackingOrder");
    expect(`${scene}\n${desktopCard}`).not.toMatch(
      /MouseArea|DragHandler|ShortcutHandler|\.setValue\s*\(/u,
    );
  });

  it("projects stack heights without mixing pixels and auto weights", () => {
    expect(desktopCard).toContain(
      "const remaining = Math.max(0, contentHeight - fixedTotal * fixedScale)",
    );
    expect(desktopCard).toContain("remaining * weight / autoWeightTotal");
    expect(desktopCard).toContain("return contentHeight / 3");
    expect(desktopCard).toContain("return contentHeight / 2");
    expect(desktopCard).toContain("return contentHeight * 2 / 3");
  });

  it("loads the runtime through the fail-closed adapter boundary", () => {
    expect(main).toContain('import "../code/main.js" as OverviewRuntime');
    expect(main).toContain("OverviewRuntime.DriftileOverview");
    expect(main).toContain(
      "runtime.loadOverviewModel(document, liveSnapshot())",
    );
    expect(main).toContain("result.ok !== true");
    expect(main).toContain("overviewModel = null");
  });
});
