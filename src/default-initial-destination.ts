import {
  APPLICATION_INITIAL_DESTINATION_LIMITS,
  decodeInitialDestinationValue,
  encodeInitialDestinationValue,
  type ApplicationInitialDestination,
} from "./application-initial-destinations";

export const DEFAULT_INITIAL_DESTINATION_LIMITS = Object.freeze({
  encodedCharacters: APPLICATION_INITIAL_DESTINATION_LIMITS.rawEntryCharacters,
});

export interface DecodedDefaultInitialDestination {
  readonly canonicalValue: string;
  readonly initialDestination: ApplicationInitialDestination | null;
}

export const DISABLED_DEFAULT_INITIAL_DESTINATION = Object.freeze({
  canonicalValue: "",
  initialDestination: null,
}) satisfies DecodedDefaultInitialDestination;

export function decodeDefaultInitialDestination(
  value: unknown,
): DecodedDefaultInitialDestination | null {
  if (
    typeof value !== "string" ||
    value.length > DEFAULT_INITIAL_DESTINATION_LIMITS.encodedCharacters ||
    /[\r\n]/u.test(value)
  ) {
    return null;
  }

  const encoded = value.trim();

  if (encoded.length === 0) {
    return DISABLED_DEFAULT_INITIAL_DESTINATION;
  }

  const initialDestination = decodeInitialDestinationValue(encoded);

  return initialDestination
    ? Object.freeze({
        canonicalValue: encodeInitialDestinationValue(initialDestination),
        initialDestination,
      })
    : null;
}

export function sameDefaultInitialDestinations(
  left: ApplicationInitialDestination | null,
  right: ApplicationInitialDestination | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.desktop === right.desktop &&
      left.desktopName === right.desktopName &&
      left.output === right.output)
  );
}
