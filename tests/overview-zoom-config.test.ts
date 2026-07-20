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

describe("overview spatial zoom configuration", () => {
  it("declares matching bounded native and settings controls", () => {
    const entry = configuration.match(
      /<entry name="OverviewZoom"[\s\S]*?<\/entry>/u,
    )?.[0];
    const control = configurationUi.match(
      /<widget class="QDoubleSpinBox" name="kcfg_OverviewZoom">[\s\S]*?<\/widget>/u,
    )?.[0];

    expect(entry).toContain('type="Double"');
    expect(entry).toContain("<min>0.2</min>");
    expect(entry).toContain("<max>0.75</max>");
    expect(entry).toContain("<default>0.5</default>");
    expect(control).toContain("<double>0.200000000000000</double>");
    expect(control).toContain("<double>0.750000000000000</double>");
    expect(control).toContain("<double>0.500000000000000</double>");
  });

  it("uses only finite in-range values as the fresh-session baseline", () => {
    expect(main).toContain(
      "readonly property real configuredOverviewZoom: overviewZoomFromConfig()",
    );
    expect(main).toMatch(
      /readonly property real overviewZoom:[\s\S]*controller\.overviewSessionZoom[\s\S]*: configuredOverviewZoom/u,
    );
    expect(main).toContain(
      "onConfiguredOverviewZoomChanged: syncOverviewZoomSetting()",
    );
    expect(main).toContain(
      "controller.applyOverviewZoomSetting(configuredOverviewZoom)",
    );

    const readerStart = main.indexOf("function overviewZoomFromConfig()");
    const reader = main.slice(
      readerStart,
      main.indexOf("\n    }", readerStart) + 6,
    );
    expect(reader).toContain("Number(configuration.OverviewZoom)");
    expect(reader).toContain("Number.isFinite(value)");
    expect(reader).toContain("value >= 0.2 && value <= 0.75");
    expect(reader).toContain("? value : fallback;");
    expect(reader).not.toMatch(/\.setValue\s*\(|\bTimer\s*\{/u);
    expect(main).not.toMatch(/configuration\.OverviewZoom\s*=/u);
  });
});
