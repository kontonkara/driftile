import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../native/wheel-control/src/wheelcontroleffect.cpp",
    import.meta.url,
  ),
  "utf8",
);
const header = readFileSync(
  new URL("../native/wheel-control/src/wheelcontroleffect.h", import.meta.url),
  "utf8",
);
const cmake = readFileSync(
  new URL("../native/wheel-control/CMakeLists.txt", import.meta.url),
  "utf8",
);
const metadata = JSON.parse(
  readFileSync(
    new URL("../native/wheel-control/metadata.json.in", import.meta.url),
    "utf8",
  ),
) as {
  KPlugin: { EnabledByDefault: boolean; Id: string; Version: string };
};

const compact = (value: string): string => value.replace(/\s+/gu, "");
const constructor = source.slice(
  source.indexOf("WheelControlEffect::WheelControlEffect()"),
  source.indexOf("void WheelControlEffect::registerImmediateAxisShortcut"),
);
const compactConstructor = compact(constructor);

describe("native wheel control", () => {
  it("maps the complete default axis shortcut set to existing actions", () => {
    const expectedRegistrations: readonly (readonly [string, ...string[]])[] = [
      [
        "registerWorkspaceAxisShortcut",
        "Qt::MetaModifier",
        "PointerAxisUp",
        "FocusPreviousDesktop",
        "WorkspaceCooldownLane::Focus",
        "WorkspaceDirection::Previous",
      ],
      [
        "registerWorkspaceAxisShortcut",
        "Qt::MetaModifier",
        "PointerAxisDown",
        "FocusNextDesktop",
        "WorkspaceCooldownLane::Focus",
        "WorkspaceDirection::Next",
      ],
      [
        "registerWorkspaceAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier",
        "PointerAxisUp",
        "MoveColumnToPreviousDesktop",
        "WorkspaceCooldownLane::MoveColumn",
        "WorkspaceDirection::Previous",
      ],
      [
        "registerWorkspaceAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier",
        "PointerAxisDown",
        "MoveColumnToNextDesktop",
        "WorkspaceCooldownLane::MoveColumn",
        "WorkspaceDirection::Next",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier",
        "PointerAxisLeft",
        "FocusColumnLeft",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier",
        "PointerAxisRight",
        "FocusColumnRight",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier",
        "PointerAxisLeft",
        "MoveColumnLeft",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier",
        "PointerAxisRight",
        "MoveColumnRight",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ShiftModifier",
        "PointerAxisUp",
        "FocusColumnLeft",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ShiftModifier",
        "PointerAxisDown",
        "FocusColumnRight",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier|Qt::ShiftModifier",
        "PointerAxisUp",
        "MoveColumnLeft",
      ],
      [
        "registerImmediateAxisShortcut",
        "Qt::MetaModifier|Qt::ControlModifier|Qt::ShiftModifier",
        "PointerAxisDown",
        "MoveColumnRight",
      ],
    ];

    for (const registration of expectedRegistrations) {
      expect(compactConstructor).toContain(
        `${registration[0]}(${registration.slice(1).join(",")});`,
      );
    }

    expect(constructor.match(/registerWorkspaceAxisShortcut\(/gu)).toHaveLength(
      4,
    );
    expect(constructor.match(/registerImmediateAxisShortcut\(/gu)).toHaveLength(
      8,
    );
    expect(source).toContain(
      'QStringLiteral("driftile_focus_previous_desktop")',
    );
    expect(source).toContain('QStringLiteral("driftile_focus_next_desktop")');
    expect(source).toContain(
      'QStringLiteral("driftile_move_column_to_previous_desktop")',
    );
    expect(source).toContain(
      'QStringLiteral("driftile_move_column_to_next_desktop")',
    );
    expect(source).toContain('QStringLiteral("driftile_focus_column_left")');
    expect(source).toContain('QStringLiteral("driftile_focus_column_right")');
    expect(source).toContain('QStringLiteral("driftile_move_column_left")');
    expect(source).toContain('QStringLiteral("driftile_move_column_right")');
  });

  it("coalesces only repeated vertical workspace steps with fixed state", () => {
    const immediate = source.slice(
      source.indexOf("void WheelControlEffect::registerImmediateAxisShortcut"),
      source.indexOf("void WheelControlEffect::registerWorkspaceAxisShortcut"),
    );
    const workspace = source.slice(
      source.indexOf("void WheelControlEffect::registerWorkspaceAxisShortcut"),
      source.indexOf("void WheelControlEffect::invokeShortcut"),
    );

    expect(header).toContain("WorkspaceCooldownMilliseconds = 150");
    expect(header).toContain(
      "std::array<WorkspaceCooldown, WorkspaceCooldownLaneCount>",
    );
    expect(workspace).toContain("acceptWorkspaceStep(lane, direction)");
    expect(workspace).toContain("cooldown.direction == direction");
    expect(workspace).toContain(
      "cooldown.elapsed.elapsed() < WorkspaceCooldownMilliseconds",
    );
    expect(immediate).not.toContain("acceptWorkspaceStep");
    expect(`${header}\n${source}`).not.toMatch(
      /QTimer|setInterval|setTimeout/u,
    );
  });

  it("dispatches asynchronously through the public KGlobalAccel component", () => {
    expect(source).toContain("effects->registerAxisShortcut(");
    expect(source).toContain('QStringLiteral("org.kde.kglobalaccel")');
    expect(source).toContain('QStringLiteral("/component/kwin")');
    expect(source).toContain(
      'QStringLiteral("org.kde.kglobalaccel.Component")',
    );
    expect(source).toContain('QStringLiteral("invokeShortcut")');
    expect(source).toContain("QDBusConnection::sessionBus().send(message)");
    expect(source).not.toMatch(/blockingCall|\.call\s*\(/u);
  });

  it("is optional and stays within the public effect API", () => {
    expect(metadata.KPlugin.Id).toBe("driftile_wheel_control");
    expect(metadata.KPlugin.EnabledByDefault).toBe(false);
    expect(metadata.KPlugin.Version).toBe("@DRIFTILE_VERSION@");
    expect(cmake).toContain('INSTALL_NAMESPACE "kwin/effects/plugins"');
    expect(cmake).toContain("find_package(KWin 6.7 REQUIRED)");
    expect(cmake).toContain("set(DRIFTILE_VERSION");
    expect(cmake).toContain("configure_file(");
    expect(`${header}\n${source}`).not.toMatch(
      /kwin\/input\.h|\binput\(\)|Workspace::|InputEventFilter|pointerAxis\s*\(/u,
    );
    expect(constructor).not.toContain("Qt::NoModifier");
  });
});
