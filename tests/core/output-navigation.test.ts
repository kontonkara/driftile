import { describe, expect, it } from "vitest";
import { outputId } from "../../src/core/ids";
import {
  findAdjacentOutput,
  findSequentialOutput,
  type OutputDirection,
  type OutputGeometry,
  type SequentialOutputDirection,
} from "../../src/core/output-navigation";

const sourceId = outputId("source");

describe("findAdjacentOutput", () => {
  it.each<{
    readonly direction: OutputDirection;
    readonly expected: string;
  }>([
    { direction: "left", expected: "left-near" },
    { direction: "right", expected: "right-near" },
    { direction: "up", expected: "up-near" },
    { direction: "down", expected: "down-near" },
  ])("selects the nearest aligned output to the $direction", (testCase) => {
    const outputs = [
      output("source", 0, 0),
      output("left-far", -220, 0),
      output("left-near", -110, 0),
      output("right-near", 110, 0),
      output("right-far", 220, 0),
      output("up-near", 0, -110),
      output("up-far", 0, -220),
      output("down-near", 0, 110),
      output("down-far", 0, 220),
    ];

    expect(findAdjacentOutput(sourceId, outputs, testCase.direction)).toBe(
      testCase.expected,
    );
  });

  it("does not wrap when no output lies in the requested half-plane", () => {
    const outputs = [
      output("source", 0, 0),
      output("right", 100, 0),
      output("down", 0, 100),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "left")).toBeNull();
    expect(findAdjacentOutput(sourceId, outputs, "up")).toBeNull();
  });

  it("returns null when the source is absent", () => {
    expect(
      findAdjacentOutput(sourceId, [output("other", 100, 0)], "right"),
    ).toBeNull();
  });

  it("prefers perpendicular span overlap before distance", () => {
    const outputs = [
      output("source", 0, 0),
      output("close-diagonal", 101, 101),
      output("far-aligned", 500, 50),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("far-aligned");
  });

  it("uses primary edge gap before perpendicular distance", () => {
    const outputs = [
      output("source", 0, 0),
      output("close-edge", 110, 49),
      output("centered", 120, 0),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("close-edge");
  });

  it("uses perpendicular center distance when edge gaps match", () => {
    const outputs = [
      output("source", 0, 0),
      output("offset", 110, 20),
      output("centered", 110, 0),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("centered");
  });

  it("uses center distance when earlier scores match", () => {
    const outputs = [
      output("source", 0, 0),
      output("wide", 110, 0, 200),
      output("narrow", 110, 0, 50),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("narrow");
  });

  it("uses a stable id tie-break independent of input order", () => {
    const first = output("DP-2", 110, 0);
    const second = output("DP-1", 110, 0);
    const source = output("source", 0, 0);

    expect(findAdjacentOutput(sourceId, [source, first, second], "right")).toBe(
      "DP-1",
    );
    expect(findAdjacentOutput(sourceId, [source, second, first], "right")).toBe(
      "DP-1",
    );
  });

  it("orders diagonal candidates by the same directional distances", () => {
    const outputs = [
      output("source", 0, 0),
      output("near-primary", 110, 500),
      output("near-perpendicular", 120, 101),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("near-primary");
  });

  it("uses strict output-center half-planes", () => {
    const outputs = [
      output("source", 0, 0),
      output("same-center", -50, 0, 200),
      output("right", 160, 0),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("right");
  });

  it("handles negative and fractional logical coordinates", () => {
    const outputs = [
      output("source", -1279.5, -719.5, 1279.5, 719.5),
      output("left", -2559, -719.5, 1279.5, 719.5),
      output("right", 0, -719.5, 1279.5, 719.5),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "left")).toBe("left");
    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("right");
  });

  it("treats corner contact as diagonal rather than span overlap", () => {
    const outputs = [
      output("source", 0, 0),
      output("touching-corner", 101, 100),
      output("overlapping-span", 500, 99),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe(
      "overlapping-span",
    );
  });

  it("clamps overlapping primary edges to zero distance", () => {
    const outputs = [
      output("source", 0, 0),
      output("closer-center", 40, 0, 100),
      output("farther-center", 60, 0, 100),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe(
      "closer-center",
    );
  });

  it("ignores unusable candidate rectangles", () => {
    const outputs = [
      output("source", 0, 0),
      output("zero-width", 100, 0, 0),
      output("not-finite", Number.POSITIVE_INFINITY, 0),
      output("valid", 200, 0),
    ];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBe("valid");
  });

  it("fails closed for an unusable source rectangle", () => {
    const outputs = [output("source", 0, 0, -100), output("right", 100, 0)];

    expect(findAdjacentOutput(sourceId, outputs, "right")).toBeNull();
  });
});

describe("findSequentialOutput", () => {
  const mixed = [
    output("top", 300, -200),
    output("left", -180, 0, 200, 180),
    output("source", 40, 40, 160, 100),
    output("right", 240, 20, 120, 140),
    output("bottom", -100, 260),
  ];

  it.each<{
    readonly direction: SequentialOutputDirection;
    readonly expected: string;
    readonly source: string;
  }>([
    { direction: "next", expected: "right", source: "source" },
    { direction: "previous", expected: "left", source: "source" },
    { direction: "previous", expected: "bottom", source: "top" },
    { direction: "next", expected: "top", source: "bottom" },
  ])("selects $direction from $source with wrap", (testCase) => {
    expect(
      findSequentialOutput(
        outputId(testCase.source),
        mixed,
        testCase.direction,
      ),
    ).toBe(testCase.expected);
  });

  it("ignores invalid candidates and fails closed without another output", () => {
    const invalid = [
      output("source", 0, 0),
      output("zero-height", 100, 0, 100, 0),
      output("not-finite", 200, Number.NaN),
    ];

    expect(findSequentialOutput(sourceId, invalid, "next")).toBeNull();
    expect(
      findSequentialOutput(
        sourceId,
        [output("source", 0, 0, -100), output("other", 100, 0)],
        "next",
      ),
    ).toBeNull();
    expect(
      findSequentialOutput(sourceId, [output("other", 100, 0)], "next"),
    ).toBeNull();
  });

  it("is stable for equivalent geometry and input order", () => {
    const source = output("source", 0, 0);
    const first = output("DP-1", 120, 0);
    const second = output("DP-2", 120, 0);

    expect(
      findSequentialOutput(sourceId, [source, second, first], "next"),
    ).toBe("DP-1");
    expect(
      findSequentialOutput(sourceId, [first, source, second], "next"),
    ).toBe("DP-1");
  });
});

function output(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
): OutputGeometry {
  return {
    id: outputId(id),
    rect: { height, width, x, y },
  };
}
