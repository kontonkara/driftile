import {
  LAYOUT_PERSISTENCE_CATALOG_VERSION,
  activeLayoutPersistenceState,
  decodeLayoutPersistenceCatalog,
  mergeLayoutPersistenceCatalog,
  selectLayoutPersistenceSnapshot,
  type LayoutPersistenceCatalogSnapshot,
  type LayoutPersistenceCatalogV2,
  type LayoutPersistenceTopologyV2,
} from "./core/layout-persistence-catalog";
import {
  LAYOUT_PERSISTENCE_FORMAT,
  LAYOUT_PERSISTENCE_VERSION,
  decodeLayoutPersistence,
  encodeLayoutPersistence,
} from "./core/layout-persistence";
import type { KWinOutput } from "./platform/kwin/api";
import { layoutPersistenceOutputDescriptor } from "./platform/kwin/persistence-descriptors";

export type RuntimeLayoutStateChanged = (canonicalState: string) => void;

export interface RuntimeLayoutPersistence {
  readonly initialState: string;
  readonly onStateChanged?: RuntimeLayoutStateChanged;
  stateForCurrentTopology(): string;
  snapshots(): readonly LayoutPersistenceCatalogSnapshot[];
}

interface RuntimeLayoutPersistenceWorkspace {
  readonly screens: readonly KWinOutput[];
}

const INVALID_CURRENT_CATALOG_POLICY_DOCUMENT = `${JSON.stringify({
  format: LAYOUT_PERSISTENCE_FORMAT,
  version: LAYOUT_PERSISTENCE_VERSION,
})}\n`;

export function createRuntimeLayoutPersistence(
  workspace: RuntimeLayoutPersistenceWorkspace,
  loadedDocument: string,
  sink: RuntimeLayoutStateChanged | undefined,
): RuntimeLayoutPersistence {
  const loaded = decodeLoadedDocument(loadedDocument);
  let catalog = loaded.catalog;

  const stateForCurrentTopology = (): string =>
    controllerStateForCurrentTopology(
      workspace,
      catalog,
      loaded.policyDocument,
    );

  return {
    initialState: stateForCurrentTopology(),
    ...(sink === undefined
      ? {}
      : {
          onStateChanged: (canonicalState: string): void => {
            const decoded = decodeLayoutPersistence(canonicalState);

            if (!decoded.ok) {
              throw new Error(
                `Cannot publish invalid layout state: ${decoded.error}`,
              );
            }

            const merged = mergeLayoutPersistenceCatalog(catalog, {
              state: decoded.value,
              topology: currentTopology(workspace),
            });

            if (!merged.ok) {
              throw new Error(`Cannot publish layout catalog: ${merged.error}`);
            }

            sink(merged.document);
            catalog = merged.value;
          },
        }),
    stateForCurrentTopology,
    snapshots: () => catalog?.snapshots ?? [],
  };
}

function decodeLoadedDocument(document: string): {
  readonly catalog: LayoutPersistenceCatalogV2 | null;
  readonly policyDocument: string;
} {
  if (document.length === 0) {
    return { catalog: null, policyDocument: "" };
  }

  const decoded = decodeLayoutPersistenceCatalog(document);

  if (!decoded.ok) {
    return {
      catalog: null,
      policyDocument: malformedCurrentCatalog(document, decoded.error)
        ? INVALID_CURRENT_CATALOG_POLICY_DOCUMENT
        : document,
    };
  }

  return { catalog: decoded.value, policyDocument: "" };
}

function controllerStateForCurrentTopology(
  workspace: RuntimeLayoutPersistenceWorkspace,
  catalog: LayoutPersistenceCatalogV2 | null,
  policyDocument: string,
): string {
  if (catalog === null) {
    return policyDocument;
  }

  const active = catalog.snapshots[0];

  if (active?.topology === null) {
    return encodeLayoutPersistence(activeLayoutPersistenceState(catalog));
  }

  let selected;

  try {
    selected = selectLayoutPersistenceSnapshot(
      catalog,
      currentTopology(workspace),
    );
  } catch {
    selected = null;
  }

  return selected === null ? "" : encodeLayoutPersistence(selected.state);
}

function malformedCurrentCatalog(
  document: string,
  error:
    | "document-too-large"
    | "invalid-json"
    | "invalid-state"
    | "unsupported-version",
): boolean {
  if (error !== "invalid-state") {
    return false;
  }

  try {
    const value = JSON.parse(document) as unknown;

    return (
      isRecord(value) &&
      value["format"] === LAYOUT_PERSISTENCE_FORMAT &&
      value["version"] === LAYOUT_PERSISTENCE_CATALOG_VERSION
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function currentTopology(
  workspace: RuntimeLayoutPersistenceWorkspace,
): LayoutPersistenceTopologyV2 {
  return {
    outputs: workspace.screens.map((output) => {
      const descriptor = layoutPersistenceOutputDescriptor(output);

      return { key: descriptor.name, ...descriptor };
    }),
  };
}
