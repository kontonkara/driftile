import { describe, expect, it } from "vitest";
import type { KWinWorkspace } from "../../../src/platform/kwin/api";
import {
  FALLBACK_ACTIVITY_ID,
  KWinActivityAdapter,
} from "../../../src/platform/kwin/activity-adapter";

function workspace(
  overrides: Partial<Pick<KWinWorkspace, "activities" | "currentActivity">>,
): KWinWorkspace {
  return overrides as KWinWorkspace;
}

describe("KWinActivityAdapter", () => {
  it("uses one fallback context when the activity API is unavailable", () => {
    const adapter = new KWinActivityAdapter(workspace({}));

    expect(adapter.current()).toBe(FALLBACK_ACTIVITY_ID);
    expect(adapter.forWindow([])).toBe(FALLBACK_ACTIVITY_ID);
  });

  it("uses the only activity for all-activity windows", () => {
    const adapter = new KWinActivityAdapter(
      workspace({ activities: ["work"], currentActivity: "work" }),
    );

    expect(adapter.current()).toBe("work");
    expect(adapter.forWindow([])).toBe("work");
    expect(
      new KWinActivityAdapter(
        workspace({ activities: ["work"], currentActivity: "" }),
      ).current(),
    ).toBe("work");
  });

  it("keeps single-activity windows in their exact inactive context", () => {
    const adapter = new KWinActivityAdapter(
      workspace({
        activities: ["work", "personal"],
        currentActivity: "work",
      }),
    );

    expect(adapter.current()).toBe("work");
    expect(adapter.forWindow(["personal"])).toBe("personal");
  });

  it("rejects shared, stale, and malformed memberships", () => {
    const adapter = new KWinActivityAdapter(
      workspace({
        activities: ["work", "personal"],
        currentActivity: "work",
      }),
    );

    expect(adapter.forWindow([])).toBeNull();
    expect(adapter.forWindow(["work", "personal"])).toBeNull();
    expect(adapter.forWindow(["removed"])).toBeNull();
    expect(adapter.forWindow([""])).toBeNull();
    expect(adapter.forWindow(["bad\u0000activity"])).toBeNull();
  });

  it("fails closed when a multi-activity workspace has no valid current id", () => {
    const adapter = new KWinActivityAdapter(
      workspace({ activities: ["work", "personal"], currentActivity: "" }),
    );

    expect(adapter.current()).toBeNull();
  });
});
