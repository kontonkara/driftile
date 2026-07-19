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

describe("overview application icon configuration", () => {
  it("defaults the native setting and control to enabled", () => {
    const entry = configuration.match(
      /<entry name="ShowApplicationIcons"[\s\S]*?<\/entry>/u,
    )?.[0];
    const control = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_ShowApplicationIcons">[\s\S]*?<\/widget>/u,
    )?.[0];

    expect(entry).toContain('type="Bool"');
    expect(entry).toContain("<default>false</default>");
    expect(control).toContain("<bool>false</bool>");
    expect(configurationUi).toMatch(
      /<widget class="QWidget" name="DriftileOverviewEffectConfig">[\s\S]*?<height>350<\/height>[\s\S]*?<layout class="QFormLayout"/u,
    );
  });

  it("accepts only live boolean values and otherwise keeps icons enabled", () => {
    expect(main).toContain(
      "readonly property bool showApplicationIcons: showApplicationIconsFromConfig()",
    );

    const readerStart = main.indexOf(
      "function showApplicationIconsFromConfig()",
    );
    const reader = main.slice(
      readerStart,
      main.indexOf("\n    }", readerStart) + 6,
    );
    expect(reader).toContain("configuration.ShowApplicationIcons");
    expect(reader).toContain(
      'return typeof value === "boolean" ? value : false;',
    );
  });

  it("propagates the live scene setting to every desktop card", () => {
    expect(scene).toMatch(
      /readonly property bool showApplicationIcons: sceneEffect\s*&& typeof sceneEffect\.showApplicationIcons === "boolean"\s*\? sceneEffect\.showApplicationIcons\s*: false/u,
    );
    expect(scene).toContain("showApplicationIcons: root.showApplicationIcons");
  });
});
