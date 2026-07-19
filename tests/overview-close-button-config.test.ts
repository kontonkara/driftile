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

describe("overview close button configuration", () => {
  it("defaults the native setting and control to enabled", () => {
    const entry = configuration.match(
      /<entry name="ShowWindowCloseButtons"[\s\S]*?<\/entry>/u,
    )?.[0];
    const control = configurationUi.match(
      /<widget class="QCheckBox" name="kcfg_ShowWindowCloseButtons">[\s\S]*?<\/widget>/u,
    )?.[0];

    expect(entry).toContain('type="Bool"');
    expect(entry).toContain("<default>false</default>");
    expect(control).toContain("<bool>false</bool>");
  });

  it("accepts only live boolean values and otherwise keeps buttons enabled", () => {
    expect(main).toContain(
      "readonly property bool showWindowCloseButtons: showWindowCloseButtonsFromConfig()",
    );

    const readerStart = main.indexOf(
      "function showWindowCloseButtonsFromConfig()",
    );
    const reader = main.slice(
      readerStart,
      main.indexOf("\n    }", readerStart) + 6,
    );
    expect(reader).toContain("configuration.ShowWindowCloseButtons");
    expect(reader).toContain(
      'return typeof value === "boolean" ? value : false;',
    );
  });

  it("propagates the live scene setting to every desktop card", () => {
    expect(scene).toMatch(
      /readonly property bool showWindowCloseButtons: sceneEffect\s*&& typeof sceneEffect\.showWindowCloseButtons === "boolean"\s*\? sceneEffect\.showWindowCloseButtons\s*: false/u,
    );
    expect(scene).toContain(
      "showWindowCloseButtons: root.showWindowCloseButtons",
    );
  });
});
