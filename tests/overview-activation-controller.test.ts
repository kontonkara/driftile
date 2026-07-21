import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const effectRoot = new URL("../packaging/kwin-effect/", import.meta.url);
const controller = readFileSync(
  new URL("contents/runtime/ui/main.qml", effectRoot),
  "utf8",
);
const reader = readFileSync(
  new URL("contents/runtime/ui/LayoutStateReader.qml", effectRoot),
  "utf8",
);

describe("overview activation controller", () => {
  it("reuses only an exact synchronous persisted-state and live-snapshot hit", () => {
    const activation = controller.slice(
      controller.indexOf("function activate()"),
      controller.indexOf("function deactivate()"),
    );
    const lookup = controller.slice(
      controller.indexOf("function lookupActivationCache("),
      controller.indexOf("function scheduleActivationCacheStore("),
    );

    expect(controller).toContain(
      "readonly property var overviewActivationCache: createActivationCache()",
    );
    expect(activation).toMatch(
      /const synchronousDocument = layoutStateReader\.readSample\(\);\s*const cachedModel = lookupActivationCache\(synchronousDocument\);/u,
    );
    expect(activation).not.toContain("liveSnapshot()");
    expect(activation).toMatch(
      /if \(cachedModel\) \{\s*acceptActivationModel\(attemptId, cachedModel\);\s*return;\s*\}\s*layoutStateReader\.sample\(attemptId\);/u,
    );
    expect(activation.indexOf("layoutStateReader.readSample()")).toBeLessThan(
      activation.indexOf("lookupActivationCache("),
    );
    expect(activation.indexOf("lookupActivationCache(")).toBeLessThan(
      activation.indexOf("layoutStateReader.sample(attemptId)"),
    );
    expect(lookup).toMatch(
      /cache\.hasExactDocument\(document\)[\s\S]*const snapshot = liveSnapshot\(\);[\s\S]*cache\.lookup\(document, snapshot\)/u,
    );
    expect(lookup.indexOf("cache.hasExactDocument(document)")).toBeLessThan(
      lookup.indexOf("liveSnapshot()"),
    );
  });

  it("keeps changed state on the existing two-sample confirmation path", () => {
    const sample = reader.slice(
      reader.indexOf("function sample(requestId)"),
      reader.indexOf("function cancel()"),
    );

    expect(reader).toContain("readonly property int sampleInterval: 120");
    expect(sample).toContain("const synchronousSample = readSample();");
    expect(sample).toContain("synchronousSample === stableSample");
    expect(sample).toContain("firstSample = synchronousSample;");
    expect(sample).toContain("secondSampleTimer.start();");
    expect(reader).toMatch(
      /const secondSample = root\.readSample\(\);[\s\S]*root\.firstSample === secondSample[\s\S]*root\.ready\(completedRequestId, secondSample\)/u,
    );
  });

  it("presents a validated activation before its guarded cache clone", () => {
    const acceptance = controller.slice(
      controller.indexOf("function acceptLayoutState("),
      controller.indexOf("function acceptActivationModel("),
    );
    const deferredStore = controller.slice(
      controller.indexOf("function scheduleActivationCacheStore("),
      controller.indexOf("function storeActivationCache("),
    );
    const refresh = controller.slice(
      controller.indexOf("function acceptLiveModelRefresh("),
      controller.indexOf("function rejectLiveModelRefresh("),
    );

    for (const path of [acceptance, refresh]) {
      expect(path).toMatch(
        /const snapshot = liveSnapshot\(\);\s*const result = runtime\.loadOverviewModel\(document, snapshot\);/u,
      );
    }
    expect(acceptance).toMatch(
      /result\.ok !== true \|\| !result\.value[\s\S]*acceptActivationModel\(attemptId, result\.value\)[\s\S]*scheduleActivationCacheStore\(attemptId, document, snapshot,[\s\S]*result\.value\)/u,
    );
    expect(acceptance).not.toContain("storeActivationCache(");
    expect(refresh).toMatch(
      /result\.ok !== true \|\| !result\.value[\s\S]*overviewModel = result\.value;[\s\S]*scheduleActivationCacheStore\(sessionId, document, snapshot,[\s\S]*result\.value\)/u,
    );
    expect(refresh).not.toContain("storeActivationCache(");
    expect(deferredStore).toMatch(
      /activeSessionId !== sessionId[\s\S]*overviewModel !== model[\s\S]*Qt\.callLater\(function\(\) \{[\s\S]*controller\.activeSessionId !== sessionId[\s\S]*controller\.overviewModel !== model[\s\S]*controller\.storeActivationCache\(document, snapshot, model\)/u,
    );
    expect(controller).toMatch(
      /function lookupActivationCache\(document\)[\s\S]*cache\.hasExactDocument\(document\)[\s\S]*result\.ok === true && result\.value/u,
    );
    expect(controller).toMatch(
      /function storeActivationCache\(document, snapshot, model\)[\s\S]*result\.ok === true && result\.value/u,
    );
    expect(`${controller}\n${reader}`).not.toMatch(
      /org\.kde\.kwin\.private|setInterval|setTimeout/u,
    );
  });
});
