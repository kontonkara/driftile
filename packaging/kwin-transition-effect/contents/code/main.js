// SPDX-FileCopyrightText: 2026 Nikita Konton
// SPDX-License-Identifier: GPL-3.0-or-later

"use strict";

const DEFAULT_DURATION = 180;
const MAXIMUM_DURATION = 1000;
const MAXIMUM_RETARGET_DURATION = 100;
const DEFAULT_RESIZE_ANIMATION_THRESHOLD = 10;
const MAXIMUM_RESIZE_ANIMATION_THRESHOLD = 64;
const MAXIMUM_EXCLUSION_COUNT = 128;
const MAXIMUM_EXCLUSION_BYTES = 255;
const MAXIMUM_EXCLUSION_CONFIG_BYTES = 33024;
const MANAGED_PROPERTY = "driftileTransitionsManaged";
const ANIMATION_PROPERTY = "driftileTransitionAnimation";
const DEFERRED_PROPERTY = "driftileDeferredTransition";
const POSITION_ANIMATION = "position";
const TRANSLATION_ANIMATION = "translation";
const SIZE_ANIMATION = "size";
const ANIMATION_TARGET_PROPERTIES = {
  [POSITION_ANIMATION]: "positionTarget",
  [TRANSLATION_ANIMATION]: "translationTarget",
  [SIZE_ANIMATION]: "sizeTarget",
};

class DriftileTransitionsEffect {
  constructor() {
    this.duration = 0;
    this.retargetDuration = 0;
    this.animatePosition = true;
    this.animateSize = true;
    this.easingCurve = QEasingCurve.OutCubic;
    this.resizeAnimationThreshold = DEFAULT_RESIZE_ANIMATION_THRESHOLD;
    this.windowClassExclusionsValid = true;
    this.windowClassExclusions = new Set();
    this.managedWindows = [];
    this.deferredWindows = new Set();

    effect.configChanged.connect(this.loadConfig.bind(this));
    effects.windowAdded.connect(this.manage.bind(this));
    effects.windowDeleted.connect(this.unmanage.bind(this));
    if (effects.hasActiveFullScreenEffectChanged) {
      effects.hasActiveFullScreenEffectChanged.connect(
        this.onFullScreenEffectChanged.bind(this),
      );
    }
    if (effects.desktopChanged) {
      effects.desktopChanged.connect(
        this.onVisibilityContextChanged.bind(this),
      );
    }
    if (effects.windowActivated) {
      effects.windowActivated.connect(this.onWindowActivated.bind(this));
    }
    if (effects.currentActivityChanged) {
      effects.currentActivityChanged.connect(
        this.onVisibilityContextChanged.bind(this),
      );
    }

    this.loadConfig();
    for (const window of effects.stackingOrder) {
      this.manage(window);
    }
  }

  loadConfig() {
    const configuredDuration = Number(
      effect.readConfig("Duration", DEFAULT_DURATION),
    );
    const baseDuration = isFinite(configuredDuration)
      ? Math.min(MAXIMUM_DURATION, Math.max(0, Math.round(configuredDuration)))
      : DEFAULT_DURATION;

    this.duration = animationTime(baseDuration);
    this.retargetDuration =
      baseDuration === 0
        ? 0
        : Math.min(
            this.duration,
            Math.round(
              (this.duration *
                Math.min(baseDuration, MAXIMUM_RETARGET_DURATION)) /
                baseDuration,
            ),
          );
    this.animatePosition = this.readBooleanConfig("AnimatePosition", true);
    this.animateSize = this.readBooleanConfig("AnimateSize", true);
    this.easingCurve = this.readEasingCurveConfig();
    this.resizeAnimationThreshold = this.readResizeAnimationThresholdConfig();
    const exclusionConfig = this.parseWindowClassExclusions(
      effect.readConfig("WindowClassExclusions", ""),
    );
    this.windowClassExclusionsValid = exclusionConfig.valid;
    this.windowClassExclusions = exclusionConfig.exclusions;
    for (const window of this.managedWindows) {
      this.clearWindowTransitions(window);
    }
  }

  manage(window) {
    if (!window || window[MANAGED_PROPERTY]) {
      return;
    }

    window[MANAGED_PROPERTY] = true;
    this.managedWindows.push(window);
    window.windowFrameGeometryChanged.connect(
      this.onWindowFrameGeometryChanged.bind(this),
    );
    if (window.windowHiddenChanged) {
      window.windowHiddenChanged.connect(
        this.onWindowVisibilityOpportunity.bind(this),
      );
    }
    if (window.windowDesktopsChanged) {
      window.windowDesktopsChanged.connect(
        this.onWindowVisibilityOpportunity.bind(this),
      );
    }
  }

  unmanage(window) {
    if (!window) {
      return;
    }

    this.clearWindowTransitions(window);
    delete window[MANAGED_PROPERTY];
    const index = this.managedWindows.indexOf(window);
    if (index >= 0) {
      this.managedWindows.splice(index, 1);
    }
  }

  onWindowFrameGeometryChanged(window, oldGeometry) {
    if (
      this.duration <= 0 ||
      !this.isDeferredTransitionEligible(window) ||
      !this.isValidGeometry(oldGeometry)
    ) {
      this.clearWindowTransitions(window);
      return;
    }

    const newGeometry = window.geometry;
    if (!this.isValidGeometry(newGeometry)) {
      this.clearWindowTransitions(window);
      return;
    }

    if (!this.geometryChanged(oldGeometry, newGeometry)) {
      return;
    }

    if (effects.hasActiveFullScreenEffect) {
      this.deferWindowTransition(window, oldGeometry);
      return;
    }

    if (window[DEFERRED_PROPERTY] !== undefined) {
      this.replayDeferredTransition(window);
      return;
    }

    if (!this.isEligible(window)) {
      this.clearWindowTransitions(window);
      return;
    }

    this.animateWindowTransition(window, oldGeometry, newGeometry);
  }

  onFullScreenEffectChanged() {
    if (effects.hasActiveFullScreenEffect) {
      for (const window of this.managedWindows) {
        this.cancelWindowAnimation(window);
      }
      return;
    }

    this.replayDeferredTransitions();
  }

  onVisibilityContextChanged() {
    this.replayDeferredTransitions();
  }

  onWindowActivated(window) {
    this.replayDeferredTransition(window);
    this.replayDeferredTransitions(window);
  }

  onWindowVisibilityOpportunity(window) {
    this.replayDeferredTransition(window);
  }

  deferWindowTransition(window, oldGeometry) {
    if (window[DEFERRED_PROPERTY] !== undefined) {
      this.deferredWindows.add(window);
      return;
    }

    this.cancelWindowAnimation(window);
    window[DEFERRED_PROPERTY] = this.copyGeometry(oldGeometry);
    this.deferredWindows.add(window);
  }

  replayDeferredTransitions(excludedWindow) {
    for (const window of this.deferredWindows) {
      if (window !== excludedWindow) {
        this.replayDeferredTransition(window);
      }
    }
  }

  replayDeferredTransition(window) {
    if (!window) {
      return;
    }

    const oldGeometry = window[DEFERRED_PROPERTY];
    if (oldGeometry === undefined) {
      this.deferredWindows.delete(window);
      return;
    }

    if (effects.hasActiveFullScreenEffect) {
      return;
    }

    const newGeometry = window.geometry;
    if (
      this.duration <= 0 ||
      !this.isDeferredTransitionEligible(window) ||
      !this.isValidGeometry(oldGeometry) ||
      !this.isValidGeometry(newGeometry)
    ) {
      this.clearWindowTransitions(window);
      return;
    }

    if (!this.isDeferredTransitionPresentable(window)) {
      return;
    }

    delete window[DEFERRED_PROPERTY];
    this.deferredWindows.delete(window);
    this.animateWindowTransition(window, oldGeometry, newGeometry);
  }

  isDeferredTransitionPresentable(window) {
    return (
      window.visible ||
      (effects.activeWindow === window &&
        window.onCurrentDesktop &&
        (effects.currentActivity.length === 0 ||
          window.isOnActivity(effects.currentActivity)))
    );
  }

  animateWindowTransition(window, oldGeometry, newGeometry) {
    if (!this.geometryChanged(oldGeometry, newGeometry)) {
      return;
    }

    const sizeGeometryChanged =
      oldGeometry.width !== newGeometry.width ||
      oldGeometry.height !== newGeometry.height;
    const resizeDelta = Math.max(
      Math.abs(oldGeometry.width - newGeometry.width),
      Math.abs(oldGeometry.height - newGeometry.height),
    );
    const sizeChanged =
      this.animateSize &&
      sizeGeometryChanged &&
      resizeDelta > this.resizeAnimationThreshold;
    const sizeInterpolationSuppressed =
      this.animateSize && sizeGeometryChanged && !sizeChanged;
    const oldPositionWidth = sizeChanged
      ? oldGeometry.width
      : newGeometry.width;
    const oldPositionHeight = sizeChanged
      ? oldGeometry.height
      : newGeometry.height;
    const oldPosition = {
      value1: oldGeometry.x + oldPositionWidth / 2,
      value2: oldGeometry.y + oldPositionHeight / 2,
    };
    const newPosition = {
      value1: newGeometry.x + newGeometry.width / 2,
      value2: newGeometry.y + newGeometry.height / 2,
    };
    const positionChanged =
      this.animatePosition &&
      (oldPosition.value1 !== newPosition.value1 ||
        oldPosition.value2 !== newPosition.value2);
    let state;
    if (
      sizeInterpolationSuppressed &&
      window[ANIMATION_PROPERTY] !== undefined
    ) {
      state = this.windowAnimationState(window);
      this.cancelSizeAnimation(state);
      window[ANIMATION_PROPERTY] = state;
    }

    if (!sizeChanged && !positionChanged) {
      return;
    }

    if (state === undefined) {
      state = this.windowAnimationState(window);
    }
    const animations = [];
    const animationProperties = [];
    const animationTargets = [];
    const newSize = {
      value1: newGeometry.width,
      value2: newGeometry.height,
    };

    if (
      sizeChanged &&
      !this.retargetAnimation(state, SIZE_ANIMATION, newSize)
    ) {
      animationProperties.push(SIZE_ANIMATION);
      animationTargets.push(newSize);
      animations.push({
        type: Effect.Size,
        from: {
          value1: oldGeometry.width,
          value2: oldGeometry.height,
        },
        to: newSize,
        curve: this.easingCurve,
      });
    }
    if (positionChanged) {
      const oldPositionComponents = this.positionComponents(oldPosition);
      const newPositionComponents = this.positionComponents(newPosition);
      const translationRequired =
        oldPositionComponents.translation.value1 !== 0 ||
        oldPositionComponents.translation.value2 !== 0 ||
        newPositionComponents.translation.value1 !== 0 ||
        newPositionComponents.translation.value2 !== 0;

      if (
        !this.retargetAnimation(
          state,
          POSITION_ANIMATION,
          newPositionComponents.absolute,
        )
      ) {
        animationProperties.push(POSITION_ANIMATION);
        animationTargets.push(newPositionComponents.absolute);
        animations.push({
          type: Effect.Position,
          from: oldPositionComponents.absolute,
          to: newPositionComponents.absolute,
          curve: this.easingCurve,
        });
      }
      if (
        (translationRequired || state[TRANSLATION_ANIMATION] !== undefined) &&
        !this.retargetAnimation(
          state,
          TRANSLATION_ANIMATION,
          newPositionComponents.translation,
        )
      ) {
        if (translationRequired) {
          animationProperties.push(TRANSLATION_ANIMATION);
          animationTargets.push(newPositionComponents.translation);
          animations.push({
            type: Effect.Translation,
            from: oldPositionComponents.translation,
            to: newPositionComponents.translation,
            curve: this.easingCurve,
          });
        }
      }
    }

    if (animations.length > 0) {
      const animationIds = animate({
        window,
        duration: this.duration,
        animations,
      });

      for (let index = 0; index < animationProperties.length; index += 1) {
        const property = animationProperties[index];
        const animationId = animationIds[index];
        state[property] = animationId;
        state[ANIMATION_TARGET_PROPERTIES[property]] = this.copyAnimationTarget(
          animationTargets[index],
        );
      }
    }

    window[ANIMATION_PROPERTY] = state;
  }

  isEligible(window) {
    return (
      this.isDeferredTransitionPresentable(window) &&
      this.isDeferredTransitionEligible(window)
    );
  }

  isDeferredTransitionEligible(window) {
    return (
      !window.deleted &&
      !window.minimized &&
      !window.fullScreen &&
      !window.hiddenByShowDesktop &&
      !window.specialWindow &&
      !window.popupWindow &&
      !window.appletPopup &&
      !window.onScreenDisplay &&
      !window.outline &&
      !window.lockScreen &&
      !window.internalWindow &&
      !window.skipSwitcher &&
      !window.modal &&
      window.transientFor() === null &&
      window.normalWindow &&
      window.managed &&
      window.moveable &&
      (window.hasDecoration || !window.keepAbove) &&
      !this.isConfiguredWindowExcluded(window) &&
      !window.move &&
      !window.resize
    );
  }

  readBooleanConfig(name, fallback) {
    const value = effect.readConfig(name, fallback);
    if (value === false || value === 0 || value === "false" || value === "0") {
      return false;
    }
    if (value === true || value === 1 || value === "true" || value === "1") {
      return true;
    }
    return fallback;
  }

  readEasingCurveConfig() {
    switch (effect.readConfig("EasingCurve", "out-cubic")) {
      case "linear":
        return QEasingCurve.Linear;
      case "out-quad":
        return QEasingCurve.OutQuad;
      case "out-cubic":
        return QEasingCurve.OutCubic;
      case "out-quart":
        return QEasingCurve.OutQuart;
      case "out-quint":
        return QEasingCurve.OutQuint;
      case "out-expo":
        return QEasingCurve.OutExpo;
      default:
        return QEasingCurve.OutCubic;
    }
  }

  readResizeAnimationThresholdConfig() {
    const configuredValue = effect.readConfig(
      "ResizeAnimationThreshold",
      DEFAULT_RESIZE_ANIMATION_THRESHOLD,
    );
    if (
      (typeof configuredValue !== "number" &&
        typeof configuredValue !== "string") ||
      (typeof configuredValue === "string" &&
        configuredValue.trim().length === 0)
    ) {
      return DEFAULT_RESIZE_ANIMATION_THRESHOLD;
    }

    const threshold = Number(configuredValue);
    return Number.isInteger(threshold) &&
      threshold >= 0 &&
      threshold <= MAXIMUM_RESIZE_ANIMATION_THRESHOLD
      ? threshold
      : DEFAULT_RESIZE_ANIMATION_THRESHOLD;
  }

  parseWindowClassExclusions(configuredValue) {
    const exclusions = new Set();
    if (typeof configuredValue !== "string") {
      return { valid: false, exclusions };
    }

    const totalBytes = this.utf8ByteLength(configuredValue);
    if (totalBytes < 0 || totalBytes > MAXIMUM_EXCLUSION_CONFIG_BYTES) {
      return { valid: false, exclusions };
    }

    const normalizedValue = configuredValue.replace(/\r\n/gu, "\n");
    if (
      normalizedValue.includes("\r") ||
      /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(normalizedValue)
    ) {
      return { valid: false, exclusions };
    }

    for (const configuredLine of normalizedValue.split("\n")) {
      const windowClass = configuredLine.trim();
      if (windowClass.length === 0) {
        continue;
      }
      if (exclusions.has(windowClass)) {
        return { valid: false, exclusions: new Set() };
      }

      const entryBytes = this.utf8ByteLength(windowClass);
      if (
        entryBytes <= 0 ||
        entryBytes > MAXIMUM_EXCLUSION_BYTES ||
        exclusions.size >= MAXIMUM_EXCLUSION_COUNT
      ) {
        return { valid: false, exclusions: new Set() };
      }
      exclusions.add(windowClass);
    }

    return { valid: true, exclusions };
  }

  utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit <= 0x7f) {
        bytes += 1;
      } else if (codeUnit <= 0x7ff) {
        bytes += 2;
      } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const nextCodeUnit = value.charCodeAt(index + 1);
        if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) {
          return -1;
        }
        bytes += 4;
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        return -1;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  isConfiguredWindowExcluded(window) {
    if (!this.windowClassExclusionsValid) {
      return true;
    }
    if (this.windowClassExclusions.size === 0) {
      return false;
    }

    const windowClass = window.windowClass;
    return (
      typeof windowClass === "string" &&
      this.windowClassExclusions.has(windowClass)
    );
  }

  geometryChanged(oldGeometry, newGeometry) {
    return (
      oldGeometry.x !== newGeometry.x ||
      oldGeometry.y !== newGeometry.y ||
      oldGeometry.width !== newGeometry.width ||
      oldGeometry.height !== newGeometry.height
    );
  }

  copyGeometry(geometry) {
    return {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    };
  }

  windowAnimationState(window) {
    const state = window[ANIMATION_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
      return state;
    }

    if (state !== undefined) {
      cancel(state);
    }
    return {};
  }

  retargetAnimation(state, property, target) {
    const animationId = state[property];
    if (animationId === undefined) {
      return false;
    }

    const targetProperty = ANIMATION_TARGET_PROPERTIES[property];
    if (this.animationTargetsEqual(state[targetProperty], target)) {
      return true;
    }

    if (retarget(animationId, target, this.retargetDuration)) {
      state[targetProperty] = this.copyAnimationTarget(target);
      return true;
    }

    delete state[property];
    delete state[targetProperty];
    return false;
  }

  animationTargetsEqual(first, second) {
    return (
      first !== undefined &&
      first.value1 === second.value1 &&
      first.value2 === second.value2
    );
  }

  copyAnimationTarget(target) {
    return {
      value1: target.value1,
      value2: target.value2,
    };
  }

  cancelPositionAnimations(state) {
    this.cancelAnimation(state, POSITION_ANIMATION);
    this.cancelAnimation(state, TRANSLATION_ANIMATION);
  }

  cancelAnimation(state, property) {
    if (state[property] !== undefined) {
      cancel(state[property]);
      delete state[property];
    }
    delete state[ANIMATION_TARGET_PROPERTIES[property]];
  }

  positionComponents(position) {
    const absolute = {
      value1: Math.max(0, position.value1),
      value2: Math.max(0, position.value2),
    };
    return {
      absolute,
      translation: {
        value1: position.value1 - absolute.value1,
        value2: position.value2 - absolute.value2,
      },
    };
  }

  isValidGeometry(geometry) {
    return (
      geometry &&
      isFinite(geometry.x) &&
      isFinite(geometry.y) &&
      isFinite(geometry.width) &&
      isFinite(geometry.height) &&
      geometry.width > 0 &&
      geometry.height > 0
    );
  }

  cancelWindowAnimation(window) {
    if (!window || window[ANIMATION_PROPERTY] === undefined) {
      return;
    }

    const state = window[ANIMATION_PROPERTY];
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      cancel(state);
      delete window[ANIMATION_PROPERTY];
      return;
    }

    this.cancelSizeAnimation(state);
    this.cancelPositionAnimations(state);
    delete window[ANIMATION_PROPERTY];
  }

  cancelSizeAnimation(state) {
    this.cancelAnimation(state, SIZE_ANIMATION);
  }

  clearWindowTransitions(window) {
    if (!window) {
      return;
    }

    this.cancelWindowAnimation(window);
    delete window[DEFERRED_PROPERTY];
    this.deferredWindows.delete(window);
  }
}

new DriftileTransitionsEffect();
