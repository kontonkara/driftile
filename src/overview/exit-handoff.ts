import { LAYOUT_PERSISTENCE_LIMITS } from "../core/layout-persistence";

export type OverviewExitHandoffTargetKind = "desktop-fallback" | "window";
export type OverviewExitHandoffDesktopRelation =
  "cross-desktop" | "same-desktop";
export type OverviewExitHandoffPhase =
  "canceled" | "captured" | "fallback" | "promoted";
export type OverviewExitHandoffDisposition =
  "cancel" | "fallback" | "none" | "promote";
export type OverviewExitHandoffResolutionReason =
  | "desktop-fallback"
  | "interrupted"
  | "minimized"
  | "reopened"
  | "stale"
  | "topology";

export interface OverviewExitHandoffRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface OverviewExitHandoffCamera {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoom: number;
}

export interface OverviewExitHandoffCaptureInput {
  readonly camera: OverviewExitHandoffCamera;
  readonly generation: number;
  readonly sessionId: number;
  readonly sourceDesktopId: string;
  readonly sourceOutputId: string;
  readonly sourceRect: OverviewExitHandoffRect;
  readonly targetDesktopId: string;
  readonly targetFrame: OverviewExitHandoffRect;
  readonly targetKind: OverviewExitHandoffTargetKind;
  readonly targetMinimized: boolean;
  readonly targetOutputId: string;
  readonly targetWindowId: string | null;
  readonly token: number;
}

export interface OverviewExitHandoffCapture extends OverviewExitHandoffCaptureInput {
  readonly desktopRelation: OverviewExitHandoffDesktopRelation;
}

export interface OverviewExitHandoffState {
  readonly capture: OverviewExitHandoffCapture;
  readonly phase: OverviewExitHandoffPhase;
}

interface OverviewExitHandoffOwnedEvent {
  readonly generation: number;
  readonly sessionId: number;
  readonly token: number;
}

export interface OverviewExitHandoffSettleEvent extends OverviewExitHandoffOwnedEvent {
  readonly targetDesktopId: string;
  readonly targetFrame: OverviewExitHandoffRect;
  readonly targetMinimized: boolean;
  readonly targetOutputId: string;
  readonly targetWindowId: string | null;
  readonly topologyGeneration: number;
  readonly type: "settle";
}

export interface OverviewExitHandoffInvalidateEvent extends OverviewExitHandoffOwnedEvent {
  readonly reason: "stale" | "topology";
  readonly type: "invalidate";
}

export interface OverviewExitHandoffInterruptEvent extends OverviewExitHandoffOwnedEvent {
  readonly type: "interrupt";
}

export interface OverviewExitHandoffReopenEvent extends OverviewExitHandoffOwnedEvent {
  readonly type: "reopen";
}

export type OverviewExitHandoffEvent =
  | OverviewExitHandoffInterruptEvent
  | OverviewExitHandoffInvalidateEvent
  | OverviewExitHandoffReopenEvent
  | OverviewExitHandoffSettleEvent;

export interface OverviewExitHandoffTransitionInput {
  readonly event: OverviewExitHandoffEvent;
  readonly state: OverviewExitHandoffState;
}

export interface OverviewExitHandoffTransitionPlan {
  readonly disposition: OverviewExitHandoffDisposition;
  readonly promotion: OverviewExitHandoffCapture | null;
  readonly reason: OverviewExitHandoffResolutionReason | null;
  readonly state: OverviewExitHandoffState;
}

const MAXIMUM_HANDOFF_COUNTER = 2_147_483_647;

export function captureOverviewExitHandoff(
  input: unknown,
): OverviewExitHandoffState | null {
  try {
    const capture = readCapture(input);
    return capture === null ? null : freezeState(capture, "captured");
  } catch {
    return null;
  }
}

export function planOverviewExitHandoffTransition(
  input: unknown,
): OverviewExitHandoffTransitionPlan | null {
  try {
    if (!isRecord(input)) {
      return null;
    }

    const state = readState(input["state"]);
    if (state === null) {
      return null;
    }

    if (state.phase === "canceled") {
      return freezeTransition("none", state, null, null);
    }

    const event = readEvent(input["event"]);
    if (event === null) {
      return null;
    }

    if (event.type === "interrupt" || event.type === "reopen") {
      return cancelTransition(
        state,
        event.type === "interrupt" ? "interrupted" : "reopened",
      );
    }

    if (event.type === "invalidate") {
      if (!eventOwnsCapture(event, state.capture)) {
        return fallbackTransition(state, "stale");
      }
      return fallbackTransition(state, event.reason);
    }

    if (state.phase !== "captured") {
      return freezeTransition("none", state, null, null);
    }

    return settleTransition(state, event);
  } catch {
    return null;
  }
}

function settleTransition(
  state: OverviewExitHandoffState,
  event: OverviewExitHandoffSettleEvent,
): OverviewExitHandoffTransitionPlan {
  const capture = state.capture;

  if (!eventOwnsCapture(event, capture)) {
    return fallbackTransition(state, "stale");
  }
  if (event.topologyGeneration !== capture.generation) {
    return fallbackTransition(state, "topology");
  }
  if (event.targetMinimized) {
    return fallbackTransition(state, "minimized");
  }
  if (capture.targetKind === "desktop-fallback") {
    return fallbackTransition(state, "desktop-fallback");
  }
  if (
    event.targetOutputId !== capture.targetOutputId ||
    event.targetDesktopId !== capture.targetDesktopId ||
    event.targetWindowId !== capture.targetWindowId
  ) {
    return fallbackTransition(state, "stale");
  }

  const promotion = Object.freeze({
    ...capture,
    targetFrame: event.targetFrame,
    targetMinimized: false,
  });
  const promotedState = freezeState(promotion, "promoted");
  return freezeTransition("promote", promotedState, null, promotion);
}

function cancelTransition(
  state: OverviewExitHandoffState,
  reason: "interrupted" | "reopened",
): OverviewExitHandoffTransitionPlan {
  if (state.phase === "canceled") {
    return freezeTransition("none", state, null, null);
  }

  return freezeTransition(
    "cancel",
    freezeState(state.capture, "canceled"),
    reason,
    null,
  );
}

function fallbackTransition(
  state: OverviewExitHandoffState,
  reason: Exclude<
    OverviewExitHandoffResolutionReason,
    "interrupted" | "reopened"
  >,
): OverviewExitHandoffTransitionPlan {
  if (state.phase === "fallback") {
    return freezeTransition("none", state, null, null);
  }

  return freezeTransition(
    "fallback",
    freezeState(state.capture, "fallback"),
    reason,
    null,
  );
}

function readState(value: unknown): OverviewExitHandoffState | null {
  if (!isRecord(value)) {
    return null;
  }

  const capture = readCapture(value["capture"]);
  const phase = value["phase"];
  if (capture === null || !isPhase(phase)) {
    return null;
  }

  return freezeState(capture, phase);
}

function readCapture(value: unknown): OverviewExitHandoffCapture | null {
  if (!isRecord(value)) {
    return null;
  }

  const camera = readCamera(value["camera"]);
  const generation = value["generation"];
  const sessionId = value["sessionId"];
  const sourceDesktopId = value["sourceDesktopId"];
  const sourceOutputId = value["sourceOutputId"];
  const sourceRect = readRect(value["sourceRect"]);
  const targetDesktopId = value["targetDesktopId"];
  const targetFrame = readRect(value["targetFrame"]);
  const targetKind = value["targetKind"];
  const targetMinimized = value["targetMinimized"];
  const targetOutputId = value["targetOutputId"];
  const targetWindowId = value["targetWindowId"];
  const token = value["token"];

  if (
    camera === null ||
    !isPositiveGeneration(generation) ||
    !isPositiveGeneration(sessionId) ||
    !isIdentifier(sourceDesktopId) ||
    !isIdentifier(sourceOutputId) ||
    sourceRect === null ||
    !isIdentifier(targetDesktopId) ||
    targetFrame === null ||
    !isTargetKind(targetKind) ||
    typeof targetMinimized !== "boolean" ||
    !isIdentifier(targetOutputId) ||
    !isNullableIdentifier(targetWindowId) ||
    !isPositiveGeneration(token) ||
    (targetKind === "window" && targetWindowId === null) ||
    (targetMinimized && targetWindowId === null)
  ) {
    return null;
  }

  const desktopRelation =
    sourceDesktopId === targetDesktopId ? "same-desktop" : "cross-desktop";

  return Object.freeze({
    camera,
    desktopRelation,
    generation,
    sessionId,
    sourceDesktopId,
    sourceOutputId,
    sourceRect,
    targetDesktopId,
    targetFrame,
    targetKind,
    targetMinimized,
    targetOutputId,
    targetWindowId,
    token,
  });
}

function readEvent(value: unknown): OverviewExitHandoffEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const generation = value["generation"];
  const sessionId = value["sessionId"];
  const token = value["token"];
  const type = value["type"];

  if (
    !isPositiveGeneration(generation) ||
    !isPositiveGeneration(sessionId) ||
    !isPositiveGeneration(token)
  ) {
    return null;
  }

  if (type === "interrupt" || type === "reopen") {
    return Object.freeze({ generation, sessionId, token, type });
  }

  if (type === "invalidate") {
    const reason = value["reason"];
    if (reason !== "stale" && reason !== "topology") {
      return null;
    }
    return Object.freeze({ generation, reason, sessionId, token, type });
  }

  if (type !== "settle") {
    return null;
  }

  const targetDesktopId = value["targetDesktopId"];
  const targetFrame = readRect(value["targetFrame"]);
  const targetMinimized = value["targetMinimized"];
  const targetOutputId = value["targetOutputId"];
  const targetWindowId = value["targetWindowId"];
  const topologyGeneration = value["topologyGeneration"];

  if (
    !isIdentifier(targetDesktopId) ||
    targetFrame === null ||
    typeof targetMinimized !== "boolean" ||
    !isIdentifier(targetOutputId) ||
    !isNullableIdentifier(targetWindowId) ||
    !isPositiveGeneration(topologyGeneration)
  ) {
    return null;
  }

  return Object.freeze({
    generation,
    sessionId,
    targetDesktopId,
    targetFrame,
    targetMinimized,
    targetOutputId,
    targetWindowId,
    token,
    topologyGeneration,
    type,
  });
}

function readRect(value: unknown): OverviewExitHandoffRect | null {
  if (!isRecord(value)) {
    return null;
  }

  const height = value["height"];
  const width = value["width"];
  const x = value["x"];
  const y = value["y"];

  if (
    !isPositiveGeometryNumber(height) ||
    !isPositiveGeometryNumber(width) ||
    !isGeometryNumber(x) ||
    !isGeometryNumber(y)
  ) {
    return null;
  }

  return Object.freeze({
    height: normalizeZero(height),
    width: normalizeZero(width),
    x: normalizeZero(x),
    y: normalizeZero(y),
  });
}

function readCamera(value: unknown): OverviewExitHandoffCamera | null {
  if (!isRecord(value)) {
    return null;
  }

  const offsetX = value["offsetX"];
  const offsetY = value["offsetY"];
  const zoom = value["zoom"];

  if (
    !isGeometryNumber(offsetX) ||
    !isGeometryNumber(offsetY) ||
    !isPositiveGeometryNumber(zoom)
  ) {
    return null;
  }

  return Object.freeze({
    offsetX: normalizeZero(offsetX),
    offsetY: normalizeZero(offsetY),
    zoom: normalizeZero(zoom),
  });
}

function eventOwnsCapture(
  event: OverviewExitHandoffOwnedEvent,
  capture: OverviewExitHandoffCapture,
): boolean {
  return (
    event.sessionId === capture.sessionId &&
    event.generation === capture.generation &&
    event.token === capture.token
  );
}

function freezeState(
  capture: OverviewExitHandoffCapture,
  phase: OverviewExitHandoffPhase,
): OverviewExitHandoffState {
  return Object.freeze({ capture, phase });
}

function freezeTransition(
  disposition: OverviewExitHandoffDisposition,
  state: OverviewExitHandoffState,
  reason: OverviewExitHandoffResolutionReason | null,
  promotion: OverviewExitHandoffCapture | null,
): OverviewExitHandoffTransitionPlan {
  return Object.freeze({ disposition, promotion, reason, state });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > LAYOUT_PERSISTENCE_LIMITS.identifierCharacters
  ) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return false;
    }
  }

  return true;
}

function isNullableIdentifier(value: unknown): value is string | null {
  return value === null || isIdentifier(value);
}

function isPositiveGeneration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAXIMUM_HANDOFF_COUNTER
  );
}

function isGeometryNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= LAYOUT_PERSISTENCE_LIMITS.numericMagnitude
  );
}

function isPositiveGeometryNumber(value: unknown): value is number {
  return isGeometryNumber(value) && value > 0;
}

function isTargetKind(value: unknown): value is OverviewExitHandoffTargetKind {
  return value === "desktop-fallback" || value === "window";
}

function isPhase(value: unknown): value is OverviewExitHandoffPhase {
  return (
    value === "canceled" ||
    value === "captured" ||
    value === "fallback" ||
    value === "promoted"
  );
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
