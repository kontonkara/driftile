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
const SHELL_WINDOW_CLASSES = new Set(["krunner", "org.kde.krunner"]);
const MANAGED_PROPERTY = "driftileTransitionsManaged";
const ANIMATION_PROPERTY = "driftileTransitionAnimation";
const DEFERRED_PROPERTY = "driftileDeferredTransition";
const ACTIVE_ANIMATION_COUNT = "activeAnimationCount";
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
    this.windowClassClassificationGeneration = 0;
    this.windowClassClassifications = new Map();
    this.managedWindows = [];
    this.activeAnimationWindows = new Set();
    this.deferredWindows = new Set();
    this.visibilityLeasedWindows = new Set();
    this.continuityLeasedWindows = new Set();
    this.fullScreenEffectActive = effects.hasActiveFullScreenEffect;
    this.visibilityHandoffPending = false;

    effect.configChanged.connect(this.loadConfig.bind(this));
    if (effect.animationEnded) {
      effect.animationEnded.connect(this.onAnimationEnded.bind(this));
    }
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
    this.visibilityHandoffPending = false;
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
    this.windowClassClassificationGeneration += 1;
    this.windowClassClassifications.clear();
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
    this.windowClassClassifications.delete(window);
    delete window[MANAGED_PROPERTY];
    const index = this.managedWindows.indexOf(window);
    if (index >= 0) {
      this.managedWindows.splice(index, 1);
    }
  }

  onWindowFrameGeometryChanged(window, oldGeometry) {
    if (window && window.visible) {
      this.visibilityLeasedWindows.delete(window);
      this.continuityLeasedWindows.delete(window);
      this.settleVisibilityHandoff(window);
    }

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

    if (!this.isTransitionPresentable(window)) {
      if (this.shouldDeferVisibilityHandoff(window)) {
        this.deferWindowTransition(window, oldGeometry);
      } else {
        this.clearWindowTransitions(window);
      }
      return;
    }

    const visibilityLeaseUsed = this.visibilityLeasedWindows.has(window);
    this.animateWindowTransition(window, oldGeometry, newGeometry);
    this.consumeVisibilityLease(window, visibilityLeaseUsed);
  }

  onFullScreenEffectChanged() {
    const active = effects.hasActiveFullScreenEffect;
    if (active === this.fullScreenEffectActive) {
      return;
    }
    this.fullScreenEffectActive = active;

    if (active) {
      this.visibilityHandoffPending = false;
      this.visibilityLeasedWindows.clear();
      this.continuityLeasedWindows.clear();
      this.rememberVisibilityLease(effects.activeWindow);
      for (const window of this.activeAnimationWindows) {
        this.cancelWindowAnimation(window);
      }
      return;
    }

    this.visibilityHandoffPending = this.duration > 0;
    this.replayDeferredTransitions();
    this.settleVisibilityHandoff(effects.activeWindow);
  }

  onVisibilityContextChanged() {
    this.pruneVisibilityLeases();
    this.replayDeferredTransitions();
    this.settleVisibilityHandoff(effects.activeWindow);
  }

  onWindowActivated(window) {
    this.rememberVisibilityLease(window);
    if (this.deferredWindows.has(window)) {
      this.replayDeferredTransition(window);
    }
    this.replayDeferredTransitions(window);
    this.settleVisibilityHandoff(window);
  }

  onWindowVisibilityOpportunity(window) {
    if (window) {
      this.visibilityLeasedWindows.delete(window);
      this.continuityLeasedWindows.delete(window);
    }
    this.rememberVisibilityLease(window);
    if (this.deferredWindows.has(window)) {
      this.replayDeferredTransition(window);
    }
    this.settleVisibilityHandoff(window);
  }

  shouldDeferVisibilityHandoff(window) {
    return (
      this.visibilityHandoffPending &&
      !window.visible &&
      this.isWindowInCurrentVisibilityContext(window)
    );
  }

  settleVisibilityHandoff(window) {
    if (
      this.visibilityHandoffPending &&
      window &&
      effects.activeWindow === window &&
      window.visible &&
      this.isWindowInCurrentVisibilityContext(window)
    ) {
      this.visibilityHandoffPending = false;
    }
  }

  deferWindowTransition(window, oldGeometry) {
    const deferredGeometry = window[DEFERRED_PROPERTY];
    if (deferredGeometry !== undefined) {
      if (!this.geometryChanged(deferredGeometry, window.geometry)) {
        delete window[DEFERRED_PROPERTY];
        this.deferredWindows.delete(window);
        this.visibilityLeasedWindows.delete(window);
        return;
      }
      this.deferredWindows.add(window);
      this.rememberVisibilityLease(window);
      return;
    }

    this.cancelWindowAnimation(window);
    window[DEFERRED_PROPERTY] = this.copyGeometry(oldGeometry);
    this.deferredWindows.add(window);
    this.rememberVisibilityLease(window);
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

    if (!this.geometryChanged(oldGeometry, newGeometry)) {
      delete window[DEFERRED_PROPERTY];
      this.deferredWindows.delete(window);
      this.visibilityLeasedWindows.delete(window);
      return;
    }

    if (!this.isTransitionPresentable(window)) {
      return;
    }

    const visibilityLeaseUsed = this.visibilityLeasedWindows.has(window);
    delete window[DEFERRED_PROPERTY];
    this.deferredWindows.delete(window);
    this.animateWindowTransition(window, oldGeometry, newGeometry);
    this.consumeVisibilityLease(window, visibilityLeaseUsed);
  }

  isDeferredTransitionPresentable(window) {
    return (
      window.visible ||
      ((effects.activeWindow === window ||
        this.visibilityLeasedWindows.has(window)) &&
        this.isWindowInCurrentVisibilityContext(window))
    );
  }

  isTransitionPresentable(window) {
    return (
      this.isDeferredTransitionPresentable(window) ||
      (this.continuityLeasedWindows.has(window) &&
        this.hasActiveWindowAnimation(window) &&
        this.isWindowInCurrentVisibilityContext(window))
    );
  }

  isWindowInCurrentVisibilityContext(window) {
    return (
      window.onCurrentDesktop &&
      (effects.currentActivity.length === 0 ||
        window.isOnActivity(effects.currentActivity))
    );
  }

  rememberVisibilityLease(window) {
    if (
      !window ||
      (!effects.hasActiveFullScreenEffect &&
        window[DEFERRED_PROPERTY] === undefined)
    ) {
      return;
    }

    if (
      effects.activeWindow === window &&
      this.isWindowInCurrentVisibilityContext(window)
    ) {
      this.visibilityLeasedWindows.add(window);
    }
  }

  consumeVisibilityLease(window, leaseUsed) {
    this.visibilityLeasedWindows.delete(window);
    if (
      leaseUsed &&
      !window.visible &&
      this.hasActiveWindowAnimation(window) &&
      this.isWindowInCurrentVisibilityContext(window)
    ) {
      this.continuityLeasedWindows.add(window);
    }
  }

  pruneVisibilityLeases() {
    for (const window of this.visibilityLeasedWindows) {
      if (!this.isWindowInCurrentVisibilityContext(window)) {
        this.visibilityLeasedWindows.delete(window);
      }
    }
    for (const window of this.continuityLeasedWindows) {
      if (!this.isWindowInCurrentVisibilityContext(window)) {
        this.continuityLeasedWindows.delete(window);
      }
    }
  }

  onAnimationEnded(window) {
    const state = window && window[ANIMATION_PROPERTY];
    if (!this.activeAnimationWindows.has(window)) {
      this.continuityLeasedWindows.delete(window);
      return;
    }
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      delete window[ANIMATION_PROPERTY];
      this.activeAnimationWindows.delete(window);
      this.continuityLeasedWindows.delete(window);
      return;
    }

    const remainingAnimations = this.activeAnimationCount(state) - 1;
    if (remainingAnimations > 0) {
      state[ACTIVE_ANIMATION_COUNT] = remainingAnimations;
    } else {
      delete window[ANIMATION_PROPERTY];
      this.activeAnimationWindows.delete(window);
      this.continuityLeasedWindows.delete(window);
    }
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
    const newSize = {
      value1: newGeometry.width,
      value2: newGeometry.height,
    };
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
      if (state[SIZE_ANIMATION] !== undefined) {
        this.retargetAnimation(state, SIZE_ANIMATION, newSize);
      }
    }

    if (!sizeChanged && !positionChanged) {
      if (state !== undefined) {
        this.storeWindowAnimationState(window, state);
      }
      return;
    }

    if (state === undefined) {
      state = this.windowAnimationState(window);
    }
    const animations = [];
    const animationProperties = [];
    const animationTargets = [];

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
      const previousAnimationCount = this.activeAnimationCount(state);
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
      state[ACTIVE_ANIMATION_COUNT] =
        previousAnimationCount + animationIds.length;
    }

    this.storeWindowAnimationState(window, state);
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
      this.isWindowClassEligible(window) &&
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

  classifyWindowClass(window) {
    const windowClass = window.windowClass;
    const cachedClassification = this.windowClassClassifications.get(window);
    if (
      cachedClassification !== undefined &&
      cachedClassification.generation ===
        this.windowClassClassificationGeneration &&
      cachedClassification.windowClass === windowClass
    ) {
      return cachedClassification;
    }

    const stringWindowClass = typeof windowClass === "string";
    const classification = {
      excluded:
        !this.windowClassExclusionsValid ||
        (stringWindowClass &&
          this.windowClassExclusions.size > 0 &&
          this.windowClassExclusions.has(windowClass)),
      generation: this.windowClassClassificationGeneration,
      shell:
        stringWindowClass &&
        windowClass
          .trim()
          .split(/\s+/u)
          .some((component) => SHELL_WINDOW_CLASSES.has(component)),
      windowClass,
    };
    this.windowClassClassifications.set(window, classification);
    return classification;
  }

  isWindowClassEligible(window) {
    const classification = this.classifyWindowClass(window);
    return !classification.shell && !classification.excluded;
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

  storeWindowAnimationState(window, state) {
    if (this.hasActiveAnimationState(state)) {
      window[ANIMATION_PROPERTY] = state;
      this.activeAnimationWindows.add(window);
    } else {
      delete window[ANIMATION_PROPERTY];
      this.activeAnimationWindows.delete(window);
    }
  }

  hasActiveWindowAnimation(window) {
    const state = window && window[ANIMATION_PROPERTY];
    return (
      this.activeAnimationWindows.has(window) &&
      state &&
      typeof state === "object" &&
      !Array.isArray(state) &&
      this.hasActiveAnimationState(state)
    );
  }

  hasActiveAnimationState(state) {
    return (
      this.activeAnimationCount(state) > 0 &&
      (state[SIZE_ANIMATION] !== undefined ||
        state[POSITION_ANIMATION] !== undefined ||
        state[TRANSLATION_ANIMATION] !== undefined)
    );
  }

  activeAnimationCount(state) {
    const count = state[ACTIVE_ANIMATION_COUNT];
    if (Number.isInteger(count) && count >= 0) {
      return count;
    }

    return this.trackedAnimationCount(state);
  }

  trackedAnimationCount(state) {
    let derivedCount = 0;
    if (state[SIZE_ANIMATION] !== undefined) {
      derivedCount += 1;
    }
    if (state[POSITION_ANIMATION] !== undefined) {
      derivedCount += 1;
    }
    if (state[TRANSLATION_ANIMATION] !== undefined) {
      derivedCount += 1;
    }
    return derivedCount;
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

    const activeAnimationCount = this.activeAnimationCount(state);
    delete state[property];
    delete state[targetProperty];
    state[ACTIVE_ANIMATION_COUNT] = Math.min(
      activeAnimationCount,
      this.trackedAnimationCount(state),
    );
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
      if (cancel(state[property])) {
        const remainingAnimations = this.activeAnimationCount(state) - 1;
        state[ACTIVE_ANIMATION_COUNT] = Math.max(0, remainingAnimations);
      }
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
    if (!window) {
      return;
    }

    const state = window[ANIMATION_PROPERTY];
    if (state === undefined) {
      this.activeAnimationWindows.delete(window);
      return;
    }
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      cancel(state);
      delete window[ANIMATION_PROPERTY];
      this.activeAnimationWindows.delete(window);
      return;
    }

    this.cancelSizeAnimation(state);
    this.cancelPositionAnimations(state);
    delete window[ANIMATION_PROPERTY];
    this.activeAnimationWindows.delete(window);
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
    this.visibilityLeasedWindows.delete(window);
    this.continuityLeasedWindows.delete(window);
  }
}

new DriftileTransitionsEffect();
