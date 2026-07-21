import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const writer = readFileSync(
  new URL(
    "../packaging/kwin-effect/contents/runtime/ui/OverviewWorkspaceCommandWriter.qml",
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
const receiver = readFileSync(
  new URL(
    "../packaging/kwin-script/contents/runtime/ui/OverviewWorkspaceCommandReceiver.qml",
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
const overviewRuntime = readFileSync(
  new URL("../src/overview/runtime.ts", import.meta.url),
  "utf8",
);

describe("overview workspace command channel", () => {
  it("uses a dedicated RuntimeLocation document and shortcut", () => {
    expect(writer).toContain("StandardPaths.RuntimeLocation");
    expect(writer).toContain(
      'location: root.runtimeDirectory + "/driftile-overview-workspace-command.ini"',
    );
    expect(writer).toContain(
      'readonly property string commandCategory: "Command"',
    );
    expect(writer).toContain('readonly property string commandKey: "request"');
    expect(receiver).toContain("StandardPaths.RuntimeLocation");
    expect(receiver).toContain('category: "Command"');
    expect(receiver).toContain(' + "/driftile-overview-workspace-command.ini"');
    expect(receiver).toContain(
      'name: "driftile_apply_overview_workspace_command"',
    );
    expect(`${writer}\n${receiver}`).not.toContain(
      "driftile-overview-command.ini",
    );
    expect(`${writer}\n${receiver}`).not.toMatch(
      /GenericConfigLocation|ConfigLocation|org\.kde\.kwin\.private/u,
    );
  });

  it("does not overwrite a pending one-way request", () => {
    const submit = writer.slice(
      writer.indexOf("function submitWorkspaceCommand(context, action)"),
      writer.indexOf("function commandChannelIsAvailable()"),
    );
    const availability = writer.slice(
      writer.indexOf("function commandChannelIsAvailable()"),
      writer.indexOf("function clearCommandOnStartup()"),
    );
    const availabilityCheck = submit.indexOf("!commandChannelIsAvailable()");
    const reservation = submit.indexOf("reserveNextRequestId()");
    const write = submit.indexOf(
      "commandSettings.setValue(commandKey, document);",
    );

    expect(availabilityCheck).toBeGreaterThan(0);
    expect(reservation).toBeGreaterThan(availabilityCheck);
    expect(write).toBeGreaterThan(reservation);
    expect(availability).toContain("commandSettings.sync();");
    expect(availability).toContain('commandSettings.value(commandKey, "")');
    expect(availability).toContain(
      'typeof document === "string" && document.length === 0',
    );
    expect(availability).not.toContain("setValue");
  });

  it("clears only a stale dedicated document when a writer instance starts", () => {
    const startup = writer.slice(
      writer.indexOf("function clearCommandOnStartup()"),
      writer.indexOf("function reserveNextRequestId()"),
    );

    expect(writer).toContain(
      "Component.onCompleted: root.clearCommandOnStartup()",
    );
    expect(startup).toContain('commandSettings.setValue(commandKey, "");');
    expect(startup).toContain("commandSettings.sync();");
    expect(startup).toContain('commandSettings.value(commandKey, "") === ""');
    expect(startup).not.toContain("requestIdKey");
    expect(startup).not.toContain("applyCommandCall");
  });

  it("durably reserves bounded monotonic request ids across effect reloads", () => {
    const reservation = writer.slice(
      writer.indexOf("function reserveNextRequestId()"),
      writer.indexOf("function clearCommandIfExact(expectedDocument)"),
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

    expect(writer).toContain(
      "readonly property double maximumRequestId: Number.MAX_SAFE_INTEGER",
    );
    expect(writer).toContain(
      'readonly property string requestIdKey: "last-request-id"',
    );
    expect(writer).not.toContain("property double lastRequestId");
    expect(initialSync).toBeGreaterThan(0);
    expect(read).toBeGreaterThan(initialSync);
    expect(validate).toBeGreaterThan(read);
    expect(increment).toBeGreaterThan(validate);
    expect(write).toBeGreaterThan(increment);
    expect(durableSync).toBeGreaterThan(write);
    expect(readBack).toBeGreaterThan(durableSync);
    expect(exactReadBack).toBeGreaterThan(readBack);
    expect(reservation).toContain("!Number.isSafeInteger(previous)");
    expect(reservation).toContain("Object.is(previous, -0)");
  });

  it("encodes the exact v1 context and verifies storage before invocation", () => {
    const submit = writer.slice(
      writer.indexOf("function submitWorkspaceCommand(context, action)"),
      writer.indexOf("function commandChannelIsAvailable()"),
    );
    const encode = submit.indexOf("runtime.encodeOverviewWorkspaceCommand({");
    const write = submit.indexOf(
      "commandSettings.setValue(commandKey, document);",
      encode,
    );
    const sync = submit.indexOf("commandSettings.sync();", write);
    const readBack = submit.indexOf(
      'commandSettings.value(commandKey, "")',
      sync,
    );
    const exactReadBack = submit.indexOf(
      "storedDocument !== document",
      readBack,
    );
    const invoke = submit.indexOf("applyCommandCall.call();", exactReadBack);

    expect(writer).toContain('import "../code/main.js" as OverviewRuntime');
    expect(writer).toContain("OverviewRuntime.DriftileOverview");
    expect(submit).toContain("const createdAt = Date.now();");
    expect(submit).toContain("Number.isSafeInteger(createdAt)");
    expect(submit).toContain("action,");
    expect(submit).toContain(
      "activityId: context ? context.activityId : undefined",
    );
    expect(submit).toContain(
      "desktopIds: context ? context.desktopIds : undefined",
    );
    expect(submit).toContain('format: "driftile-overview-workspace-command"');
    expect(submit).toContain(
      "outputId: context ? context.outputId : undefined",
    );
    expect(submit).toContain("version: 1");
    expect(encode).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(encode);
    expect(sync).toBeGreaterThan(write);
    expect(readBack).toBeGreaterThan(sync);
    expect(exactReadBack).toBeGreaterThan(readBack);
    expect(invoke).toBeGreaterThan(exactReadBack);
  });

  it("invokes only the public KGlobalAccel component and clears exact failed writes", () => {
    expect(writer).toContain(
      "readonly property KWin.DBusCall applyCommandCall",
    );
    expect(writer).toContain('service: "org.kde.kglobalaccel"');
    expect(writer).toContain('path: "/component/kwin"');
    expect(writer).toContain('dbusInterface: "org.kde.kglobalaccel.Component"');
    expect(writer).toContain('method: "invokeShortcut"');
    expect(writer).toContain(
      'applyCommandCall.arguments = ["driftile_apply_overview_workspace_command"]',
    );
    expect(writer).toMatch(
      /function clearCommandIfExact\(expectedDocument\) \{[\s\S]*value\(commandKey, ""\) !== expectedDocument[\s\S]*setValue\(commandKey, ""\);[\s\S]*commandSettings\.sync\(\);/u,
    );
    expect(writer).toMatch(
      /catch \(error\) \{[\s\S]{0,100}clearCommandIfExact\(document\);[\s\S]{0,100}return false;/u,
    );
    expect(writer).not.toMatch(
      /Timer\s*\{|setTimeout|setInterval|Weak(?:Map|Set)|poll|repeat\s*:/u,
    );
  });

  it("destructively consumes before applying and advances accepted request ids", () => {
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
    expect(receiver).toContain("required property var applyCommand");
    expect(receiver).toContain("return result.applied;");
    expect(receiver).not.toContain('import "../code/main.js" as Runtime');
    expect(receiver).not.toMatch(
      /Timer\s*\{|setTimeout|setInterval|Weak(?:Map|Set)|org\.kde\.kwin\.private/u,
    );
  });

  it("connects both package roots without dynamic component construction", () => {
    const scriptBinding = scriptRoot.slice(
      scriptRoot.indexOf(
        "readonly property OverviewWorkspaceCommandReceiver overviewWorkspaceCommandReceiver",
      ),
      scriptRoot.indexOf("readonly property DBusCall tabIndicatorCall"),
    );
    const controllerBinding = controller.slice(
      controller.indexOf(
        "readonly property OverviewWorkspaceCommandWriter workspaceCommandWriter",
      ),
      controller.indexOf(
        "readonly property KWin.ShortcutHandler toggleShortcut",
      ),
    );

    expect(scriptBinding).toContain("OverviewWorkspaceCommandReceiver {");
    expect(scriptBinding).toContain(
      "applyCommand: Runtime.DriftileRuntime.applyOverviewWorkspaceCommand",
    );
    expect(controllerBinding).toContain("OverviewWorkspaceCommandWriter {");
    expect(`${scriptBinding}\n${controllerBinding}`).not.toMatch(
      /Component\.createObject|Loader\s*\{|Timer\s*\{/u,
    );
  });

  it("guards one controller submission and bridges it through the SceneEffect", () => {
    const submit = controller.slice(
      controller.indexOf("function submitWorkspaceCommand(context, action)"),
      controller.indexOf("function applyTouchpadGestureSettings("),
    );
    const bridge = effectRoot.slice(
      effectRoot.indexOf("function submitWorkspaceCommand(context, action)"),
      effectRoot.indexOf("function applyOverviewZoomInputState("),
    );

    expect(submit).toMatch(
      /if \(!active \|\| loading \|\| activeSessionId <= 0 \|\| !overviewModel[\s\S]*overviewContextRefreshPending[\s\S]*presentationPhase !== "opening" && presentationPhase !== "open"\)\) \{[\s\S]*return false;/u,
    );
    expect(submit).toContain(
      "return workspaceCommandWriter.submitWorkspaceCommand(context, action);",
    );
    expect(bridge).toContain(
      'typeof controller.submitWorkspaceCommand === "function"',
    );
    expect(bridge).toContain(
      "controller.submitWorkspaceCommand(context, action) === true",
    );
    expect(bridge).toContain(": false;");
    expect(bridge).not.toMatch(
      /Timer\s*\{|setTimeout|setInterval|\.setValue\s*\(/u,
    );
  });

  it("exports the exact codec into the Overview runtime bundle", () => {
    expect(overviewRuntime).toContain("decodeOverviewWorkspaceCommand,");
    expect(overviewRuntime).toContain("encodeOverviewWorkspaceCommand,");
    expect(overviewRuntime).toContain('from "./workspace-command";');
    expect(overviewRuntime.match(/workspace-command/gu)).toHaveLength(2);
  });

  it("preserves the independent spatial command channel", () => {
    expect(controller).toContain(
      "readonly property OverviewSpatialDropWriter spatialDropWriter",
    );
    expect(controller).toContain(
      "function submitSpatialDropCommand(source, target)",
    );
    expect(scriptRoot).toContain(
      "readonly property OverviewSpatialDropReceiver overviewSpatialDropReceiver",
    );
    expect(scriptRoot).toContain(
      "applyCommand: Runtime.DriftileRuntime.applyOverviewSpatialDrop",
    );
  });
});
