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

  it("uses only the public KWin QML module and remains read-only", () => {
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
    expect(qmlSources.join("\n")).not.toMatch(
      /Workspace\.[A-Za-z0-9_]+\s*=(?!=)|model\.window\.[A-Za-z0-9_]+\s*=(?!=)|\.setValue\s*\(/u,
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
