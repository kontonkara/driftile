import { describe, expect, it } from "vitest";

import {
  APPLICATION_INITIAL_DESTINATION_LIMITS,
  decodeInitialDestinationValue,
  encodeInitialDestinationValue,
} from "../src/application-initial-destinations";
import {
  decodeDefaultInitialDestination,
  DEFAULT_INITIAL_DESTINATION_LIMITS,
  DISABLED_DEFAULT_INITIAL_DESTINATION,
  sameDefaultInitialDestinations,
} from "../src/default-initial-destination";

describe("default initial-destination codec", () => {
  it.each([
    ["desktop:2", "desktop:2", { desktop: 2 }],
    ["desktop-name:Work", "desktop-name:Work", { desktopName: "Work" }],
    ["output:DP-1", "output:DP-1", { output: "DP-1" }],
    [
      " output:DP-1,desktop:2 ",
      "desktop:2,output:DP-1",
      { desktop: 2, output: "DP-1" },
    ],
    [
      "output:HDMI-A-1,desktop-name:Web Browsing",
      "desktop-name:Web Browsing,output:HDMI-A-1",
      { desktopName: "Web Browsing", output: "HDMI-A-1" },
    ],
  ])(
    "normalizes %j into immutable canonical state",
    (input, canonicalValue, initialDestination) => {
      const decoded = decodeDefaultInitialDestination(input);

      expect(decoded).toEqual({ canonicalValue, initialDestination });
      expect(Object.isFrozen(decoded)).toBe(true);
      expect(Object.isFrozen(decoded?.initialDestination)).toBe(true);
    },
  );

  it("uses one immutable disabled value for blank input", () => {
    expect(decodeDefaultInitialDestination("")).toBe(
      DISABLED_DEFAULT_INITIAL_DESTINATION,
    );
    expect(decodeDefaultInitialDestination(" \t ")).toBe(
      DISABLED_DEFAULT_INITIAL_DESTINATION,
    );
    expect(DISABLED_DEFAULT_INITIAL_DESTINATION).toEqual({
      canonicalValue: "",
      initialDestination: null,
    });
    expect(Object.isFrozen(DISABLED_DEFAULT_INITIAL_DESTINATION)).toBe(true);
  });

  it("shares the application destination value codec", () => {
    const destination = decodeInitialDestinationValue("output:DP-1,desktop:4");

    expect(destination).toEqual({ desktop: 4, output: "DP-1" });
    expect(destination && encodeInitialDestinationValue(destination)).toBe(
      "desktop:4,output:DP-1",
    );
  });

  it("compares destination semantics", () => {
    const first = decoded("desktop:2,output:DP-1");
    const equivalent = decoded("output:DP-1,desktop:2");
    const changedDesktop = decoded("desktop:3,output:DP-1");
    const changedOutput = decoded("desktop:2,output:DP-2");

    expect(sameDefaultInitialDestinations(first, first)).toBe(true);
    expect(sameDefaultInitialDestinations(first, equivalent)).toBe(true);
    expect(sameDefaultInitialDestinations(first, changedDesktop)).toBe(false);
    expect(sameDefaultInitialDestinations(first, changedOutput)).toBe(false);
    expect(sameDefaultInitialDestinations(first, null)).toBe(false);
    expect(sameDefaultInitialDestinations(null, null)).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    [],
    2,
    "desktop:0",
    "desktop:26",
    "desktop:+2",
    "desktop:02",
    "desktop:2.0",
    "desktop:2e0",
    "desktop: 2",
    "desktop:2, output:DP-1",
    "desktop:2,desktop:3",
    "desktop:2,desktop-name:Work",
    "desktop-name:Work,desktop:2",
    "desktop-name:Work,desktop-name:Review",
    "desktop-name:",
    "desktop-name: Work",
    "desktop-name:Work,Review",
    "output:",
    "output: DP-1",
    "output:DP-1,output:DP-2",
    "output:DP-1,extra",
    "desktop:2,output:DP-1,",
    "desktop:2=output:DP-1",
    "workspace:2",
    "desktop-name:bad\u0000name",
    "desktop-name:bad\u0080name",
    "desktop-name:bad\ud800name",
    "output:bad\u001fname",
    "output:bad\u0080name",
    "output:bad\udc00name",
    "desktop:2\n",
    "desktop:2\r",
    "desktop:2\r\noutput:DP-1",
  ])("rejects malformed input atomically: %j", (value) => {
    expect(decodeDefaultInitialDestination(value)).toBeNull();
  });

  it("enforces encoded, desktop-name, output, and UTF-8 bounds", () => {
    const maximumDesktopName = "d".repeat(
      APPLICATION_INITIAL_DESTINATION_LIMITS.desktopNameBytes,
    );
    const maximumUtf8DesktopName = `${"é".repeat(127)}a`;
    const maximumOutput = "o".repeat(
      APPLICATION_INITIAL_DESTINATION_LIMITS.outputNameBytes,
    );
    const maximumUtf8Output = `${"é".repeat(127)}a`;
    const maximumEncoded = `desktop-name:${maximumDesktopName},output:${"o".repeat(236)}`;
    const overlongEncoded = `${maximumEncoded}o`;

    expect(decoded(`desktop-name:${maximumDesktopName}`)).toEqual({
      desktopName: maximumDesktopName,
    });
    expect(
      decodeDefaultInitialDestination(`desktop-name:${maximumDesktopName}d`),
    ).toBeNull();
    expect(decoded(`desktop-name:${maximumUtf8DesktopName}`)).toEqual({
      desktopName: maximumUtf8DesktopName,
    });
    expect(
      decodeDefaultInitialDestination(
        `desktop-name:${maximumUtf8DesktopName}é`,
      ),
    ).toBeNull();
    expect(decoded(`output:${maximumOutput}`)).toEqual({
      output: maximumOutput,
    });
    expect(
      decodeDefaultInitialDestination(`output:${maximumOutput}o`),
    ).toBeNull();
    expect(decoded(`output:${maximumUtf8Output}`)).toEqual({
      output: maximumUtf8Output,
    });
    expect(
      decodeDefaultInitialDestination(`output:${maximumUtf8Output}é`),
    ).toBeNull();
    expect(maximumEncoded).toHaveLength(
      DEFAULT_INITIAL_DESTINATION_LIMITS.encodedCharacters,
    );
    expect(decodeDefaultInitialDestination(maximumEncoded)).not.toBeNull();
    expect(overlongEncoded).toHaveLength(
      DEFAULT_INITIAL_DESTINATION_LIMITS.encodedCharacters + 1,
    );
    expect(decodeDefaultInitialDestination(overlongEncoded)).toBeNull();
  });
});

function decoded(value: string) {
  const result = decodeDefaultInitialDestination(value);

  if (!result?.initialDestination) {
    throw new Error("default initial-destination fixture is invalid");
  }

  return result.initialDestination;
}
