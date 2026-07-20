import { describe, expect, it } from "vitest";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../src/core/layout-persistence";
import {
  OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS,
  OVERVIEW_SPATIAL_ZOOM_LIMITS,
  planOverviewSpatialLayout,
  planOverviewSpatialZoomBegin,
  planOverviewSpatialZoomFinish,
  planOverviewSpatialZoomLevel,
  planOverviewSpatialZoomPreview,
} from "../../src/overview/runtime";

const baseBeginInput = Object.freeze({
  anchorSceneY: 300,
  contentY: 600,
  currentWorkspaceIndex: 1,
  sceneHeight: 900,
  sceneWidth: 1600,
  workspaceCount: 4,
  zoom: 0.5,
});

describe("planOverviewSpatialZoomLevel", () => {
  it("shares the authoritative layout range and resets to configured zoom", () => {
    expect(OVERVIEW_SPATIAL_ZOOM_LIMITS).toMatchObject({
      maximum: OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS.maximum,
      minimum: OVERVIEW_SPATIAL_LAYOUT_ZOOM_LIMITS.minimum,
    });

    const plan = planOverviewSpatialZoomLevel({
      configuredZoom: 0.37,
      currentZoom: 0.5,
      intent: "reset",
    });

    expect(plan).toEqual({
      atMaximum: false,
      atMinimum: false,
      changed: true,
      scale: 0.74,
      zoom: 0.37,
    });
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("applies bounded steps and reports saturation", () => {
    expect(
      planOverviewSpatialZoomLevel({
        currentZoom: 0.37,
        direction: "in",
        intent: "step",
        steps: 1,
      }),
    ).toEqual({
      atMaximum: false,
      atMinimum: false,
      changed: true,
      scale: 0.42 / 0.37,
      zoom: 0.42,
    });
    expect(
      planOverviewSpatialZoomLevel({
        currentZoom: 0.37,
        direction: "out",
        intent: "step",
        steps: 4,
      }),
    ).toEqual({
      atMaximum: false,
      atMinimum: true,
      changed: true,
      scale: 0.2 / 0.37,
      zoom: 0.2,
    });
    expect(
      planOverviewSpatialZoomLevel({
        currentZoom: 0.75,
        direction: "in",
        intent: "step",
        steps: 4,
      }),
    ).toEqual({
      atMaximum: true,
      atMinimum: false,
      changed: false,
      scale: 1,
      zoom: 0.75,
    });
  });

  it("keeps repeated decimal steps stable and supports a zero-step no-op", () => {
    let zoom = 0.3;

    for (let index = 0; index < 9; index += 1) {
      const plan = planOverviewSpatialZoomLevel({
        currentZoom: zoom,
        direction: "in",
        intent: "step",
        steps: 1,
      });
      if (plan === null) {
        throw new Error("expected zoom-in plan");
      }
      zoom = plan.zoom;
    }

    expect(zoom).toBe(0.75);

    for (let index = 0; index < 9; index += 1) {
      const plan = planOverviewSpatialZoomLevel({
        currentZoom: zoom,
        direction: "out",
        intent: "step",
        steps: 1,
      });
      if (plan === null) {
        throw new Error("expected zoom-out plan");
      }
      zoom = plan.zoom;
    }

    expect(zoom).toBe(0.3);
    expect(
      planOverviewSpatialZoomLevel({
        currentZoom: zoom,
        direction: "in",
        intent: "step",
        steps: 0,
      }),
    ).toMatchObject({ changed: false, scale: 1, zoom: 0.3 });
  });

  it.each([
    null,
    [],
    {},
    { configuredZoom: 0.5, currentZoom: 0.5, intent: "unknown" },
    { configuredZoom: 0.19, currentZoom: 0.5, intent: "reset" },
    { configuredZoom: Number.NaN, currentZoom: 0.5, intent: "reset" },
    { configuredZoom: 0.5, currentZoom: 0.8, intent: "reset" },
    { currentZoom: 0.5, direction: "up", intent: "step", steps: 1 },
    { currentZoom: 0.5, direction: "in", intent: "step", steps: -1 },
    { currentZoom: 0.5, direction: "in", intent: "step", steps: 0.5 },
    { currentZoom: 0.5, direction: "in", intent: "step", steps: 5 },
  ])("fails closed for malformed level input (%o)", (input) => {
    expect(planOverviewSpatialZoomLevel(input)).toBeNull();
  });

  it("fails closed for hostile level accessors", () => {
    const hostile = Object.defineProperty({}, "currentZoom", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialZoomLevel(hostile)).toBeNull();
  });
});

describe("planOverviewSpatialZoomBegin", () => {
  it("captures an immutable logical anchor without recentering", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const expectedStride = 450 + 45;

    expect(transaction).toMatchObject({
      anchorSceneY: 300,
      anchorWorkspacePosition: (600 + 300 - 450) / expectedStride,
      originContentY: 600,
      originMaximumContentY: 3 * expectedStride,
      originZoom: 0.5,
      previewContentY: 600,
      previewMaximumContentY: 3 * expectedStride,
      previewZoom: 0.5,
    });
    expect(Object.isFrozen(transaction)).toBe(true);
  });

  it("accepts the bounded workspace limit without retaining a catalog", () => {
    const transaction = planOverviewSpatialZoomBegin({
      ...baseBeginInput,
      contentY: 0,
      currentWorkspaceIndex: LAYOUT_PERSISTENCE_LIMITS.contexts - 1,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts,
    });

    expect(transaction?.workspaceCount).toBe(
      LAYOUT_PERSISTENCE_LIMITS.contexts,
    );
    expect(Object.keys(transaction ?? {})).toHaveLength(12);
  });

  it.each([
    null,
    [],
    {},
    { ...baseBeginInput, anchorSceneY: -1 },
    { ...baseBeginInput, anchorSceneY: 901 },
    { ...baseBeginInput, contentY: -1 },
    { ...baseBeginInput, contentY: 1486 },
    { ...baseBeginInput, currentWorkspaceIndex: 4 },
    { ...baseBeginInput, sceneHeight: 0 },
    { ...baseBeginInput, sceneWidth: Number.POSITIVE_INFINITY },
    { ...baseBeginInput, workspaceCount: 0 },
    {
      ...baseBeginInput,
      workspaceCount: LAYOUT_PERSISTENCE_LIMITS.contexts + 1,
    },
    { ...baseBeginInput, zoom: 0.19 },
    {
      ...baseBeginInput,
      currentWorkspaceIndex: 1,
      sceneHeight: Number.MAX_VALUE,
      sceneWidth: Number.MAX_VALUE,
      workspaceCount: 2,
      zoom: 0.75,
    },
  ])("fails closed for malformed begin input (%o)", (input) => {
    expect(planOverviewSpatialZoomBegin(input)).toBeNull();
  });

  it("fails closed for hostile begin accessors", () => {
    const hostile = Object.defineProperty({}, "anchorSceneY", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialZoomBegin(hostile)).toBeNull();
  });

  it("keeps every accepted realistic transaction composable", () => {
    let state = 0x4d595df4;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };

    for (let index = 0; index < 2048; index += 1) {
      const sceneHeight = 480 + random() * 1680;
      const sceneWidth = 640 + random() * 4480;
      const workspaceCount = 1 + Math.floor(random() * 32);
      const currentWorkspaceIndex = Math.floor(random() * workspaceCount);
      const zoom = 0.2 + random() * 0.55;
      const layout = planOverviewSpatialLayout({
        currentWorkspaceIndex,
        sceneHeight,
        sceneWidth,
        workspaceCount,
        zoom,
      });
      if (layout === null) {
        throw new Error("expected realistic layout");
      }
      const maximumContentY = layout.contentHeight - sceneHeight;
      const transaction = planOverviewSpatialZoomBegin({
        anchorSceneY: random() * sceneHeight,
        contentY: random() * maximumContentY,
        currentWorkspaceIndex,
        sceneHeight,
        sceneWidth,
        workspaceCount,
        zoom,
      });

      expect(transaction).not.toBeNull();
      expect(
        planOverviewSpatialZoomFinish({
          disposition: "cancel",
          transaction,
        }),
      ).not.toBeNull();

      const preview = planOverviewSpatialZoomPreview({
        scale: 0.25 + random() * 3.5,
        transaction,
      });
      expect(preview).not.toBeNull();
      expect(
        planOverviewSpatialZoomFinish({
          disposition: "commit",
          transaction: preview?.transaction,
        }),
      ).not.toBeNull();
      expect(
        planOverviewSpatialZoomPreview({
          scale: 0.25 + random() * 3.5,
          transaction: preview?.transaction,
        }),
      ).not.toBeNull();
    }
  });
});

describe("planOverviewSpatialZoomPreview", () => {
  it("preserves the exact scene anchor while the viewport is unclamped", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const preview = planOverviewSpatialZoomPreview({
      scale: 1.2,
      transaction,
    });
    const previousStride = 450 + 45;
    const nextStride = 540 + 48;
    const previousPosition = (600 + 300 - 450) / previousStride;
    const nextPosition =
      ((preview?.contentY ?? Number.NaN) + 300 - 450) / nextStride;

    expect(preview?.zoom).toBe(0.6);
    expect(preview?.anchorClamped).toBe(false);
    expect(nextPosition).toBeCloseTo(previousPosition, 12);
    expect(preview?.contentY).toBeCloseTo(
      450 + previousPosition * nextStride - 300,
      12,
    );
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview?.transaction)).toBe(true);
  });

  it("derives every precise preview from the immutable origin", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const first = planOverviewSpatialZoomPreview({
      scale: 1.2,
      transaction,
    });
    const reversed = planOverviewSpatialZoomPreview({
      scale: 0.8,
      transaction: first?.transaction,
    });
    const direct = planOverviewSpatialZoomPreview({
      scale: 0.8,
      transaction,
    });

    expect(reversed).toMatchObject({
      contentY: direct?.contentY,
      maximumContentY: direct?.maximumContentY,
      zoom: direct?.zoom,
    });
    expect(reversed?.transaction.originContentY).toBe(600);
    expect(reversed?.transaction.originZoom).toBe(0.5);
    expect(
      planOverviewSpatialZoomFinish({
        disposition: "cancel",
        transaction: reversed?.transaction,
      }),
    ).toEqual({
      contentY: 600,
      maximumContentY: transaction?.originMaximumContentY,
      zoom: 0.5,
    });
  });

  it("clamps impossible top and bottom anchors deterministically", () => {
    const top = planOverviewSpatialZoomBegin({
      ...baseBeginInput,
      anchorSceneY: 0,
      contentY: 0,
    });
    const topPreview = planOverviewSpatialZoomPreview({
      scale: 1.5,
      transaction: top,
    });
    const initialLayout = planOverviewSpatialLayout({
      currentWorkspaceIndex: 3,
      sceneHeight: 900,
      sceneWidth: 1600,
      workspaceCount: 4,
      zoom: 0.5,
    });
    const bottom = planOverviewSpatialZoomBegin({
      ...baseBeginInput,
      anchorSceneY: 900,
      contentY: (initialLayout?.contentHeight ?? 900) - 900,
      currentWorkspaceIndex: 3,
    });
    const bottomPreview = planOverviewSpatialZoomPreview({
      scale: 1.5,
      transaction: bottom,
    });

    expect(topPreview).toMatchObject({ anchorClamped: true, contentY: 0 });
    expect(bottomPreview).toMatchObject({
      anchorClamped: true,
      contentY: bottomPreview?.maximumContentY,
    });
  });

  it("saturates precise scale at the shared zoom range", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);

    expect(
      planOverviewSpatialZoomPreview({ scale: 16, transaction }),
    ).toMatchObject({ zoom: 0.75 });
    expect(
      planOverviewSpatialZoomPreview({ scale: 1 / 16, transaction }),
    ).toMatchObject({ zoom: 0.2 });
  });

  it.each([-1, 0, 1 / 32, 17, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects malformed preview scale %o",
    (scale) => {
      expect(
        planOverviewSpatialZoomPreview({
          scale,
          transaction: planOverviewSpatialZoomBegin(baseBeginInput),
        }),
      ).toBeNull();
    },
  );

  it("rejects forged and hostile transaction state", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const forged = { ...transaction, originContentY: 700 };
    const forgedMaximum = {
      ...transaction,
      originMaximumContentY: (transaction?.originMaximumContentY ?? 0) + 0.001,
    };
    const forgedAnchor = {
      ...transaction,
      anchorWorkspacePosition:
        (transaction?.anchorWorkspacePosition ?? 0) + 0.0000005,
    };
    const hostile = Object.defineProperty({}, "originZoom", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(
      planOverviewSpatialZoomPreview({ scale: 1.2, transaction: forged }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomPreview({
        scale: 1.2,
        transaction: forgedMaximum,
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomPreview({
        scale: 1.2,
        transaction: forgedAnchor,
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomPreview({ scale: 1.2, transaction: hostile }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomPreview({ scale: 1.2, transaction: null }),
    ).toBeNull();
  });
});

describe("planOverviewSpatialZoomFinish", () => {
  it("commits the current preview and cancels to the exact origin", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const preview = planOverviewSpatialZoomPreview({
      scale: 1.5,
      transaction,
    });
    const commit = planOverviewSpatialZoomFinish({
      disposition: "commit",
      transaction: preview?.transaction,
    });
    const cancel = planOverviewSpatialZoomFinish({
      disposition: "cancel",
      transaction: preview?.transaction,
    });

    expect(commit).toEqual({
      contentY: preview?.contentY,
      maximumContentY: preview?.maximumContentY,
      zoom: preview?.zoom,
    });
    expect(cancel).toEqual({
      contentY: transaction?.originContentY,
      maximumContentY: transaction?.originMaximumContentY,
      zoom: transaction?.originZoom,
    });
    expect(cancel?.contentY).toBe(600);
    expect(cancel?.zoom).toBe(0.5);
    expect(Object.isFrozen(commit)).toBe(true);
    expect(Object.isFrozen(cancel)).toBe(true);
  });

  it("fails closed for malformed disposition or transaction state", () => {
    const transaction = planOverviewSpatialZoomBegin(baseBeginInput);
    const preview = planOverviewSpatialZoomPreview({
      scale: 1.2,
      transaction,
    });

    expect(
      planOverviewSpatialZoomFinish({
        disposition: "apply",
        transaction,
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomFinish({
        disposition: "commit",
        transaction: { ...transaction, previewMaximumContentY: 1 },
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomFinish({
        disposition: "cancel",
        transaction: {
          ...transaction,
          originMaximumContentY:
            (transaction?.originMaximumContentY ?? 0) + 0.001,
        },
      }),
    ).toBeNull();
    expect(
      planOverviewSpatialZoomFinish({
        disposition: "commit",
        transaction: {
          ...preview?.transaction,
          previewContentY: (preview?.contentY ?? 0) + 0.0005,
        },
      }),
    ).toBeNull();
  });

  it("fails closed for hostile finish accessors", () => {
    const hostile = Object.defineProperty({}, "disposition", {
      get(): never {
        throw new Error("unavailable");
      },
    });

    expect(planOverviewSpatialZoomFinish(hostile)).toBeNull();
  });
});
