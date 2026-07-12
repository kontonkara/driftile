import type {
  LayoutPersistenceCaptureOutput,
  LayoutPersistenceCaptureWindow,
} from "../../core/layout-persistence-capture";
import { LAYOUT_PERSISTENCE_LIMITS } from "../../core/layout-persistence";
import type { KWinOutput, KWinWindow } from "./api";

export function layoutPersistenceOutputDescriptor(
  output: KWinOutput,
): LayoutPersistenceCaptureOutput {
  const manufacturer = optionalPersistenceIdentifier(output.manufacturer);
  const model = optionalPersistenceIdentifier(output.model);
  const serialNumber = optionalPersistenceIdentifier(output.serialNumber);

  return {
    ...(manufacturer === undefined ? {} : { manufacturer }),
    ...(model === undefined ? {} : { model }),
    name: output.name,
    ...(serialNumber === undefined ? {} : { serialNumber }),
  };
}

export function layoutPersistenceWindowDescriptor(
  liveId: string,
  source: KWinWindow | undefined,
): LayoutPersistenceCaptureWindow {
  if (!source) {
    return { liveId };
  }

  const desktopFileName = optionalPersistenceIdentifier(source.desktopFileName);
  const resourceClass = optionalPersistenceIdentifier(source.resourceClass);
  const resourceName = optionalPersistenceIdentifier(source.resourceName);
  const tag = optionalPersistenceIdentifier(source.tag);
  const windowRole = optionalPersistenceIdentifier(source.windowRole);

  if (
    desktopFileName === undefined &&
    resourceClass === undefined &&
    resourceName === undefined &&
    tag === undefined &&
    windowRole === undefined
  ) {
    return { liveId };
  }

  return {
    liveId,
    sessionMatch: {
      ...(desktopFileName === undefined ? {} : { desktopFileName }),
      ...(resourceClass === undefined ? {} : { resourceClass }),
      ...(resourceName === undefined ? {} : { resourceName }),
      ...(tag === undefined ? {} : { tag }),
      ...(windowRole === undefined ? {} : { windowRole }),
    },
  };
}

function optionalPersistenceIdentifier(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  ) {
    return undefined;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 31 || code === 127) {
      return undefined;
    }
  }

  return value;
}
