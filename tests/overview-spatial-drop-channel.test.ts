import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const writer = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewSpatialDropWriter.qml",
    import.meta.url,
  ),
  "utf8",
);
const controller = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/main.qml",
    import.meta.url,
  ),
  "utf8",
);
const effectRoot = readFileSync(
  new URL("../packaging/kwin-effect/contents/ui/main.qml", import.meta.url),
  "utf8",
);
const overviewScene = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewScene.qml",
    import.meta.url,
  ),
  "utf8",
);
const receiver = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/OverviewSpatialDropReceiver.qml",
    import.meta.url,
  ),
  "utf8",
);
const scriptRoot = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/main.qml",
    import.meta.url,
  ),
  "utf8",
);

describe("overview spatial drop command channel", () => {
  it("writes commands only to a dedicated bounded runtime channel", () => {
    expect(writer).toContain("StandardPaths.RuntimeLocation");
    expect(writer).toContain(
      'location: root.runtimeDirectory + "/driftile-overview-command.ini"',
    );
    expect(writer).toContain(
      'readonly property string commandCategory: "Command"',
    );
    expect(writer).toContain('readonly property string commandKey: "request"');
    expect(writer).toContain(
      'readonly property string requestIdKey: "last-request-id"',
    );
    expect(writer).toContain(
      "readonly property double maximumRequestId: Number.MAX_SAFE_INTEGER",
    );
    expect(writer).not.toContain("property double lastRequestId");
    expect(writer).toContain('typeof basisFingerprint !== "string"');
    expect(writer).toContain("!/^[0-9a-f]{64}$/.test(basisFingerprint)");
    expect(writer).toContain("Number.isSafeInteger(createdAt)");
    expect(writer).toContain("Number.isSafeInteger(previous)");
    expect(writer).toContain("const createdAt = Date.now();");
    expect(writer).toMatch(
      /previous >= 1[\s\S]*previous < maximumRequestId[\s\S]*\? previous \+ 1[\s\S]*: 1;/u,
    );
    expect(writer).not.toMatch(
      /GenericConfigLocation|ConfigLocation|Timer\s*\{|setTimeout|setInterval|Weak(?:Map|Set)|org\.kde\.kwin\.private/u,
    );
  });

  it("durably reserves each bounded request id across effect reloads", () => {
    const submit = writer.slice(
      writer.indexOf(
        "function submitSpatialDropCommand(source, target, basisFingerprint)",
      ),
      writer.indexOf("function reserveNextRequestId()"),
    );
    const reservation = writer.slice(
      writer.indexOf("function reserveNextRequestId()"),
      writer.indexOf("function failSubmission()"),
    );
    const initialSync = reservation.indexOf("commandSettings.sync();");
    const read = reservation.indexOf(
      "commandSettings.value(requestIdKey, 0)",
      initialSync,
    );
    const validate = reservation.indexOf('typeof previous !== "number"', read);
    const increment = reservation.indexOf(
      "previous >= 1 && previous < maximumRequestId ? previous + 1 : 1",
      validate,
    );
    const write = reservation.indexOf(
      "commandSettings.setValue(requestIdKey, requestId);",
      increment,
    );
    const durableSync = reservation.indexOf("commandSettings.sync();", write);
    const readBack = reservation.indexOf(
      "commandSettings.value(requestIdKey, 0)",
      durableSync,
    );
    const exactReadBack = reservation.indexOf(
      "storedRequestId === requestId",
      readBack,
    );

    expect(submit.indexOf("reserveNextRequestId()")).toBeGreaterThan(0);
    expect(
      submit.indexOf("runtime.encodeSpatialDropCommand({"),
    ).toBeGreaterThan(submit.indexOf("reserveNextRequestId()"));
    expect(initialSync).toBeGreaterThan(0);
    expect(read).toBeGreaterThan(initialSync);
    expect(validate).toBeGreaterThan(read);
    expect(increment).toBeGreaterThan(validate);
    expect(write).toBeGreaterThan(increment);
    expect(durableSync).toBeGreaterThan(write);
    expect(readBack).toBeGreaterThan(durableSync);
    expect(exactReadBack).toBeGreaterThan(readBack);
    expect(reservation).toContain("!Number.isSafeInteger(previous)");
    expect(reservation).toContain("previous < 0");
    expect(reservation).toContain("previous > maximumRequestId");
    expect(reservation).toContain("Object.is(previous, -0)");
    expect(reservation).toContain("return null;");
  });

  it("encodes, durably verifies, and invokes the internal action in order", () => {
    expect(writer).toContain('import "../code/main.js" as OverviewRuntime');
    expect(writer).toContain("OverviewRuntime.DriftileOverview");
    expect(writer).toContain("runtime.encodeSpatialDropCommand({");
    expect(writer).toContain("basisFingerprint,");
    expect(writer).toContain('format: "driftile-spatial-drop"');
    expect(writer).toContain("version: 4");

    const validateFingerprint = writer.indexOf(
      "!/^[0-9a-f]{64}$/.test(basisFingerprint)",
    );
    const reserve = writer.indexOf(
      "reserveNextRequestId()",
      validateFingerprint,
    );
    const encode = writer.indexOf("runtime.encodeSpatialDropCommand({");
    const write = writer.indexOf(
      "commandSettings.setValue(commandKey, document);",
    );
    const sync = writer.indexOf("commandSettings.sync();", write);
    const readBack = writer.indexOf(
      'commandSettings.value(commandKey, "");',
      sync,
    );
    const exactReadBack = writer.indexOf(
      "storedDocument !== document",
      readBack,
    );
    const invoke = writer.indexOf("applyCommandCall.call();", exactReadBack);

    expect(validateFingerprint).toBeGreaterThan(0);
    expect(reserve).toBeGreaterThan(validateFingerprint);
    expect(encode).toBeGreaterThan(reserve);
    expect(write).toBeGreaterThan(encode);
    expect(sync).toBeGreaterThan(write);
    expect(readBack).toBeGreaterThan(sync);
    expect(exactReadBack).toBeGreaterThan(readBack);
    expect(invoke).toBeGreaterThan(exactReadBack);
  });

  it("uses the public KGlobalAccel component and clears every failed submission", () => {
    expect(writer).toContain(
      "readonly property KWin.DBusCall applyCommandCall",
    );
    expect(writer).toContain('service: "org.kde.kglobalaccel"');
    expect(writer).toContain('path: "/component/kwin"');
    expect(writer).toContain('dbusInterface: "org.kde.kglobalaccel.Component"');
    expect(writer).toContain('method: "invokeShortcut"');
    expect(writer).toContain(
      'applyCommandCall.arguments = ["driftile_apply_overview_spatial_drop"]',
    );
    expect(
      writer.match(/return failSubmission\(\);/gu)?.length,
    ).toBeGreaterThan(2);
    expect(writer).toMatch(
      /function failSubmission\(\) \{[\s\S]*clearCommand\(\);[\s\S]*return false;/u,
    );
    expect(writer).toMatch(
      /function clearCommand\(\) \{[\s\S]*setValue\(commandKey, ""\);[\s\S]*commandSettings\.sync\(\);/u,
    );
    expect(writer).not.toMatch(/poll|repeat\s*:/iu);
  });

  it("shares the bounded runtime channel with the core script receiver", () => {
    expect(receiver).toContain("StandardPaths.RuntimeLocation");
    expect(receiver).toContain('category: "Command"');
    expect(receiver).toContain(' + "/driftile-overview-command.ini"');
    expect(receiver).toContain('commandSettings.value("request", "")');
    expect(receiver).toContain('commandSettings.setValue("request", "")');
    expect(receiver).toContain('name: "driftile_apply_overview_spatial_drop"');
    expect(writer).toContain('commandCategory: "Command"');
    expect(writer).toContain('commandKey: "request"');
    expect(writer).toContain('"/driftile-overview-command.ini"');
    expect(writer).toContain('"driftile_apply_overview_spatial_drop"');
    expect(`${writer}\n${receiver}`).not.toMatch(
      /GenericConfigLocation|org\.kde\.kwin\.private/u,
    );
  });

  it("destructively consumes before applying and advances every consumed request", () => {
    const read = receiver.indexOf('commandSettings.value("request", "")');
    const clear = receiver.indexOf(
      'commandSettings.setValue("request", "")',
      read,
    );
    const clearSync = receiver.indexOf("commandSettings.sync();", clear);
    const apply = receiver.indexOf(
      "applyCommand(document, Date.now(), lastConsumedRequestId)",
      clearSync,
    );
    const validate = receiver.indexOf("result.consumed !== true", apply);
    const advance = receiver.indexOf(
      "lastConsumedRequestId = result.requestId;",
      validate,
    );

    expect(read).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(read);
    expect(clearSync).toBeGreaterThan(clear);
    expect(apply).toBeGreaterThan(clearSync);
    expect(validate).toBeGreaterThan(apply);
    expect(advance).toBeGreaterThan(validate);
    expect(receiver).toContain("return result.applied;");
    expect(receiver).toContain("required property var applyCommand");
    expect(receiver).toContain('typeof applyCommand !== "function"');
    expect(receiver).not.toContain('import "../code/main.js" as Runtime');
    expect(receiver).not.toMatch(
      /Timer\s*\{|setTimeout|setInterval|Weak(?:Map|Set)|org\.kde\.kwin\.private/u,
    );
  });

  it("passes the initialized runtime command into the receiver", () => {
    const binding = scriptRoot.slice(
      scriptRoot.indexOf(
        "readonly property OverviewSpatialDropReceiver overviewSpatialDropReceiver",
      ),
      scriptRoot.indexOf("readonly property DBusCall tabIndicatorCall"),
    );

    expect(binding).toContain("OverviewSpatialDropReceiver {");
    expect(binding).toContain(
      "applyCommand: Runtime.DriftileRuntime.applyOverviewSpatialDrop",
    );
    expect(binding).not.toMatch(
      /Component\.createObject|Loader\s*\{|Timer\s*\{/u,
    );
  });

  it("exposes one exact presentation-state guarded controller entry point", () => {
    expect(controller).toContain(
      "readonly property OverviewSpatialDropWriter spatialDropWriter",
    );
    const submit = controller.slice(
      controller.indexOf(
        "function submitSpatialDropCommand(source, target, basisFingerprint)",
      ),
      controller.indexOf("function applyTouchpadGestureSettings("),
    );

    expect(submit).toMatch(
      /if \(!active \|\| loading \|\| activeSessionId <= 0 \|\| !overviewModel[\s\S]*presentationPhase !== "opening" && presentationPhase !== "open"\)\) \{[\s\S]*return false;/u,
    );
    expect(submit).toContain(
      "return spatialDropWriter.submitSpatialDropCommand(source, target, basisFingerprint);",
    );
    expect(submit).toContain('typeof basisFingerprint !== "string"');
    expect(submit).toContain(
      "function captureSpatialDropBasisFingerprint(source, target)",
    );
    expect(submit).toContain(
      "runtime.overviewSpatialDropBasisContextKeys(source, target)",
    );
    expect(submit).toMatch(
      /const values = \[\s*Number\(screen\.devicePixelRatio\),\s*Number\(outputGeometry\.x\),\s*Number\(outputGeometry\.y\),\s*Number\(outputGeometry\.width\),\s*Number\(outputGeometry\.height\),\s*Number\(workArea\.x\),\s*Number\(workArea\.y\),\s*Number\(workArea\.width\),\s*Number\(workArea\.height\)\s*\];/u,
    );
    expect(submit.match(/submitSpatialDropCommand/gu)).toHaveLength(2);
  });

  it("bridges scene views to the guarded controller entry point", () => {
    const bridge = effectRoot.slice(
      effectRoot.indexOf(
        "function captureSpatialDropBasisFingerprint(source, target)",
      ),
      effectRoot.indexOf("function syncTouchpadGestureSettings("),
    );

    expect(bridge).toContain(
      'typeof controller.captureSpatialDropBasisFingerprint === "function"',
    );
    expect(bridge).toContain(
      "controller.captureSpatialDropBasisFingerprint(source, target)",
    );
    expect(overviewScene).toMatch(
      /function captureSpatialDropBasisFingerprint\(source, target\)[\s\S]*effect\.captureSpatialDropBasisFingerprint\(source, target\)/u,
    );
    expect(bridge).toContain(
      'typeof controller.submitSpatialDropCommand === "function"',
    );
    expect(bridge).toContain(
      "controller.submitSpatialDropCommand(source, target, basisFingerprint) === true",
    );
    expect(bridge).toContain(": false;");
    expect(bridge).not.toMatch(
      /Timer\s*\{|setTimeout|setInterval|\.setValue\s*\(/u,
    );
  });
});
