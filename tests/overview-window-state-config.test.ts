import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const configuration = readFileSync(
  new URL("contents/config/main.xml", effectRoot),
  "utf8",
);
const configurationUi = readFileSync(
  new URL("contents/ui/config.ui", effectRoot),
  "utf8",
);
const main = readFileSync(new URL("contents/ui/main.qml", effectRoot), "utf8");
const scene = readFileSync(
  new URL("contents/runtime/ui/OverviewScene.qml", effectRoot),
  "utf8",
);

describe("overview window state badge configuration", () => {
  it("defaults the native setting and control to enabled", () => {
    const entry = configuration.match(
      /<entry name="ShowWindowStateBadges"[\s\S]*?<\/entry>/u,
    )?.[0];
    const control = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_ShowWindowStateBadges">[\s\S]*?<\/widget>/u,
    )?.[0];

    expect(entry).toContain('type="Bool"');
    expect(entry).toContain("<default>true</default>");
    expect(control).toContain("<bool>true</bool>");
  });

  it("accepts only live boolean values and otherwise keeps badges enabled", () => {
    expect(main).toContain(
      "readonly property bool showWindowStateBadges: showWindowStateBadgesFromConfig()",
    );

    const readerStart = main.indexOf(
      "function showWindowStateBadgesFromConfig()",
    );
    const reader = main.slice(
      readerStart,
      main.indexOf("\n    }", readerStart) + 6,
    );
    expect(reader).toContain("configuration.ShowWindowStateBadges");
    expect(reader).toContain(
      'return typeof value === "boolean" ? value : true;',
    );
  });

  it("propagates the live scene setting to every desktop card", () => {
    expect(scene).toMatch(
      /readonly property bool showWindowStateBadges: sceneEffect\s*&& typeof sceneEffect\.showWindowStateBadges === "boolean"\s*\? sceneEffect\.showWindowStateBadges\s*: true/u,
    );
    expect(scene).toContain(
      "showWindowStateBadges: root.showWindowStateBadges",
    );
  });
});
