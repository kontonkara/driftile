import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptRoot = new URL("../packaging/kwin-script/", import.meta.url);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", scriptRoot),
  "utf8",
);
const verticalGrid = readFileSync(
  new URL("contents/runtime/ui/VerticalDesktopGrid.qml", scriptRoot),
  "utf8",
);

describe("vertical desktop grid synchronization", () => {
  it("uses only the public KWin workspace grid properties", () => {
    expect(verticalGrid).toContain("import org.kde.kwin");
    expect(verticalGrid).toContain(
      "Workspace.desktopGridHeight = desktopCount;",
    );
    expect(verticalGrid).toContain("Workspace.desktopGridWidth !== 1");
    expect(verticalGrid).not.toMatch(
      /DBus|org\.kde\.kwin\.private|callDBus|SessionBus|Properties/u,
    );
  });

  it("synchronizes on startup and every public topology change", () => {
    expect(verticalGrid).toContain("Component.onCompleted: synchronizeRows()");
    expect(verticalGrid).toMatch(
      /readonly property Connections workspaceConnection: Connections \{[\s\S]*target: Workspace[\s\S]*function onDesktopsChanged\(\) \{\s*root\.synchronizeRows\(\);[\s\S]*function onDesktopLayoutChanged\(\) \{\s*root\.synchronizeRows\(\);/u,
    );
    expect(controller).toMatch(
      /readonly property VerticalDesktopGrid verticalDesktopGrid: VerticalDesktopGrid \{\s*\}/u,
    );
    expect(controller).toMatch(
      /Component\.onCompleted: \{[\s\S]*root\.verticalDesktopGrid\.synchronizeRows\(\);[\s\S]*root\.refreshTouchpadNavigationHandlers\(true\);/u,
    );
    expect(
      controller.match(/VerticalDesktopGrid verticalDesktopGrid/gu),
    ).toHaveLength(1);
  });

  it("writes only an exact bounded live desktop count", () => {
    const synchronization = verticalGrid.slice(
      verticalGrid.indexOf("function synchronizeRows()"),
      verticalGrid.indexOf("function exactDesktopCount()"),
    );
    const localCount = verticalGrid.slice(
      verticalGrid.indexOf("function exactDesktopCount()"),
    );

    expect(verticalGrid).toContain(
      "readonly property int maximumDesktopCount: 25",
    );
    expect(localCount).toContain("const desktops = Workspace.desktops;");
    expect(localCount).toMatch(
      /Number\.isInteger\(desktops\.length\)[\s\S]*desktops\.length < 1 \|\| desktops\.length > maximumDesktopCount[\s\S]*return desktops\.length;/u,
    );
    expect(synchronization).toMatch(
      /if \(desktopCount === 0\) \{\s*return false;/u,
    );
    expect(synchronization).toMatch(
      /if \(Workspace\.desktopGridHeight !== desktopCount[\s\S]*Workspace\.desktopGridWidth !== 1\) \{\s*Workspace\.desktopGridHeight = desktopCount;/u,
    );
    expect(synchronization).toMatch(
      /return Workspace\.desktopGridHeight === desktopCount\s*&& Workspace\.desktopGridWidth === 1;/u,
    );
    expect(synchronization).not.toMatch(/Math\.(?:floor|ceil|round|max|min)/u);
  });

  it("fails closed without asynchronous, polling, or private helpers", () => {
    expect(verticalGrid).toMatch(
      /function synchronizeRows\(\)[\s\S]*catch \(error\) \{\s*return false;/u,
    );
    expect(verticalGrid).toMatch(
      /function exactDesktopCount\(\)[\s\S]*catch \(error\) \{\s*return 0;/u,
    );
    expect(verticalGrid).not.toMatch(
      /\b(?:Timer|DBusCall|Process|Executable|ShellCommand)\s*\{|setInterval|setTimeout|Qt\.callLater|asyncCall|\.setValue\s*\(/u,
    );
    expect(verticalGrid.match(/Workspace\.[A-Za-z0-9_]+\s*=(?!=)/gu)).toEqual([
      "Workspace.desktopGridHeight =",
    ]);
  });
});
