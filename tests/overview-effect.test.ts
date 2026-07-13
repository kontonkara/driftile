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

    expect(desktopCard.match(/\bTapHandler\s*\{/gu)).toHaveLength(1);
    expect(desktopCard).toContain("acceptedButtons: Qt.LeftButton");
    expect(desktopCard).toContain(
      "enabled: card.current && thumbnailShell.visible",
    );
    expect(desktopCard).toContain(
      "card.windowTapped(model.window, thumbnailShell.windowId, card.desktop, card.desktopId)",
    );

    expect(scene).toContain("!sceneEffect");
    expect(scene).toContain("sceneEffect.active !== true");
    expect(scene).toContain("!candidate");
    expect(scene).toContain("candidate.deleted");
    expect(scene).toContain("candidate.hidden");
    expect(scene).toContain("candidate.minimized");
    expect(scene).toContain("candidate.wantsInput !== true");
    expect(scene).toContain(
      "String(candidate.internalId) !== expectedWindowId",
    );
    expect(scene).toContain("!targetScreen");
    expect(scene).toContain("candidate.output !== targetScreen");
    expect(scene).toContain("activeDesktop !== expectedDesktop");
    expect(scene).toContain("String(activeDesktop.id) !== expectedDesktopId");
    expect(scene).toContain("expectedDesktopId.length === 0");
    expect(scene).toContain("const desktops = candidate.desktops");
    expect(scene).toMatch(/if \(desktops\.length === 0\) \{\s*return true;/u);
    expect(scene).toContain("const activities = candidate.activities");
    expect(scene).toMatch(/if \(activities\.length === 0\) \{\s*return true;/u);
    expect(scene).toContain("KWin.Workspace.currentActivity");
    expect(scene).toContain("KWin.Workspace.activeWindow !== candidate");
    expect(scene).toContain("KWin.Workspace.activeWindow = candidate");
    expect(scene).toContain("sceneEffect.deactivate()");

    const activeWindowWrite = focusHandler.indexOf(
      "KWin.Workspace.activeWindow = candidate",
    );
    const deactivate = focusHandler.indexOf("sceneEffect.deactivate()");
    const earlyReturns = [...focusHandler.matchAll(/\breturn;/gu)].map(
      (match) => match.index,
    );
    expect(earlyReturns).toHaveLength(2);
    expect(earlyReturns.every((index) => index < activeWindowWrite)).toBe(true);
    expect(activeWindowWrite).toBeGreaterThan(0);
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
